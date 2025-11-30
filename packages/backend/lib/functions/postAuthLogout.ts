import { getRequestOrigin, corsHeadersFromOrigin } from '../utils/cors';

export const handler = async (event: {
  headers?: Record<string, string>;
  body?: string;
}) => {
  // Clear the auth_token cookie by setting an expired cookie
  const cookie = `auth_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=None`;
  const origin = getRequestOrigin(event?.headers);

  return {
    statusCode: 200,
    headers: {
      'Set-Cookie': cookie,
      ...corsHeadersFromOrigin(origin, 'application/json'),
    },
    body: JSON.stringify({ message: 'signed out' }),
  };
};
