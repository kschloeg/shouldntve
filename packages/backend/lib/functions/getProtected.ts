import { getSubjectFromHeaders } from '../utils/authHelpers';
import { getRequestOrigin, corsHeadersFromOrigin } from '../utils/cors';

export const handler = async (event: { headers?: Record<string, string> }) => {
  const headers = event.headers || {};
  const origin = getRequestOrigin(headers);

  const subject = await getSubjectFromHeaders(headers);
  if (!subject) {
    return {
      statusCode: 401,
      body: 'Missing auth_token',
      headers: corsHeadersFromOrigin(origin),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ sub: subject }),
    headers: { ...corsHeadersFromOrigin(origin, 'application/json') },
  };
};
