import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { LlmModel } from '../types/psychic';

/**
 * Service for generating blind psychic predictions using various LLM models.
 * The LLM does NOT see the pictures - it generates a prediction purely based
 * on intuition/randomness, just like a human psychic would in a blind test.
 */
export class LlmPredictionGenerator {
  private anthropic: Anthropic | null = null;
  private gemini: GoogleGenerativeAI | null = null;
  private openai: OpenAI | null = null;

  constructor() {
    // Initialize clients lazily based on available API keys
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    if (process.env.GOOGLE_AI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    }
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
  }

  /**
   * Generate a blind psychic prediction using the specified LLM model.
   * The LLM has no information about the picture - it generates a prediction
   * purely based on "psychic intuition".
   */
  async generatePrediction(model: LlmModel): Promise<string> {
    const systemPrompt = `You are a psychic with strong precognitive abilities. A photograph will be revealed to you in the future. Using your psychic powers, describe what you sense this photograph will show.

Your prediction can take different forms:
- A vivid, descriptive vision with rich details about the scene, mood, and atmosphere
- An abstract impression focusing on dominant colors, salient shapes, or key visual features
- A combination of both concrete and abstract elements

RULES:
1. Describe what you sense the photograph will show
2. Write as if you are genuinely experiencing a psychic vision
3. Keep your prediction to 1-3 sentences
4. Be confident and specific - do NOT hedge or mention multiple possibilities
5. Do NOT mention that you are guessing or making a prediction

Example vivid prediction: "A vast ocean under golden sunset light. There's a sense of peaceful solitude."
Example abstract prediction: "Strong blue dominates with vertical dark lines cutting through. There's a sense of height and openness."
Now focus your psychic abilities and describe what you sense the photograph will show.`;

    switch (model) {
      case 'claude-4.5':
        return this.generateWithClaude(systemPrompt);
      case 'gemini-3':
        return this.generateWithGemini(systemPrompt);
      case 'gpt-5':
        return this.generateWithGpt(systemPrompt);
      default:
        throw new Error(`Unsupported model: ${model}`);
    }
  }

  private async generateWithClaude(systemPrompt: string): Promise<string> {
    if (!this.anthropic) {
      throw new Error('Anthropic API key not configured');
    }

    console.log(
      '[LlmPredictionGenerator] Generating blind prediction with Claude'
    );

    const response = await this.anthropic.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content:
            'Generate your psychic prediction now. Describe what you sense the photograph will show.',
        },
      ],
    });

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';
    console.log('[LlmPredictionGenerator] Claude response:', text);
    return text;
  }

  private async generateWithGemini(systemPrompt: string): Promise<string> {
    if (!this.gemini) {
      throw new Error('Google AI API key not configured');
    }

    console.log(
      '[LlmPredictionGenerator] Generating blind prediction with Gemini'
    );

    const model = this.gemini.getGenerativeModel({
      model: 'gemini-2.5-pro-preview-05-06',
    });

    const result = await model.generateContent([
      systemPrompt,
      'Generate your psychic prediction now. Describe what you sense the photograph will show.',
    ]);

    const text = result.response.text();
    console.log('[LlmPredictionGenerator] Gemini response:', text);
    return text;
  }

  private async generateWithGpt(systemPrompt: string): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    console.log(
      '[LlmPredictionGenerator] Generating blind prediction with GPT'
    );

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4.1',
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content:
            'Generate your psychic prediction now. Describe what you sense the photograph will show.',
        },
      ],
    });

    const text = response.choices[0]?.message?.content || '';
    console.log('[LlmPredictionGenerator] GPT response:', text);
    return text;
  }
}
