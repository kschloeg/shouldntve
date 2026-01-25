import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PredictionStore } from '../services/predictionStore';
import { PredictionComparer } from '../services/predictionComparer';
import { corsHeadersFromOrigin, getRequestOrigin } from '../../utils/cors';

/**
 * POST /psychic/{predictionId}/test
 *
 * Tests a prediction against the pictures without saving to database.
 * Used for the edit/test page.
 *
 * Request body:
 * {
 *   "predictionText": "I see a blue ocean with waves..."
 * }
 */
const VERSION = '1.0.3'; // Increment this with each deploy

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log(`[postPsychicTest v${VERSION}] Starting request`);
  console.log('Event:', JSON.stringify(event, null, 2));

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

    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeadersFromOrigin(origin, 'application/json'),
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const request = JSON.parse(event.body);

    if (!request.predictionText) {
      return {
        statusCode: 400,
        headers: corsHeadersFromOrigin(origin, 'application/json'),
        body: JSON.stringify({ error: 'predictionText is required' }),
      };
    }

    // Get the prediction from the database
    const store = new PredictionStore(process.env.TABLE_NAME || '');
    const prediction = await store.getPrediction(predictionId);

    if (!prediction) {
      return {
        statusCode: 404,
        headers: corsHeadersFromOrigin(origin, 'application/json'),
        body: JSON.stringify({ error: 'Prediction not found' }),
      };
    }

    // Compare the prediction with the pictures
    console.log('[postPsychicTest] Creating PredictionComparer...');
    const comparer = new PredictionComparer();

    console.log('[postPsychicTest] Calling comparePrediction...');
    const comparisonResult = await comparer.comparePrediction(
      request.predictionText,
      undefined,
      prediction.picture1,
      prediction.picture2
    );

    console.log('[postPsychicTest] Comparison result:', JSON.stringify(comparisonResult, null, 2));

    // Return the comparison result directly (don't save to database)
    return {
      statusCode: 200,
      headers: corsHeadersFromOrigin(origin, 'application/json'),
      body: JSON.stringify(comparisonResult),
    };
  } catch (error) {
    console.error('Error testing psychic prediction:', error);
    return {
      statusCode: 500,
      headers: corsHeadersFromOrigin(origin, 'application/json'),
      body: JSON.stringify({
        error: 'Failed to test prediction',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
