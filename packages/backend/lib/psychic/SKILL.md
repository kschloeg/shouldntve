# Psychic Prediction System - SKILL.md

## Overview

This system tests psychic prediction abilities using a controlled double-blind protocol. The core concept is that a psychic attempts to describe a picture they will be shown in the future, without knowing which picture corresponds to which outcome.

## How It Works

### The Protocol

1. **Setup Phase** (Create Prediction):
   - A bettor provides two team names that will compete in an event
   - The system randomly selects two dissimilar pictures from Pexels API
   - Pictures are validated to ensure they differ significantly in:
     - Color (at least 30% difference in average color)
     - Subject matter (less than 50% word overlap in descriptions)
   - Picture 1 is assigned to team 1, picture 2 is assigned to team 2
   - The assignment is stored but hidden from the psychic (pictures are not returned in the API response)

2. **Prediction Phase** (Submit Prediction):
   - The psychic (without seeing the pictures) describes the picture they will be shown
   - The psychic can provide:
     - Text description
     - A sketch/drawing (uploaded image)
     - Both
   - The system uses Claude AI to compare the prediction against both pictures
   - If the prediction significantly matches one picture over the other, that picture's team is returned
   - Otherwise, "no match" is returned

3. **Reveal Phase** (After Event):
   - After the sporting event completes, the bettor enters which team won
   - The system reveals the picture that was assigned to the winning team
   - This happens regardless of whether the prediction was successful
   - The bettor can then verify if the psychic's description matched the revealed picture

### Key Design Principles

- **Double-blind**: The psychic doesn't know which picture corresponds to which team until after the event
- **Random pictures**: Pictures are randomly selected from Pexels to prevent prediction
- **Dissimilarity enforcement**: Pictures must be significantly different to make matching meaningful
- **Objective comparison**: Claude AI (Sonnet 4.5) provides unbiased comparison between prediction and pictures

## File Structure

```
packages/backend/lib/psychic/
├── SKILL.md                          # This file - documentation for LLM sessions
├── README.md                         # Full documentation
├── types/
│   └── psychic.ts                    # TypeScript interfaces and types
├── services/
│   ├── pictureApiClient.ts           # Fetches random pictures from Pexels
│   ├── predictionComparer.ts         # Compares predictions with pictures using Claude
│   └── predictionStore.ts            # Stores predictions in DynamoDB
└── functions/
    ├── postPsychicCreate.ts          # POST /psychic/create - create new prediction
    ├── postPsychicPredict.ts         # POST /psychic/predict - submit psychic guess
    ├── postPsychicReveal.ts          # POST /psychic/reveal - reveal winning picture
    ├── getPsychic.ts                 # GET /psychic/{id} - get specific prediction
    ├── getPsychicList.ts             # GET /psychic - list predictions
    ├── deletePsychic.ts              # DELETE /psychic/{id} - delete prediction
    └── postPsychicTest.ts            # POST /psychic/{id}/test - debug comparison
```

## API Endpoints

### POST /psychic/create

Creates a new prediction session.

**Request:**
```json
{
  "team1": "Minnesota Vikings",
  "team2": "Green Bay Packers"
}
```

**Response:**
```json
{
  "prediction": {
    "id": "pred_1234567890_abc123",
    "createdAt": "2025-01-24T12:00:00Z",
    "updatedAt": "2025-01-24T12:00:00Z",
    "status": "created",
    "team1": "Minnesota Vikings",
    "team2": "Green Bay Packers"
  }
}
```

Note: Pictures are NOT included in the response to prevent the psychic from seeing them.

### POST /psychic/predict

Submits the psychic's prediction and gets comparison result.

**Request:**
```json
{
  "predictionId": "pred_1234567890_abc123",
  "predictionText": "I see mountains with warm orange and red colors, like a sunset. There's a sense of height and elevation.",
  "predictionSketchUrl": "https://..." // optional
}
```

**Response:**
```json
{
  "prediction": {
    "id": "pred_1234567890_abc123",
    "status": "prediction_made",
    "matchedTeam": "Minnesota Vikings",  // or null if no match
    "confidenceScore": 85,
    "reasoning": "The prediction matches picture 1 because...",
    "picture1Analysis": "Picture 1 shows a mountain landscape with orange sunset...",
    "picture2Analysis": "Picture 2 shows ocean waves on a beach...",
    "predictionText": "I see mountains with..."
  }
}
```

Note: Pictures are still hidden at this stage.

The `matchedTeam` field will be:
- Team name (e.g., "Minnesota Vikings") if there's a significant match
- `null` if no significant match is found

