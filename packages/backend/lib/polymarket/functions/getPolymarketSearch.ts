import { APIGatewayProxyHandler } from 'aws-lambda';
import { searchMarkets } from '../services/polymarketApiClient';
import { corsHeadersFromOrigin, getRequestOrigin } from '../../utils/cors';

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('getPolymarketSearch event:', JSON.stringify(event));

  const origin = getRequestOrigin(event.headers as Record<string, string>);

  try {
    // Parse query parameters
    const query = event.queryStringParameters?.q || event.queryStringParameters?.query || '';
    const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
    const offset = parseInt(event.queryStringParameters?.offset || '0', 10);
    const active = event.queryStringParameters?.active !== 'false';
    const closed = event.queryStringParameters?.closed === 'true';
    const archived = event.queryStringParameters?.archived === 'true';

    console.log('Search params:', { query, limit, offset, active, closed, archived });

    // Call Polymarket API
    const result = await searchMarkets({
      query,
      limit,
      offset,
      active,
      closed,
      archived,
    });

    return {
      statusCode: 200,
      headers: corsHeadersFromOrigin(origin, 'application/json'),
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('Error searching Polymarket:', error);
    return {
      statusCode: 500,
      headers: corsHeadersFromOrigin(origin, 'application/json'),
      body: JSON.stringify({
        error: 'Failed to search Polymarket markets',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
