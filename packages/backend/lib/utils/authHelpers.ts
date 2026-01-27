import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import * as jwt from 'jsonwebtoken';
import { APIGatewayProxyResult } from 'aws-lambda';
import { corsHeadersFromOrigin } from './cors';

const secretsClient = new SecretsManagerClient({});
const jwtSecretArn = process.env.JWT_SECRET_ARN;
let cachedJwtSecret: string | undefined =
  process.env.JWT_SECRET || 'dev_jwt_secret';

export async function loadJwtSecret() {
  if (
    jwtSecretArn &&
    (!cachedJwtSecret || cachedJwtSecret === 'dev_jwt_secret')
  ) {
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
      }
    } catch (err) {
      console.error('Failed to load JWT secret', err);
    }
  }
}

export function parseCookies(cookieHeader?: string) {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  cookieHeader.split(';').forEach((c) => {
    const [k, ...v] = c.split('=');
    out[k.trim()] = decodeURIComponent((v || []).join('=').trim());
  });
  return out;
}

export async function getSubjectFromHeaders(
  headers?: Record<string, string> | undefined
): Promise<string | null> {
  await loadJwtSecret();
  const cookieHeader = headers?.cookie || headers?.Cookie;
  const cookies = parseCookies(cookieHeader);
  const token = cookies['auth_token'] || null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, cachedJwtSecret as string) as any;
    return payload.sub as string;
  } catch (err) {
    console.error('auth: invalid token', err);
    return null;
  }
}

type AuthResult =
  | { authorized: true; subject: string }
  | { authorized: false; response: APIGatewayProxyResult };

/**
 * Verify authentication from request headers.
 * Returns the subject if authorized, or an unauthorized response if not.
 *
 * Usage:
 *   const auth = await requireAuth(event.headers, origin);
 *   if (!auth.authorized) return auth.response;
 *   // auth.subject is now available
 */
export async function requireAuth(
  headers: Record<string, string> | undefined,
  origin: string
): Promise<AuthResult> {
  const subject = await getSubjectFromHeaders(headers);
  if (!subject) {
    return {
      authorized: false,
      response: {
        statusCode: 401,
        headers: corsHeadersFromOrigin(origin, 'application/json'),
        body: JSON.stringify({ error: 'Unauthorized' }),
      },
    };
  }
  return { authorized: true, subject };
}
