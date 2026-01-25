import { PsychicPicture } from '../types/psychic';

/**
 * Client for fetching random pictures from Pexels API
 * https://www.pexels.com/api/documentation/
 */
export class PictureApiClient {
  private readonly PEXELS_API_URL = 'https://api.pexels.com/v1';
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.PEXELS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('PEXELS_API_KEY not set - picture fetching may fail');
    }
  }

  /**
   * Fetch a random curated photo from Pexels
   */
  async fetchRandomPicture(): Promise<PsychicPicture> {
    // Get a random page from curated photos (Pexels has ~100+ pages)
    const randomPage = Math.floor(Math.random() * 100) + 1;
    const perPage = 1;

    const url = `${this.PEXELS_API_URL}/curated?page=${randomPage}&per_page=${perPage}`;

    const response = await fetch(url, {
      headers: {
        Authorization: this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.photos || data.photos.length === 0) {
      throw new Error('No photos returned from Pexels API');
    }

    const photo = data.photos[0];

    return {
      id: photo.id.toString(),
      url: photo.src.original,
      thumbnailUrl: photo.src.medium,
      description: photo.alt || '',
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url,
      avgColor: photo.avg_color,
    };
  }

  /**
   * Calculate color similarity between two hex colors
   * Returns a value between 0 (identical) and 1 (very different)
   */
  private colorDistance(color1: string, color2: string): number {
    // Convert hex to RGB
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
          }
        : { r: 0, g: 0, b: 0 };
    };

    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);

    // Calculate Euclidean distance in RGB space, normalized to 0-1
    const distance = Math.sqrt(
      Math.pow(rgb1.r - rgb2.r, 2) +
        Math.pow(rgb1.g - rgb2.g, 2) +
        Math.pow(rgb1.b - rgb2.b, 2)
    );

    // Max possible distance in RGB space is sqrt(255^2 * 3) ≈ 441
    return distance / 441;
  }

  /**
   * Check if two pictures are dissimilar enough
   * Returns true if they are sufficiently different
   */
  arePicturesDissimilar(picture1: PsychicPicture, picture2: PsychicPicture): boolean {
    // Check color similarity
    if (picture1.avgColor && picture2.avgColor) {
      const colorDist = this.colorDistance(picture1.avgColor, picture2.avgColor);
      // Require at least 30% color difference
      if (colorDist < 0.3) {
        console.log(`Pictures rejected: colors too similar (${colorDist})`);
        return false;
      }
    }

    // Check if descriptions are too similar (basic check)
    if (picture1.description && picture2.description) {
      const desc1 = picture1.description.toLowerCase();
      const desc2 = picture2.description.toLowerCase();

      // Simple word overlap check
      const words1 = new Set(desc1.split(/\s+/));
      const words2 = new Set(desc2.split(/\s+/));

      const intersection = new Set([...words1].filter(x => words2.has(x)));
      const union = new Set([...words1, ...words2]);

      const similarity = intersection.size / union.size;

      // Require less than 50% word overlap
      if (similarity > 0.5) {
        console.log(`Pictures rejected: descriptions too similar (${similarity})`);
        return false;
      }
    }

    return true;
  }

  /**
   * Fetch two dissimilar pictures for a prediction
   * Will retry up to maxAttempts times to find dissimilar pictures
   */
  async fetchTwoDissimilarPictures(
    usedPictureIds: Set<string> = new Set(),
    maxAttempts: number = 10
  ): Promise<[PsychicPicture, PsychicPicture]> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;

      try {
        // Fetch first picture
        let picture1 = await this.fetchRandomPicture();

        // Ensure it's not a used picture
        let retries = 0;
        while (usedPictureIds.has(picture1.id) && retries < 5) {
          picture1 = await this.fetchRandomPicture();
          retries++;
        }

        // Fetch second picture
        let picture2 = await this.fetchRandomPicture();

        // Ensure it's not the same as picture1 or a used picture
        retries = 0;
        while (
          (picture2.id === picture1.id || usedPictureIds.has(picture2.id)) &&
          retries < 5
        ) {
          picture2 = await this.fetchRandomPicture();
          retries++;
        }

        // Check if they are dissimilar
        if (this.arePicturesDissimilar(picture1, picture2)) {
          console.log(`Found dissimilar pictures after ${attempts} attempts`);
          return [picture1, picture2];
        }
      } catch (error) {
        console.error(`Error fetching pictures (attempt ${attempts}):`, error);
        if (attempts === maxAttempts) {
          throw error;
        }
      }
    }

    throw new Error(`Failed to find dissimilar pictures after ${maxAttempts} attempts`);
  }
}