### POST /psychic/reveal

Reveals the picture for the winning team after the event.

**Request:**
```json
{
  "predictionId": "pred_1234567890_abc123",
  "winningTeam": "Minnesota Vikings"
}
```

**Response:**
```json
{
  "prediction": {
    "id": "pred_1234567890_abc123",
    "status": "revealed",
    "winningTeam": "Minnesota Vikings",
    "revealedPictureId": "12345",
    "revealedPicture": {
      "id": "12345",
      "url": "https://...",
      "thumbnailUrl": "https://...",
      "description": "Mountain landscape at sunset",
      "photographer": "John Doe",
      "photographerUrl": "https://...",
      "avgColor": "#FF5733"
    }
  }
}
```

Note: Only the revealed picture is returned, not both.

### GET /psychic/{predictionId}

Retrieves a specific prediction. Note: The `team1PictureId` assignment is hidden until after reveal.

### GET /psychic?limit=50

Lists recent predictions.

### DELETE /psychic/{predictionId}

Deletes a prediction.

### POST /psychic/{predictionId}/test

Debug endpoint for testing the AI comparison on an existing prediction.

## LLM Instructions for Using This System

### When Asked to Compare Predictions

If an LLM session needs to compare a psychic's description/sketch with pictures:

1. **Read the prediction data** to get:
   - The psychic's text description
   - The sketch URL (if provided)
   - The two picture URLs and descriptions

2. **Use Claude's vision capabilities** to:
   - View both pictures
   - View the sketch (if provided)
   - Analyze the text description
   - Compare all elements

3. **Apply SALIENT FEATURES matching criteria**:
   - **SALIENT FEATURES** are the most visually striking and memorable aspects:
     - Dominant colors that stand out (e.g., "bright orange" in a dark scene)
     - High contrast elements (e.g., "black and orange")
     - Unusual or distinctive objects
     - Strong compositional elements
   - **COLOR DESCRIPTIONS** count as significant matches when:
     - They describe dominant or striking colors that are visually salient
     - They describe color combinations or contrasts (e.g., "orange and black")
     - One picture has these colors prominently, the other does not
   - The prediction must describe SALIENT features clearly present in ONE picture but not the other
   - Only reject as too vague if extremely generic (e.g., just "colorful" or "nice")

4. **Return structured result**:
   ```json
   {
     "matchedPictureId": "picture1" | "picture2" | null,
     "confidenceScore": 0-100,
     "reasoning": "Explain WHY this matches or doesn't match, focusing on salient features",
     "picture1Analysis": "Brief analysis of picture 1's salient features",
     "picture2Analysis": "Brief analysis of picture 2's salient features"
   }
   ```

### Environment Variables Needed

- `PEXELS_API_KEY`: API key for Pexels (get from https://www.pexels.com/api/)
- `ANTHROPIC_API_KEY`: API key for Claude (for prediction comparison)
- `TABLE_NAME`: DynamoDB table name for storing predictions

### Database Schema

The system uses DynamoDB with the following structure:

**Primary Key:**
- `PK`: `PREDICTION#{predictionId}`
- `SK`: `METADATA`

**GSI1 (for listing):**
- `GSI1PK`: `PREDICTIONS`
- `GSI1SK`: `{createdAt}#{predictionId}`

### Testing the System Locally

To test prediction comparison logic:

```typescript
import { PredictionComparer } from './services/predictionComparer';

const comparer = new PredictionComparer();
const result = await comparer.comparePrediction(
  "I see a mountain with sunset colors",
  undefined, // no sketch
  picture1,
  picture2
);

console.log(result);
// {
//   matchedPictureId: "12345",
//   confidenceScore: 85,
//   reasoning: "The prediction matches...",
//   picture1Analysis: "Picture 1 shows...",
//   picture2Analysis: "Picture 2 shows..."
// }
```

## Future Enhancements

1. **Picture History**: Track used pictures to avoid reusing them in subsequent predictions
2. **Better Dissimilarity Checking**: Use AI to compare semantic similarity of images
3. **Sketch Upload**: Implement direct sketch upload functionality in frontend
4. **Statistics**: Track success rate of predictions over time
5. **Multiple Psychics**: Support multiple users making predictions on the same event

## Important Notes

- Pictures are fetched from Pexels which requires attribution
- The Anthropic API (Claude Sonnet 4.5) is used for sophisticated image comparison
- All predictions are stored permanently for future analysis
- The system is designed for single-person testing (psychic and bettor are the same person)
- Pictures are never returned in API responses until reveal to maintain the double-blind protocol
