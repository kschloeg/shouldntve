import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { PsychicPrediction, PredictionStatus } from '../types/psychic';

/**
 * Service for storing and retrieving psychic predictions from DynamoDB
 */
export class PredictionStore {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(tableName: string) {
    const client = new DynamoDBClient({});
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = tableName;
  }

  /**
   * Generate a unique prediction ID
   */
  private generatePredictionId(): string {
    return `pred_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Create a new prediction
   */
  async createPrediction(prediction: Omit<PsychicPrediction, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<PsychicPrediction> {
    const id = this.generatePredictionId();
    const now = new Date().toISOString();

    const newPrediction: PsychicPrediction = {
      ...prediction,
      id,
      createdAt: now,
      updatedAt: now,
      status: 'created',
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `PREDICTION#${id}`,
          SK: `METADATA`,
          ...newPrediction,
        },
      })
    );

    return newPrediction;
  }

  /**
   * Get a prediction by ID
   */
  async getPrediction(predictionId: string): Promise<PsychicPrediction | null> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `PREDICTION#${predictionId}`,
          SK: `METADATA`,
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    const { PK, SK, ...prediction } = result.Item;
    return prediction as PsychicPrediction;
  }

  /**
   * Update prediction with psychic's guess
   */
  async updatePredictionGuess(
    predictionId: string,
    predictionText: string | undefined,
    predictionSketchUrl: string | undefined,
    matchedTeam: string | undefined,
    confidenceScore: number
  ): Promise<void> {
    const now = new Date().toISOString();

    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `PREDICTION#${predictionId}`,
          SK: `METADATA`,
        },
        UpdateExpression:
          'SET #status = :status, predictionText = :predictionText, predictionSketchUrl = :predictionSketchUrl, ' +
          'predictionTimestamp = :predictionTimestamp, matchedTeam = :matchedTeam, confidenceScore = :confidenceScore, ' +
          'updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'prediction_made' as PredictionStatus,
          ':predictionText': predictionText || null,
          ':predictionSketchUrl': predictionSketchUrl || null,
          ':predictionTimestamp': now,
          ':matchedTeam': matchedTeam || null,
          ':confidenceScore': confidenceScore,
          ':updatedAt': now,
        },
      })
    );
  }

  /**
   * Reveal the winning team's picture
   */
  async revealPrediction(
    predictionId: string,
    winningTeam: string,
    revealedPictureId: string
  ): Promise<void> {
    const now = new Date().toISOString();

    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `PREDICTION#${predictionId}`,
          SK: `METADATA`,
        },
        UpdateExpression:
          'SET #status = :status, winningTeam = :winningTeam, revealedPictureId = :revealedPictureId, ' +
          'revealTimestamp = :revealTimestamp, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'revealed' as PredictionStatus,
          ':winningTeam': winningTeam,
          ':revealedPictureId': revealedPictureId,
          ':revealTimestamp': now,
          ':updatedAt': now,
        },
      })
    );
  }

  /**
   * List recent predictions
   */
  async listPredictions(limit: number = 50): Promise<PsychicPrediction[]> {
    // Note: This will need a GSI in production for efficient querying
    // For now, we'll use a scan which works for small datasets
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1', // This would need to be created
        KeyConditionExpression: 'GSI1PK = :gsi1pk',
        ExpressionAttributeValues: {
          ':gsi1pk': 'PREDICTIONS',
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit,
      })
    );

    if (!result.Items) {
      return [];
    }

    return result.Items.map((item) => {
      const { PK, SK, GSI1PK, GSI1SK, ...prediction } = item;
      return prediction as PsychicPrediction;
    });
  }
}
