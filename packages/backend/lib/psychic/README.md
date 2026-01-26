# Psychic Prediction System

A system for testing psychic prediction abilities using a controlled double-blind protocol with random picture selection and AI-powered comparison.

## Overview

This system allows a person to test their psychic abilities by attempting to predict which picture they will be shown after a future event (such as a sporting event). The process is designed to be double-blind and objective.

### How It Works

1. **Setup**: The bettor enters two team names that will compete
2. **Picture Selection**: The system randomly selects two dissimilar pictures from Pexels
3. **Random Assignment**: Each picture is randomly assigned to one of the teams (hidden from the psychic)
4. **Prediction**: The psychic describes the picture they will be shown (without seeing either picture)
5. **AI Comparison**: Claude AI compares the prediction to both pictures to determine if there's a significant match
6. **Event Completion**: After the sporting event, the bettor enters which team won
7. **Reveal**: The system shows the picture that was assigned to the winning team

### Key Features

- **Double-blind protocol**: The psychic doesn't know which picture corresponds to which team
- **Random assignment**: Pictures are randomly assigned to prevent bias
- **Dissimilarity enforcement**: Pictures must differ by at least 30% in color and 50% in subject matter
- **Objective comparison**: AI provides unbiased analysis of prediction vs. pictures
- **No peeking**: Pictures are only shown after the prediction is submitted

## File Structure

```
packages/backend/lib/psychic/
├── README.md                         # This file
├── SKILL.md                          # Technical documentation for LLM sessions
├── types/
│   └── psychic.ts                    # TypeScript interfaces and types
├── services/
│   ├── pictureApiClient.ts           # Fetches random pictures from Pexels API
│   ├── predictionComparer.ts         # Compares predictions using Claude AI
│   └── predictionStore.ts            # Stores predictions in DynamoDB
└── functions/
    ├── postPsychicCreate.ts          # POST /psychic/create
    ├── postPsychicPredict.ts         # POST /psychic/predict
    ├── postPsychicReveal.ts          # POST /psychic/reveal
    ├── getPsychic.ts                 # GET /psychic/{id}
    ├── getPsychicList.ts             # GET /psychic
    ├── deletePsychic.ts              # DELETE /psychic/{id}
    └── postPsychicTest.ts            # POST /psychic/{id}/test (debugging)
```

## Frontend

The frontend UI is located at:
- **File**: `packages/frontend/src/components/PsychicPage.tsx`
- **URL**: `https://shouldntve.com/psychic`

The UI provides a three-step wizard:
1. Create Prediction - Enter team names
2. Make Prediction - Describe the picture you will be shown
3. Reveal Result - Enter winning team and see the picture

## API Endpoints

### POST /psychic/create

Creates a new prediction session with two teams.

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
    "status": "created",
    "team1": "Minnesota Vikings",
    "team2": "Green Bay Packers",
    "createdAt": "2025-01-24T12:00:00Z",
    "updatedAt": "2025-01-24T12:00:00Z"
  }
}
```

Note: Pictures are NOT returned in the create response to prevent the psychic from seeing them before making their prediction.

### POST /psychic/predict

Submits the psychic's prediction.

**Request:**
```json
{
  "predictionId": "pred_1234567890_abc123",
  "predictionText": "I see mountains with orange sunset colors...",
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
    "picture1Analysis": "Analysis of picture 1's salient features",
    "picture2Analysis": "Analysis of picture 2's salient features"
  }
}
```

Note: Pictures are still hidden from the response at this stage.

### POST /psychic/reveal

Reveals the picture for the winning team.

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

Note: Only the revealed picture is returned, not both pictures.

### GET /psychic/{predictionId}

Retrieves a specific prediction. Note: team assignments are hidden until reveal.

### GET /psychic

Lists recent predictions (up to 50).

### DELETE /psychic/{predictionId}

Deletes a prediction.

### POST /psychic/{predictionId}/test

Debug endpoint for testing the AI comparison on an existing prediction. Useful for debugging comparison logic.

## Environment Variables

The following environment variables must be set:

```bash
# Pexels API for random pictures
PEXELS_API_KEY=your_pexels_api_key

# Anthropic API for AI comparison
ANTHROPIC_API_KEY=your_anthropic_api_key

# Frontend origin for CORS
FRONTEND_ORIGIN=https://shouldntve.com
```

### Getting API Keys

1. **Pexels API Key**:
   - Sign up at https://www.pexels.com/api/
   - Free tier provides 200 requests per hour
   - Required for fetching random pictures

2. **Anthropic API Key**:
   - Sign up at https://console.anthropic.com/
   - Required for AI-powered prediction comparison
   - Uses Claude Sonnet 4.5 for vision capabilities

## Database Schema

The system uses a DynamoDB table `PsychicPredictionsTable` with the following structure:

**Primary Key:**
- `PK`: `PREDICTION#{predictionId}`
- `SK`: `METADATA`

