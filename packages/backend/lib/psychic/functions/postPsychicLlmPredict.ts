import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  LlmPredictionRequest,
  LlmPredictionResponse,
  LlmModel,
} from '../types/psychic';
import { PredictionStore } from '../services/predictionStore';
import { PredictionComparer } from '../services/predictionComparer';
import { LlmPredictionGenerator } from '../services/llmPredictionGenerator';
import { corsHeadersFromOrigin, getRequestOrigin } from '../../utils/cors';
import { requireAuth } from '../../utils/authHelpers';

const VALID_MODELS: LlmModel[] = ['claude-4.5', 'gemini-3', 'gpt-5'];

/**
 * POST /psychic/llm-predict
 *
 * Generates a psychic prediction using an LLM model and then compares it
 * with the two pictures to determine if there's a match.
 *
 * Request body:
 * {
 *   "predictionId": "pred_123...",
 *   "model": "claude-4.5" | "gemini-3" | "gpt-5"
 * }
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('[postPsychicLlmPredict] Starting request');
  console.log('Event:', JSON.stringify(event, null, 2));

  const origin = getRequestOrigin(event.headers as Record<string, string>);

  const auth = await requireAuth(
    event.headers as Record<string, string>,
    origin
  );
  if (!auth.authorized) return auth.response;

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeadersFromOrigin(origin, 'application/json'),
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const request: LlmPredictionRequest = JSON.parse(event.body);

    if (!request.predictionId) {
      return {
        statusCode: 400,
        headers: corsHeadersFromOrigin(origin, 'application/json'),
        body: JSON.stringify({ error: 'predictionId is required' }),
      };
    }

    if (!request.model || !VALID_MODELS.includes(request.model)) {
      return {
        statusCode: 400,
        headers: corsHeadersFromOrigin(origin, 'application/json'),
        body: JSON.stringify({
          error: `model must be one of: ${VALID_MODELS.join(', ')}`,
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

    // Generate blind prediction using selected LLM (no pictures shown to AI)
    console.log(
      `[postPsychicLlmPredict] Generating blind prediction with ${request.model}`
    );
    const generator = new LlmPredictionGenerator();
    const generatedText = await generator.generatePrediction(request.model);

    console.log('[postPsychicLlmPredict] Generated text:', generatedText);

    // Compare the generated prediction with the pictures
    console.log('[postPsychicLlmPredict] Creating PredictionComparer...');
    const comparer = new PredictionComparer();

    console.log('[postPsychicLlmPredict] Calling comparePrediction...');
    const comparisonResult = await comparer.comparePrediction(
      generatedText,
      undefined,
      prediction.picture1,
      prediction.picture2
    );

    console.log(
      '[postPsychicLlmPredict] Comparison result:',
      JSON.stringify(comparisonResult, null, 2)
    );

    const {
      matchedPictureId,
      confidenceScore,
      reasoning,
      picture1Analysis,
      picture2Analysis,
    } = comparisonResult;

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
    console.log('[postPsychicLlmPredict] Updating prediction in database...');
    await store.updatePredictionGuess(
      request.predictionId,
      generatedText,
      undefined,
      matchedTeam,
      confidenceScore,
      reasoning,
      picture1Analysis,
      picture2Analysis,
      request.model
    );

    console.log('[postPsychicLlmPredict] Database update complete');

    // Get the updated prediction
    const updatedPrediction = await store.getPrediction(request.predictionId);

    // Remove picture data to prevent psychic from seeing pictures
    const { picture1, picture2, ...predictionWithoutPictures } =
      updatedPrediction!;

    const response: LlmPredictionResponse = {
      prediction: predictionWithoutPictures as any,
      llmModel: request.model,
      generatedText,
    };

    console.log('[postPsychicLlmPredict] Sending response');

    return {
      statusCode: 200,
      headers: corsHeadersFromOrigin(origin, 'application/json'),
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error generating LLM psychic prediction:', error);
    return {
      statusCode: 500,
      headers: corsHeadersFromOrigin(origin, 'application/json'),
      body: JSON.stringify({
        error: 'Failed to generate prediction',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
