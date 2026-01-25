import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CreatePredictionRequest, PredictionResponse } from '../types/psychic';
import { PictureApiClient } from '../services/pictureApiClient';
import { PredictionStore } from '../services/predictionStore';
import { corsHeadersFromOrigin, getRequestOrigin } from '../../utils/cors';

/**
 * POST /psychic/create
 *
 * Creates a new psychic prediction session by:
 * 1. Fetching two dissimilar random pictures
 * 2. Assigning picture1 to team1 and picture2 to team2
 * 3. Storing the prediction in the database
 *
 * Request body:
 * {
 *   "team1": "Team A",
 *   "team2": "Team B"
 * }
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Creating psychic prediction', event);

  const origin = getRequestOrigin(event.headers as Record<string, string>);

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeadersFromOrigin(origin, 'application/json'),
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const request: CreatePredictionRequest = JSON.parse(event.body);

    if (!request.team1 || !request.team2) {
      return {
        statusCode: 400,
        headers: corsHeadersFromOrigin(origin, 'application/json'),
        body: JSON.stringify({ error: 'Both team1 and team2 are required' }),
      };
    }

    // Fetch two dissimilar pictures
    const pictureClient = new PictureApiClient();

    // TODO: Track used pictures to avoid reuse
    const usedPictureIds = new Set<string>();

    const [picture1, picture2] = await pictureClient.fetchTwoDissimilarPictures(
      usedPictureIds
    );

    // Assign picture1 to team1, picture2 to team2
    const team1PictureId = picture1.id;

    // Store the prediction
    const store = new PredictionStore(process.env.TABLE_NAME || '');
    const prediction = await store.createPrediction({
      team1: request.team1,
      team2: request.team2,
      picture1,
      picture2,
      team1PictureId,
    });

    const response: PredictionResponse = {
      prediction,
    };

    return {
      statusCode: 200,
      headers: corsHeadersFromOrigin(origin, 'application/json'),
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error creating psychic prediction:', error);
    return {
      statusCode: 500,
      headers: corsHeadersFromOrigin(origin, 'application/json'),
      body: JSON.stringify({
        error: 'Failed to create prediction',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
