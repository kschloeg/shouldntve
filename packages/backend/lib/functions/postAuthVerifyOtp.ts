import {
  DynamoDBClient,
  GetItemCommand,
  DeleteItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { getRequestOrigin, corsHeadersFromOrigin } from '../utils/cors';

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

const ddb = new DynamoDBClient({});

const tableName = process.env.TABLE_NAME_OTPS;
const usersTable = process.env.USERS_TABLE;
const otpSecretArn = process.env.OTP_SECRET_ARN;
const jwtSecretArn = process.env.JWT_SECRET_ARN;
const secretsClient = new SecretsManagerClient({});
let cachedOtpSecret: string | undefined = process.env.OTP_SECRET;
let cachedJwtSecret: string | undefined =
  process.env.JWT_SECRET || 'dev_jwt_secret';

function hashOtp(otp: string) {
  if (!cachedOtpSecret) throw new Error('Missing OTP_SECRET');
  return crypto.createHmac('sha256', cachedOtpSecret).update(otp).digest('hex');
}

export const handler = async (event: {
  body: string;
  headers?: Record<string, string>;
}) => {
  if (!tableName) throw new Error('Missing TABLE_NAME_OTPS');

  const origin = getRequestOrigin(event.headers);

  let body: { phone?: string; email?: string; code?: string } = {};
  try {
    body = JSON.parse(event.body);
  } catch (err) {
    return {
      statusCode: 400,
      body: 'Invalid JSON',
      headers: corsHeadersFromOrigin(origin, 'text/plain'),
    };
  }

  if ((!body.phone && !body.email) || !body.code) {
    return {
      statusCode: 400,
      body: `Missing parameters: code: ${!!body.code}, phone: ${!!body.phone}, email: ${!!body.email}`,
      headers: corsHeadersFromOrigin(origin, 'text/plain'),
    };
  }

  const isEmail = !!body.email;
  const identifier = isEmail
    ? body.email!.trim().toLowerCase()
    : body.phone!.replace(/[^+0-9]/g, '');

  try {
    const keyPk = isEmail ? `EMAIL#${identifier}` : `PHONE#${identifier}`;
    console.info('verifyOtp: lookup', {
      keyPk,
      codeMasked: `****${body.code?.slice(-2)}`,
    });
    const res = await ddb.send(
      new GetItemCommand({
        TableName: tableName,
        Key: { PK: { S: keyPk }, SK: { S: 'OTP' } },
      })
    );

    if (!res.Item) {
      return { statusCode: 401, body: 'Invalid or expired code' };
    }

    const expiresAt = parseInt(res.Item.expiresAt.N || '0', 10);
    const now = Math.floor(Date.now() / 1000);

    if (now > expiresAt) {
      // expired
      await ddb.send(
        new DeleteItemCommand({
          TableName: tableName,
          Key: { PK: { S: keyPk }, SK: { S: 'OTP' } },
        })
      );
      return { statusCode: 401, body: 'Invalid or expired code' };
    }

    const otpHash = res.Item.otpHash.S || '';
    // ensure OTP secret is loaded — be strict: if we can't load it, fail closed
    if (otpSecretArn && !cachedOtpSecret) {
      console.info(
        'OTP secret ARN provided, loading secret from Secrets Manager',
        { otpSecretArn }
      );
      try {
        const sec = await secretsClient.send(
          new GetSecretValueCommand({ SecretId: otpSecretArn })
        );
        if (sec.SecretString) {
          try {
            const parsed = JSON.parse(sec.SecretString);
            cachedOtpSecret = parsed.otp || sec.SecretString;
            console.info('Loaded OTP secret from Secrets Manager (masked)');
          } catch (e) {
            cachedOtpSecret = sec.SecretString;
            console.info(
              'Loaded OTP secret string from Secrets Manager (masked)'
            );
          }
        }
      } catch (err) {
        console.error('Failed to load OTP secret from Secrets Manager', err);
        return {
          statusCode: 500,
          body: JSON.stringify({ message: 'Auth unavailable' }),
          headers: corsHeadersFromOrigin(origin, 'application/json'),
        };
      }
    }

    if (!cachedOtpSecret) {
      console.error(
        'OTP secret missing after Secrets Manager attempt — failing closed'
      );
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Auth unavailable' }),
        headers: corsHeadersFromOrigin(origin, 'application/json'),
      };
    }

    console.info('Hashing provided OTP for comparison');
    const providedHash = hashOtp(body.code);

    if (providedHash !== otpHash) {
      // increment attempts
      const attempts = parseInt(res.Item.attempts.N || '0', 10) + 1;
      const updates: any = {
        TableName: tableName,
        Key: { PK: { S: keyPk }, SK: { S: 'OTP' } },
        UpdateExpression: 'SET attempts = :a',
        ExpressionAttributeValues: { ':a': { N: attempts.toString() } },
      };
      await ddb.send(new UpdateItemCommand(updates));

      if (attempts >= 5) {
        await ddb.send(
          new DeleteItemCommand({
            TableName: tableName,
            Key: { PK: { S: keyPk }, SK: { S: 'OTP' } },
          })
        );
      }

      return { statusCode: 401, body: 'Invalid code' };
    }

    // valid code: delete OTP and issue JWT
    await ddb.send(
      new DeleteItemCommand({
        TableName: tableName,
        Key: { PK: { S: keyPk }, SK: { S: 'OTP' } },
      })
    );

    // enforce global daily limit
    try {
      const maxPerDay = parseInt(process.env.MAX_AUTHS_PER_DAY || '0', 10);
      if (maxPerDay > 0) {
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const counterKey = { PK: { S: 'GLOBAL' }, SK: { S: `COUNT#${today}` } };

        // increment atomically and return new value, set TTL for counter
        const ttl = Math.floor(Date.now() / 1000) + 3600; // 1 hour
        const updateParams: any = {
          TableName: tableName,
          Key: counterKey,
          UpdateExpression:
            'SET #c = if_not_exists(#c, :zero) + :inc, expiresAt = :exp',
          ExpressionAttributeNames: { '#c': 'count' },
          ExpressionAttributeValues: {
            ':inc': { N: '1' },
            ':zero': { N: '0' },
            ':exp': { N: ttl.toString() },
          },
          ReturnValues: 'UPDATED_NEW',
        };

        const updated = await ddb.send(new UpdateItemCommand(updateParams));
        const newCount = parseInt(
          (updated.Attributes && updated.Attributes.count.N) || '0',
          10
        );
        console.info('Global auth count for today:', newCount);
        if (newCount > maxPerDay) {
          return { statusCode: 429, body: 'Daily authorization limit reached' };
        }
      }
    } catch (err) {
      console.error('Failed to update global auth counter', err);
      // allow auth to proceed if counter update fails, to avoid locking users out on errors
    }

    // optionally create user record if USERS_TABLE provided
    if (usersTable) {
      console.info('Upserting user record in USERS_TABLE', { identifier });
      try {
        // upsert minimal user record with PK=USER and SK=<identifier>
        const updateParams: any = {
          TableName: usersTable,
          Key: { PK: { S: 'USER' }, SK: { S: identifier } },
          UpdateExpression: isEmail
            ? 'SET #e = if_not_exists(#e, :val)'
            : 'SET #p = if_not_exists(#p, :val)',
          ExpressionAttributeNames: isEmail
            ? { '#e': 'email' }
            : { '#p': 'phone' },
          ExpressionAttributeValues: { ':val': { S: identifier } },
          ReturnValues: 'NONE',
        };
        await ddb.send(new UpdateItemCommand(updateParams));
      } catch (err) {
        console.error('Failed to upsert user', err);
      }
    }

    // record login metadata: lastLoginAt and increment numberOfLogins
    if (usersTable) {
      try {
        const nowTs = Math.floor(Date.now() / 1000).toString();
        const updateParams: any = {
          TableName: usersTable,
          Key: { PK: { S: 'USER' }, SK: { S: identifier } },
          UpdateExpression:
            'SET lastLoginAt = :lla, #n = if_not_exists(#n, :zero) + :inc',
          ExpressionAttributeNames: { '#n': 'numberOfLogins' },
          ExpressionAttributeValues: {
            ':lla': { N: nowTs },
            ':inc': { N: '1' },
            ':zero': { N: '0' },
          },
          ReturnValues: 'UPDATED_NEW',
        };
        await ddb.send(new UpdateItemCommand(updateParams));
      } catch (err) {
        console.error('Failed to update login meta', err);
      }
    }

    if (!jwtSecretArn) {
      console.info('No JWT_SECRET_ARN, failing auth');
      return {
        statusCode: 500,
        body: { message: 'No JWT_SECRET_ARN' },
        headers: corsHeadersFromOrigin(origin, 'application/json'),
      };
    }

    // load JWT secret strictly if ARN provided
    if (jwtSecretArn) {
      console.info('Loading JWT secret from Secrets Manager', { jwtSecretArn });
      try {
        const sec = await secretsClient.send(
          new GetSecretValueCommand({ SecretId: jwtSecretArn })
        );
        if (sec.SecretString) {
          try {
            const parsed = JSON.parse(sec.SecretString);
            cachedJwtSecret = parsed.jwt || sec.SecretString;
          } catch (e) {
            cachedJwtSecret = sec.SecretString;
          }
          console.info('Loaded JWT secret from Secrets Manager (masked)');
        }
      } catch (err) {
        console.error('Failed to load JWT secret from Secrets Manager', err);
        return {
          statusCode: 500,
          body: JSON.stringify({ message: 'Auth unavailable' }),
          headers: corsHeadersFromOrigin(origin, 'application/json'),
        };
      }
    }

    if (!cachedJwtSecret || cachedJwtSecret === 'dev_jwt_secret') {
      console.error(
        'JWT secret not available or left as dev default — failing closed'
      );
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Auth unavailable' }),
        headers: corsHeadersFromOrigin(origin, 'application/json'),
      };
    }

    const subject = isEmail ? identifier : identifier;
    const token = jwt.sign({ sub: subject }, cachedJwtSecret as string, {
      expiresIn: '4h',
    });

    // create Set-Cookie header for httpOnly cookie
    const originHeader = getRequestOrigin(event.headers);
    const cookie = `auth_token=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=14400`;

    return {
      statusCode: 200,
      body: JSON.stringify({ token }),
      headers: {
        ...corsHeadersFromOrigin(originHeader, 'application/json'),
        'Set-Cookie': cookie,
      },
    };
  } catch (err) {
    console.error('verifyOtp: uncaught', err);
    return {
      statusCode: 500,
      body: 'Internal server error',
      headers: corsHeadersFromOrigin(origin, 'text/plain'),
    };
  }
};
