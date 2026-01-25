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
  private static readonly VERSION = '1.0.3'; // Increment this with each change

  constructor(apiKey?: string) {
    console.log(`[PredictionComparer v${PredictionComparer.VERSION}] Initializing`);
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
  ): Promise<{
    matchedPictureId: string | null;
    confidenceScore: number;
    reasoning?: string;
    picture1Analysis?: string;
    picture2Analysis?: string;
  }> {
    console.log(`[PredictionComparer v${PredictionComparer.VERSION}] Starting comparison`);
    console.log(`Prediction text: "${predictionText}"`);
    console.log(`Picture 1: ${picture1.id} - ${picture1.description}`);
    console.log(`Picture 2: ${picture2.id} - ${picture2.description}`);

    if (!predictionText && !predictionSketchUrl) {
      console.log('[PredictionComparer] No prediction text or sketch provided');
      return { matchedPictureId: null, confidenceScore: 0 };
    }

    // Build the prompt for Claude
    const systemPrompt = `You are an expert at comparing psychic predictions with photographs to determine if they match significantly.

Your task is to analyze a psychic prediction (which may include text description and/or a sketch) and determine which of two provided pictures it matches best, if any.

IMPORTANT - Matching Criteria:
1. SALIENT FEATURES are the most visually striking and memorable aspects of an image:
   - Dominant colors that stand out (e.g., "bright orange" in a dark scene)
   - High contrast elements (e.g., "black and orange")
   - Unusual or distinctive objects
   - Strong compositional elements
   - Memorable subjects or focal points

2. A "significant match" means the prediction describes SALIENT features that are:
   - Clearly present and prominent in one picture
   - NOT present OR less prominent in the other picture
   - Specific enough to distinguish between the two images

3. COLOR DESCRIPTIONS count as significant matches when:
   - They describe dominant or striking colors that are visually salient
   - They describe color combinations or contrasts (e.g., "orange and black")
   - One picture has these colors prominently, the other does not
   - Example: "bright orange" DOES match a picture with prominent orange lighting/objects

4. REJECT as too vague only if:
   - The description is extremely generic (e.g., just "colorful" or "nice")
   - Both pictures equally match the description
   - No distinguishing details are provided

5. Provide confidence score 0-100 based on:
   - How well the prediction matches salient features
   - How distinctive the match is between the two pictures
   - Higher confidence for specific salient features that clearly distinguish

Respond in JSON format:
{
  "matchedPictureId": "picture1" | "picture2" | null,
  "confidenceScore": number (0-100),
  "reasoning": "Explain WHY this matches or doesn't match, focusing on salient features",
  "picture1Analysis": "Brief analysis of picture 1's salient features",
  "picture2Analysis": "Brief analysis of picture 2's salient features"
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
      console.log('[PredictionComparer] Fetching images...');
      // Fetch images
      const [image1Base64, image2Base64] = await Promise.all([
        this.fetchImageAsBase64(picture1.thumbnailUrl || picture1.url),
        this.fetchImageAsBase64(picture2.thumbnailUrl || picture2.url),
      ]);
      console.log('[PredictionComparer] Images fetched successfully');

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
      console.log('[PredictionComparer] Calling Claude API with model: claude-sonnet-4-5-20250929');
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: messageContent,
          },
        ],
      });
      console.log('[PredictionComparer] Claude API call successful');

      // Parse response
      const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log('[PredictionComparer] Claude response:', responseText);

      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[PredictionComparer] ERROR: Failed to extract JSON from Claude response');
        console.error('[PredictionComparer] Response was:', responseText);
        return {
          matchedPictureId: null,
          confidenceScore: 0,
          reasoning: 'Error: Could not parse Claude response',
          picture1Analysis: 'Error parsing response',
          picture2Analysis: 'Error parsing response'
        };
      }

      console.log('[PredictionComparer] Parsing JSON:', jsonMatch[0]);
      const result = JSON.parse(jsonMatch[0]);
      console.log('[PredictionComparer] Parsed result:', JSON.stringify(result, null, 2));

      // Map picture1/picture2 to actual IDs
      let matchedPictureId: string | null = null;
      if (result.matchedPictureId === 'picture1') {
        matchedPictureId = picture1.id;
      } else if (result.matchedPictureId === 'picture2') {
        matchedPictureId = picture2.id;
      }

      const finalResult = {
        matchedPictureId,
        confidenceScore: result.confidenceScore || 0,
        reasoning: result.reasoning,
        picture1Analysis: result.picture1Analysis,
        picture2Analysis: result.picture2Analysis,
      };

      console.log('[PredictionComparer] Final result:', JSON.stringify(finalResult, null, 2));
      return finalResult;
    } catch (error) {
      console.error('[PredictionComparer] CRITICAL ERROR:', error);
      console.error('[PredictionComparer] Error stack:', error instanceof Error ? error.stack : 'No stack trace');

      // Return error information in the response so we can see what went wrong
      return {
        matchedPictureId: null,
        confidenceScore: 0,
        reasoning: `Error: ${error instanceof Error ? error.message : String(error)}`,
        picture1Analysis: 'Error occurred during comparison',
        picture2Analysis: 'Error occurred during comparison'
      };
    }
  }
}
