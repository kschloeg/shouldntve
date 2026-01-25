import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SubmitPredictionRequest, PredictionResponse } from '../types/psychic';
import { PredictionStore } from '../services/predictionStore';
import { PredictionComparer } from '../services/predictionComparer';
import { corsHeadersFromOrigin, getRequestOrigin } from '../../utils/cors';

/**
 * POST /psychic/predict
 *
 * Submits a psychic prediction (text and/or sketch) and compares it
 * with the two pictures to determine if there's a match.
 *
 * Request body:
 * {
 *   "predictionId": "pred_123...",
 *   "predictionText": "I see a blue ocean with waves...",
 *   "predictionSketchUrl": "https://..." // optional
 * }
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Submitting psychic prediction', event);

  const origin = getRequestOrigin(event.headers as Record<string, string>);

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeadersFromOrigin(origin, 'application/json'),
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const request: SubmitPredictionRequest = JSON.parse(event.body);

    if (!request.predictionId) {
      return {
        statusCode: 400,
        headers: corsHeadersFromOrigin(origin, 'application/json'),
        body: JSON.stringify({ error: 'predictionId is required' }),
      };
    }

    if (!request.predictionText && !request.predictionSketchUrl) {
      return {
        statusCode: 400,
        headers: corsHeadersFromOrigin(origin, 'application/json'),
        body: JSON.stringify({
          error: 'At least one of predictionText or predictionSketchUrl is required',
        }),
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

    if (prediction.status !== 'created') {
      return {
        statusCode: 400,
        headers: corsHeadersFromOrigin(origin, 'application/json'),
        body: JSON.stringify({
          error: 'Prediction has already been submitted or revealed',
        }),
      };
    }

    // Compare the prediction with the pictures
    const comparer = new PredictionComparer();
    const { matchedPictureId, confidenceScore } = await comparer.comparePrediction(
      request.predictionText,
      request.predictionSketchUrl,
      prediction.picture1,
      prediction.picture2
    );

    // Determine which team the matched picture corresponds to
    let matchedTeam: string | undefined;
    if (matchedPictureId) {
      if (matchedPictureId === prediction.team1PictureId) {
        matchedTeam = prediction.team1;
      } else {
        matchedTeam = prediction.team2;
      }
    }

    // Update the prediction in the database
    await store.updatePredictionGuess(
      request.predictionId,
      request.predictionText,
      request.predictionSketchUrl,
      matchedTeam,
      confidenceScore
    );

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
    console.error('Error submitting psychic prediction:', error);
    return {
      statusCode: 500,
      headers: corsHeadersFromOrigin(origin, 'application/json'),
      body: JSON.stringify({
        error: 'Failed to submit prediction',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
