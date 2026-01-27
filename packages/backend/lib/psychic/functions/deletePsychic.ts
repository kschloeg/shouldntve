import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PredictionStore } from '../services/predictionStore';
import { corsHeadersFromOrigin, getRequestOrigin } from '../../utils/cors';
import { requireAuth } from '../../utils/authHelpers';

/**
 * DELETE /psychic/{predictionId}
 *
 * Deletes a prediction from the database.
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Deleting psychic prediction', event);

  const origin = getRequestOrigin(event.headers as Record<string, string>);

  const auth = await requireAuth(event.headers as Record<string, string>, origin);
  if (!auth.authorized) return auth.response;

  try {
    const predictionId = event.pathParameters?.predictionId;
    if (!predictionId) {
      return {
        statusCode: 400,
        headers: corsHeadersFromOrigin(origin, 'application/json'),
        body: JSON.stringify({ error: 'predictionId is required' }),
      };
    }

    const store = new PredictionStore(process.env.TABLE_NAME || '');

    // Check if prediction exists
    const prediction = await store.getPrediction(predictionId);
    if (!prediction) {
      return {
        statusCode: 404,
        headers: corsHeadersFromOrigin(origin, 'application/json'),
        body: JSON.stringify({ error: 'Prediction not found' }),
      };
    }

    // Delete the prediction
    await store.deletePrediction(predictionId);

    return {
      statusCode: 200,
      headers: corsHeadersFromOrigin(origin, 'application/json'),
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error('Error deleting psychic prediction:', error);
    return {
      statusCode: 500,
      headers: corsHeadersFromOrigin(origin, 'application/json'),
      body: JSON.stringify({
        error: 'Failed to delete prediction',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
