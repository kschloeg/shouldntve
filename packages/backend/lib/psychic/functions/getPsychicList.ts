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

    // Remove picture data from all predictions to prevent leaking
    const safePredictions = predictions.map(pred => {
      if (pred.status === 'revealed' && pred.revealedPictureId) {
        // For revealed predictions, only include the revealed picture
        const revealedPicture = pred.revealedPictureId === pred.picture1.id
          ? pred.picture1
          : pred.picture2;
        const { picture1, picture2, ...rest } = pred;
        return { ...rest, revealedPicture } as any;
      } else {
        // For non-revealed predictions, remove all picture data
        const { picture1, picture2, team1PictureId, ...rest } = pred;
        return rest as any;
      }
    });

    const response: ListPredictionsResponse = {
      predictions: safePredictions,
      count: safePredictions.length,
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
