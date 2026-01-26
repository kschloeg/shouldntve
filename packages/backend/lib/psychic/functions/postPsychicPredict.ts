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
const VERSION = '1.0.4'; // Increment this with each deploy

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log(`[postPsychicPredict v${VERSION}] Starting request`);
  console.log('Event:', JSON.stringify(event, null, 2));

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
    console.log('[postPsychicPredict] Creating PredictionComparer...');
    const comparer = new PredictionComparer();

    console.log('[postPsychicPredict] Calling comparePrediction...');
    const comparisonResult = await comparer.comparePrediction(
      request.predictionText,
      request.predictionSketchUrl,
      prediction.picture1,
      prediction.picture2
    );

    console.log('[postPsychicPredict] Comparison result:', JSON.stringify(comparisonResult, null, 2));

    const { matchedPictureId, confidenceScore, reasoning, picture1Analysis, picture2Analysis } = comparisonResult;

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
    console.log('[postPsychicPredict] Updating prediction in database...');
    console.log('[postPsychicPredict] Matched team:', matchedTeam);
    console.log('[postPsychicPredict] Confidence:', confidenceScore);
    console.log('[postPsychicPredict] Reasoning:', reasoning);
    console.log('[postPsychicPredict] Picture1Analysis:', picture1Analysis);
    console.log('[postPsychicPredict] Picture2Analysis:', picture2Analysis);

    await store.updatePredictionGuess(
      request.predictionId,
      request.predictionText,
      request.predictionSketchUrl,
      matchedTeam,
      confidenceScore,
      reasoning,
      picture1Analysis,
      picture2Analysis
    );

    console.log('[postPsychicPredict] Database update complete');

    // Get the updated prediction
    const updatedPrediction = await store.getPrediction(request.predictionId);

    // Remove picture data to prevent psychic from seeing pictures
    const { picture1, picture2, ...predictionWithoutPictures } = updatedPrediction!;

    const response: PredictionResponse = {
      prediction: predictionWithoutPictures as any,
    };

    console.log('[postPsychicPredict] Sending response:', JSON.stringify(response, null, 2));

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