**Global Secondary Index (GSI1):**
- `GSI1PK`: `PREDICTIONS`
- `GSI1SK`: `{createdAt}#{predictionId}`

**Attributes:**
- `id`: Unique prediction ID
- `createdAt`, `updatedAt`: Timestamps
- `status`: `created` | `prediction_made` | `revealed` | `expired`
- `team1`, `team2`: Team names
- `picture1`, `picture2`: Picture objects with URLs and metadata
- `team1PictureId`: ID of picture assigned to team1 (hidden until reveal)
- `predictionText`: Psychic's text description
- `predictionSketchUrl`: Optional sketch URL
- `matchedTeam`: Team that matched the prediction (if any)
- `confidenceScore`: AI confidence score (0-100)
- `reasoning`: AI explanation of why the prediction matched or didn't match
- `picture1Analysis`: AI analysis of picture 1's salient features
- `picture2Analysis`: AI analysis of picture 2's salient features
- `winningTeam`: Team that won the event
- `revealedPictureId`: Picture shown after reveal

## How Picture Dissimilarity Works

The system ensures pictures are significantly different using two criteria:

### 1. Color Distance
- Calculates Euclidean distance between average colors in RGB space
- Requires at least 30% difference
- Example: A blue ocean (#3498DB) vs. orange sunset (#FF5733)

### 2. Description Similarity
- Compares word overlap in picture descriptions
- Requires less than 50% word overlap
- Example: "Mountain landscape at sunset" vs. "Ocean waves on beach"

If pictures are too similar, the system automatically fetches new ones (up to 10 attempts).

## How AI Comparison Works

The `PredictionComparer` service uses Claude AI to:

1. **Analyze the prediction**: Review text description and optional sketch
2. **View both pictures**: Download and encode images for vision analysis
3. **Compare elements**: Look for specific matches (colors, objects, composition, mood)
4. **Apply strict criteria**: Generic descriptions don't count as matches
5. **Return result**: Picture ID (if significant match) and confidence score

### What Counts as a Match?

✅ **Good matches:**
- "Orange and red sunset colors with mountains" → Sunset mountain picture
- "Blue water with waves" → Ocean beach picture
- "Person wearing red jacket in snow" → Person in red jacket on ski slope

❌ **Not significant matches:**
- "Colorful scene" → Too generic
- "Outdoor setting" → Too vague
- "Bright and vibrant" → Applies to many pictures

## Usage Example

### Using the Web UI

1. Navigate to `https://shouldntve.com/psychic`
2. Enter two competing teams (e.g., "Vikings" vs. "Packers")
3. Click "Create Prediction"
4. WITHOUT looking at the pictures, describe what you think you'll be shown
5. Click "Submit Prediction"
6. After the game, select the winning team
7. Click "Reveal Picture" to see if your prediction was correct

### Using the API

```typescript
// 1. Create prediction
const createResponse = await fetch('/psychic/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    team1: 'Minnesota Vikings',
    team2: 'Green Bay Packers'
  })
});
const { prediction } = await createResponse.json();

// 2. Submit prediction (WITHOUT looking at pictures)
const predictResponse = await fetch('/psychic/predict', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    predictionId: prediction.id,
    predictionText: 'I see mountains with warm orange sunset colors...'
  })
});
const { prediction: updated } = await predictResponse.json();

// Check if there was a match
if (updated.matchedTeam) {
  console.log(`Matched team: ${updated.matchedTeam}`);
  console.log(`Confidence: ${updated.confidenceScore}%`);
}

// 3. After the game, reveal the picture
const revealResponse = await fetch('/psychic/reveal', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    predictionId: prediction.id,
    winningTeam: 'Minnesota Vikings'
  })
});
const { prediction: revealed } = await revealResponse.json();

// The revealed picture is shown in the UI
```

## Deployment

The psychic system is deployed as part of the main backend stack:

```bash
# From packages/backend directory
npm run build
npm run cdk deploy
```

Make sure to set environment variables in `.env`:
```bash
PEXELS_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
FRONTEND_ORIGIN=https://shouldntve.com
```

## Testing Locally

To test the prediction comparison logic without deploying:

```typescript
import { PredictionComparer } from './services/predictionComparer';

const comparer = new PredictionComparer();
const result = await comparer.comparePrediction(
  "I see a mountain with sunset colors and warm tones",
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

- [ ] Track used pictures to avoid reusing them
- [ ] Support sketch upload directly in the UI
- [ ] Add statistics page showing success rate over time
- [ ] Support multiple users making predictions on the same event
- [ ] Add ability to share predictions with others
- [ ] Implement semantic image similarity for better dissimilarity checking
- [ ] Add prediction history and analytics

## License

This is part of the shouldntve.com project.

## Attribution

Pictures are provided by [Pexels](https://www.pexels.com/) and require attribution. Each picture includes photographer information that is displayed in the UI.

AI comparison is powered by [Anthropic's Claude](https://www.anthropic.com/).
