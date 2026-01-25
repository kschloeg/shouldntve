import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ListPredictionsResponse } from '../types/psychic';
import { PredictionStore } from '../services/predictionStore';
import { corsHeadersFromOrigin, getRequestOrigin } from '../../utils/cors';

/**
 * GET /psychic
 *
 * Lists recent psychic predictions.
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Listing psychic predictions', event);

  const origin = getRequestOrigin(event.headers as Record<string, string>);

  try {
    const limit = event.queryStringParameters?.limit
      ? parseInt(event.queryStringParameters.limit)
      : 50;

    const store = new PredictionStore(process.env.TABLE_NAME || '');
    const predictions = await store.listPredictions(limit);

    const response: ListPredictionsResponse = {
      predictions,
      count: predictions.length,
    };

    return {
      statusCode: 200,
      headers: corsHeadersFromOrigin(origin, 'application/json'),
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error listing psychic predictions:', error);
    return {
      statusCode: 500,
      headers: corsHeadersFromOrigin(origin, 'application/json'),
      body: JSON.stringify({
        error: 'Failed to list predictions',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
