export function getRequestOrigin(headers?: Record<string, string>) {
  return (
    (headers && (headers.Origin || headers.origin)) ||
    process.env.FRONTEND_ORIGIN ||
    '*'
  );
}

export function corsHeadersFromOrigin(
  origin: string,
  contentType = 'text/plain'
) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Content-Type': contentType,
  } as Record<string, string>;
}

export function preflightResponse(origin: string) {
  return {
    statusCode: 204,
    body: '',
    headers: corsHeadersFromOrigin(origin),
  };
}
