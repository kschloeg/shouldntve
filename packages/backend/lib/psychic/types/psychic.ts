/**
 * Types for the Psychic Prediction System
 *
 * This system tests psychic prediction abilities by:
 * 1. Randomly selecting two dissimilar pictures
 * 2. Assigning each picture to a competing team
 * 3. Having a psychic describe the picture they will be shown
 * 4. Comparing the description to the pictures
 * 5. After the event, revealing the picture associated with the winning team
 */

/**
 * Represents a picture used in a psychic prediction
 */
export interface PsychicPicture {
  id: string;
  url: string;
  thumbnailUrl?: string;
  description?: string;
  photographer?: string;
  photographerUrl?: string;
  avgColor?: string;
  dominantColors?: string[];
  tags?: string[];
}

/**
 * Status of a psychic prediction session
 */
export type PredictionStatus = 'created' | 'prediction_made' | 'revealed' | 'expired';

/**
 * A psychic prediction session
 */
export interface PsychicPrediction {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: PredictionStatus;

  // Teams competing
  team1: string;
  team2: string;

  // Pictures assigned to each team
  picture1: PsychicPicture;
  picture2: PsychicPicture;

  // Which picture is assigned to which team (hidden from psychic until reveal)
  team1PictureId: string; // either picture1.id or picture2.id

  // Psychic's prediction
  predictionText?: string;
  predictionSketchUrl?: string;
  predictionTimestamp?: string;

  // Comparison result
  matchedTeam?: string; // team1 or team2, or undefined if no match
  confidenceScore?: number; // 0-100
  reasoning?: string; // Why this matched or didn't match
  picture1Analysis?: string; // Analysis of picture 1's salient features
  picture2Analysis?: string; // Analysis of picture 2's salient features

  // Final reveal
  winningTeam?: string;
  revealedPictureId?: string;
  revealTimestamp?: string;
}

/**
 * Request to create a new psychic prediction
 */
export interface CreatePredictionRequest {
  team1: string;
  team2: string;
}

/**
 * Request to submit a psychic prediction
 */
export interface SubmitPredictionRequest {
  predictionId: string;
  predictionText?: string;
  predictionSketchUrl?: string;
}

/**
 * Request to reveal the winning team's picture
 */
export interface RevealPredictionRequest {
  predictionId: string;
  winningTeam: string;
}

/**
 * Response with prediction details
 */
export interface PredictionResponse {
  prediction: PsychicPrediction;
}

/**
 * Response with list of predictions
 */
export interface ListPredictionsResponse {
  predictions: PsychicPrediction[];
  count: number;
}
