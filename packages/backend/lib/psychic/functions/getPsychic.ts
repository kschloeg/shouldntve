import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PredictionResponse } from '../types/psychic';
import { PredictionStore } from '../services/predictionStore';
import { corsHeadersFromOrigin, getRequestOrigin } from '../../utils/cors';

/**
 * GET /psychic/{predictionId}
 *
 * Retrieves a specific psychic prediction by ID.
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Getting psychic prediction', event);

  const origin = getRequestOrigin(event.headers as Record<string, string>);

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
    const prediction = await store.getPrediction(predictionId);

    if (!prediction) {
      return {
        statusCode: 404,
        headers: corsHeadersFromOrigin(origin, 'application/json'),
        body: JSON.stringify({ error: 'Prediction not found' }),
      };
    }

    // Before revealing, hide the team assignments
    // Only show pictures and teams, not which picture goes with which team
    if (prediction.status === 'created' || prediction.status === 'prediction_made') {
      // Don't expose team1PictureId until revealed
      const safePrediction = {
        ...prediction,
        team1PictureId: undefined, // Hide the assignment
      };

      const response: PredictionResponse = {
        prediction: safePrediction as any,
      };

      return {
        statusCode: 200,
        headers: corsHeadersFromOrigin(origin, 'application/json'),
        body: JSON.stringify(response),
      };
    }

    const response: PredictionResponse = {
      prediction,
    };

    return {
      statusCode: 200,
      headers: corsHeadersFromOrigin(origin, 'application/json'),
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error getting psychic prediction:', error);
    return {
      statusCode: 500,
      headers: corsHeadersFromOrigin(origin, 'application/json'),
      body: JSON.stringify({
        error: 'Failed to get prediction',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
