import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PredictionResponse } from '../types/psychic';
import { PredictionStore } from '../services/predictionStore';
import { corsHeadersFromOrigin, getRequestOrigin } from '../../utils/cors';
import { requireAuth } from '../../utils/authHelpers';

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
    const prediction = await store.getPrediction(predictionId);

    if (!prediction) {
      return {
        statusCode: 404,
        headers: corsHeadersFromOrigin(origin, 'application/json'),
        body: JSON.stringify({ error: 'Prediction not found' }),
      };
    }

    // Check if caller wants to see pictures (optional, reduces test validity)
    const includePictures = event.queryStringParameters?.includePictures === 'true';

    // Before revealing, hide the pictures to prevent psychic from seeing them
    if (prediction.status === 'created' || prediction.status === 'prediction_made') {
      if (includePictures) {
        // Include pictures if explicitly requested
        const { team1PictureId, ...safePrediction } = prediction;
        const response: PredictionResponse = {
          prediction: safePrediction as any,
        };
        return {
          statusCode: 200,
          headers: corsHeadersFromOrigin(origin, 'application/json'),
          body: JSON.stringify(response),
        };
      } else {
        // By default, hide pictures
        const { picture1, picture2, team1PictureId, ...safePrediction } = prediction;
        const response: PredictionResponse = {
          prediction: safePrediction as any,
        };
        return {
          statusCode: 200,
          headers: corsHeadersFromOrigin(origin, 'application/json'),
          body: JSON.stringify(response),
        };
      }
    }

    // After reveal, only return the revealed picture
    if (prediction.status === 'revealed') {
      const revealedPicture = prediction.revealedPictureId === prediction.picture1.id
        ? prediction.picture1
        : prediction.picture2;

      const { picture1, picture2, ...predictionWithoutBothPictures } = prediction;

      const response: PredictionResponse = {
        prediction: {
          ...predictionWithoutBothPictures,
          revealedPicture,
        } as any,
      };

      return {
        statusCode: 200,
        headers: corsHeadersFromOrigin(origin, 'application/json'),
        body: JSON.stringify(response),
      };
    }

    // Fallback for other statuses (shouldn't happen)
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
