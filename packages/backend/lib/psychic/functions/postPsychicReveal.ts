import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { RevealPredictionRequest, PredictionResponse } from '../types/psychic';
import { PredictionStore } from '../services/predictionStore';
import { corsHeadersFromOrigin, getRequestOrigin } from '../../utils/cors';

/**
 * POST /psychic/reveal
 *
 * Reveals the picture associated with the winning team after the event.
 *
 * Request body:
 * {
 *   "predictionId": "pred_123...",
 *   "winningTeam": "Team A"
 * }
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Revealing psychic prediction', event);

  const origin = getRequestOrigin(event.headers as Record<string, string>);

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeadersFromOrigin(origin, 'application/json'),
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const request: RevealPredictionRequest = JSON.parse(event.body);

    if (!request.predictionId || !request.winningTeam) {
      return {
        statusCode: 400,
        headers: corsHeadersFromOrigin(origin, 'application/json'),
        body: JSON.stringify({ error: 'predictionId and winningTeam are required' }),
      };
    }

    // Get the prediction from the database
    const store = new PredictionStore(process.env.TABLE_NAME || '');
    const prediction = await store.getPrediction(request.predictionId);

    if (!prediction) {
      return {
        statusCode: 404,
        headers: corsHeadersFromOrigin(origin, 'application/json'),
        body: JSON.stringify({ error: 'Prediction not found' }),
      };
    }

    // Validate that the winning team is one of the two teams
    if (request.winningTeam !== prediction.team1 && request.winningTeam !== prediction.team2) {
      return {
        statusCode: 400,
        headers: corsHeadersFromOrigin(origin, 'application/json'),
        body: JSON.stringify({
          error: `winningTeam must be either "${prediction.team1}" or "${prediction.team2}"`,
        }),
      };
    }

    // Determine which picture to reveal
    const revealedPictureId =
      request.winningTeam === prediction.team1
        ? prediction.team1PictureId
        : request.winningTeam === prediction.team2
        ? prediction.team1PictureId === prediction.picture1.id
          ? prediction.picture2.id
          : prediction.picture1.id
        : prediction.team1PictureId;

    // Update the prediction with the reveal
    await store.revealPrediction(request.predictionId, request.winningTeam, revealedPictureId);

    // Get the updated prediction
    const updatedPrediction = await store.getPrediction(request.predictionId);

    const response: PredictionResponse = {
      prediction: updatedPrediction!,
    };

    return {
      statusCode: 200,
      headers: corsHeadersFromOrigin(origin, 'application/json'),
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error revealing psychic prediction:', error);
    return {
      statusCode: 500,
      headers: corsHeadersFromOrigin(origin, 'application/json'),
      body: JSON.stringify({
        error: 'Failed to reveal prediction',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
