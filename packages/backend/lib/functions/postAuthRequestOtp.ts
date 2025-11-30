import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import * as crypto from 'crypto';
import { getRequestOrigin, corsHeadersFromOrigin } from '../utils/cors';

const sns = new SNSClient({});
const ddb = new DynamoDBClient({});
const ses = new SESClient({});

const OTP_TTL_SECONDS = 5 * 60; // 5 minutes
const OTP_LENGTH = 6;

const tableName = process.env.TABLE_NAME_OTPS;
const otpSecretArn = process.env.OTP_SECRET_ARN;
const secretsClient = new SecretsManagerClient({});
let cachedOtpSecret: string | undefined = process.env.OTP_SECRET;
const snsSenderId = process.env.SNS_SENDER_ID || 'Auth';
const sesFromAddress = process.env.SES_FROM_ADDRESS || undefined;

function generateOtp() {
  let otp = '';
  for (let i = 0; i < OTP_LENGTH; i++) {
    otp += Math.floor(Math.random() * 10).toString();
  }
  return otp;
}

function hashOtp(otp: string) {
  if (!cachedOtpSecret) throw new Error('Missing OTP_SECRET');
  return crypto.createHmac('sha256', cachedOtpSecret).update(otp).digest('hex');
}

function normalizePhone(phone: string) {
  // naive normalization: remove spaces and dots
  return phone.replace(/[^+0-9]/g, '');
}

export const handler = async (event: {
  body: string;
  headers?: Record<string, string>;
}) => {
  if (!tableName) throw new Error('Missing TABLE_NAME_OTPS');

  let body: { phone?: string; email?: string } = {};
  const origin = getRequestOrigin(event.headers);

  try {
    body = JSON.parse(event.body);
  } catch (err) {
    return {
      statusCode: 400,
      body: 'Invalid JSON',
      headers: corsHeadersFromOrigin(origin, 'text/plain'),
    };
  }

  if (!body.phone && !body.email) {
    return {
      statusCode: 400,
      body: 'Missing phone or email',
      headers: corsHeadersFromOrigin(origin, 'text/plain'),
    };
  }

  // determine identity (PHONE or EMAIL) and normalized identifier
  let idType: 'PHONE' | 'EMAIL';
  let identifier: string;
  let phone: string | undefined;
  if (body.email) {
    idType = 'EMAIL';
    identifier = (body.email as string).trim().toLowerCase();
  } else {
    idType = 'PHONE';
    phone = normalizePhone(body.phone as string);
    identifier = phone;
  }

  // rate limit: check if an OTP exists and is recent
  try {
    const get = await ddb.send(
      new GetItemCommand({
        TableName: tableName,
        Key: { PK: { S: `${idType}#${identifier}` }, SK: { S: 'OTP' } },
      })
    );

    if (get.Item && get.Item.expiresAt && get.Item.createdAt) {
      const createdAt = parseInt(get.Item.createdAt.N || '0', 10);
      const now = Math.floor(Date.now() / 1000);
      if (now - createdAt < 60) {
        return {
          statusCode: 429,
          body: 'Too many requests',
          headers: corsHeadersFromOrigin(origin, 'text/plain'),
        };
      }
    }
  } catch (err) {
    console.error('Error checking existing OTP', err);
  }

  const otp = generateOtp();
  // load secret if ARN provided and not cached
  if (otpSecretArn && !cachedOtpSecret) {
    try {
      const sec = await secretsClient.send(
        new GetSecretValueCommand({ SecretId: otpSecretArn })
      );
      if (sec.SecretString) {
        try {
          const parsed = JSON.parse(sec.SecretString);
          cachedOtpSecret = parsed.otp || sec.SecretString;
        } catch (e) {
          cachedOtpSecret = sec.SecretString;
        }
      }
    } catch (err) {
      console.error('Failed to load OTP secret', err);
    }
  }

  const otpHash = hashOtp(otp);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + OTP_TTL_SECONDS;

  try {
    await ddb.send(
      new PutItemCommand({
        TableName: tableName,
        Item: {
          PK: { S: `${idType}#${identifier}` },
          SK: { S: 'OTP' },
          otpHash: { S: otpHash },
          attempts: { N: '0' },
          createdAt: { N: now.toString() },
          expiresAt: { N: expiresAt.toString() },
        },
      })
    );

    // if email provided and USERS_TABLE is configured, ensure minimal user record exists
    const usersTable = process.env.USERS_TABLE;
    if (body.email && usersTable) {
      try {
        const id = (body.email as string).trim().toLowerCase();
        await ddb.send(
          new UpdateItemCommand({
            TableName: usersTable,
            Key: { PK: { S: 'USER' }, SK: { S: id } },
            UpdateExpression: 'SET #e = if_not_exists(#e, :email)',
            ExpressionAttributeNames: { '#e': 'email' },
            ExpressionAttributeValues: { ':email': { S: id } },
            ReturnValues: 'NONE',
          })
        );
      } catch (err) {
        console.error('Failed to upsert user on requestOtp', err);
      }
    }

    // send SMS or Email depending on input
    if (body.email) {
      const email = (body.email as string).trim();
      const subject = 'Your login code';
      const htmlBody = `<p>Your login code is: <strong>${otp}</strong></p>`;
      const textBody = `Your login code is: ${otp}`;
      if (!sesFromAddress) {
        console.error('SES_FROM_ADDRESS not configured');
        return {
          statusCode: 500,
          body: 'Email provider not configured',
          headers: corsHeadersFromOrigin(origin, 'text/plain'),
        };
      }
      try {
        console.info('Attempting SES send', {
          to: email,
          from: sesFromAddress,
          idType,
          identifier,
        });
        const sendRes = await ses.send(
          new SendEmailCommand({
            Destination: { ToAddresses: [email] },
            Message: {
              Body: {
                Html: { Data: htmlBody },
                Text: { Data: textBody },
              },
              Subject: { Data: subject },
            },
            Source: sesFromAddress,
          })
        );
        const masked = otp.replace(/.(?=.{2})/g, '*');
        console.info('Sent OTP via SES', {
          email,
          otp: masked,
          messageId: sendRes.MessageId,
          sendRes,
        });
      } catch (err: any) {
        // log detailed error info to CloudWatch for debugging
        console.error('SES send failed', {
          error: err?.name || null,
          message: err?.message || err,
          code: err?.Code || err?.code || null,
          stack: err?.stack || null,
          to: email,
          from: sesFromAddress,
        });
        return {
          statusCode: 502,
          body: 'Email provider send failed',
          headers: corsHeadersFromOrigin(origin, 'text/plain'),
        };
      }
    } else {
      // send SMS
      const msg = `Your login code is: ${otp}`;
      try {
        const publishRes = await sns.send(
          new PublishCommand({
            PhoneNumber: phone,
            Message: msg,
            MessageAttributes: {
              'AWS.SNS.SMS.SenderID': {
                DataType: 'String',
                StringValue: snsSenderId,
              },
            },
          })
        );
        // mask OTP in logs
        const masked = otp.replace(/.(?=.{2})/g, '*');
        console.info('Sent OTP', {
          phone,
          otp: masked,
          messageId: publishRes.MessageId,
        });
      } catch (err) {
        console.error('SNS publish failed', err);
        throw err;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok' }),
      headers: corsHeadersFromOrigin(origin, 'application/json'),
    };
  } catch (err) {
    console.error('Error creating OTP', err);
    return {
      statusCode: 500,
      body: 'Internal server error',
      headers: corsHeadersFromOrigin(origin, 'text/plain'),
    };
  }
};
