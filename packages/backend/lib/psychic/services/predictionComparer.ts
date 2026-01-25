import Anthropic from '@anthropic-ai/sdk';
import { PsychicPicture } from '../types/psychic';

/**
 * Service for comparing psychic predictions with actual pictures
 * Uses Claude AI to perform sophisticated image and text comparison
 *
 * This is the core logic for determining if the psychic's description
 * matches one of the two pictures significantly.
 */
export class PredictionComparer {
  private anthropic: Anthropic;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY || '';
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY is required for PredictionComparer');
    }
    this.anthropic = new Anthropic({ apiKey: key });
  }

  /**
   * Fetch image as base64 for Claude API
   */
  private async fetchImageAsBase64(imageUrl: string): Promise<string> {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  }

  /**
   * Compare a psychic's prediction (text and/or sketch) with two pictures
   * Returns the matched team name or null if no significant match
   *
   * @param predictionText - The psychic's text description
   * @param predictionSketchUrl - Optional URL to a sketch drawn by the psychic
   * @param picture1 - First picture
   * @param picture2 - Second picture
   * @returns Object with matchedPictureId and confidence score (0-100)
   */
  async comparePrediction(
    predictionText: string | undefined,
    predictionSketchUrl: string | undefined,
    picture1: PsychicPicture,
    picture2: PsychicPicture
  ): Promise<{ matchedPictureId: string | null; confidenceScore: number }> {
    if (!predictionText && !predictionSketchUrl) {
      return { matchedPictureId: null, confidenceScore: 0 };
    }

    // Build the prompt for Claude
    const systemPrompt = `You are an expert at comparing descriptions and sketches with photographs to determine if they match significantly.

Your task is to analyze a psychic prediction (which may include text description and/or a sketch) and determine which of two provided pictures it matches best, if any.

Rules:
1. A "significant match" means the prediction describes key elements that are clearly present in one picture but not the other
2. Vague or generic descriptions (e.g., "colorful", "outdoor scene") do NOT count as significant matches
3. Specific details matter: colors, objects, compositions, subjects, settings, mood
4. If the prediction could apply equally to both pictures, return NO_MATCH
5. If the prediction clearly describes one picture significantly better than the other, return that picture's ID
6. Provide a confidence score from 0-100 indicating how confident you are in the match

Respond in JSON format:
{
  "matchedPictureId": "picture1" | "picture2" | null,
  "confidenceScore": number (0-100),
  "reasoning": "brief explanation"
}`;

    // Prepare content blocks
    const content: Anthropic.MessageParam[] = [];

    // Add the prediction text if available
    let userMessage = '';
    if (predictionText) {
      userMessage += `Psychic's text prediction:\n"${predictionText}"\n\n`;
    }

    userMessage += `Picture 1 ID: picture1\nPicture 1 description: ${picture1.description || 'No description'}\n\n`;
    userMessage += `Picture 2 ID: picture2\nPicture 2 description: ${picture2.description || 'No description'}\n\n`;

    try {
      // Fetch images
      const [image1Base64, image2Base64] = await Promise.all([
        this.fetchImageAsBase64(picture1.thumbnailUrl || picture1.url),
        this.fetchImageAsBase64(picture2.thumbnailUrl || picture2.url),
      ]);

      // Build message with images
      const messageContent: any[] = [
        {
          type: 'text',
          text: userMessage,
        },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: image1Base64,
          },
        },
        {
          type: 'text',
          text: 'Picture 1 shown above',
        },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: image2Base64,
          },
        },
        {
          type: 'text',
          text: 'Picture 2 shown above',
        },
      ];

      // Add sketch if provided
      if (predictionSketchUrl) {
        const sketchBase64 = await this.fetchImageAsBase64(predictionSketchUrl);
        messageContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: sketchBase64,
          },
        });
        messageContent.push({
          type: 'text',
          text: "Psychic's sketch shown above",
        });
      }

      messageContent.push({
        type: 'text',
        text: 'Analyze the prediction and determine which picture it matches significantly, if any. Respond in JSON format as specified.',
      });

      // Call Claude API
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: messageContent,
          },
        ],
      });

      // Parse response
      const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log('Claude response:', responseText);

      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('Failed to extract JSON from Claude response');
        return { matchedPictureId: null, confidenceScore: 0 };
      }

      const result = JSON.parse(jsonMatch[0]);

      // Map picture1/picture2 to actual IDs
      let matchedPictureId: string | null = null;
      if (result.matchedPictureId === 'picture1') {
        matchedPictureId = picture1.id;
      } else if (result.matchedPictureId === 'picture2') {
        matchedPictureId = picture2.id;
      }

      return {
        matchedPictureId,
        confidenceScore: result.confidenceScore || 0,
      };
    } catch (error) {
      console.error('Error comparing prediction with Claude:', error);
      return { matchedPictureId: null, confidenceScore: 0 };
    }
  }
}
