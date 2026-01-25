import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/apiClient';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Grid from '@mui/material/Grid';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Layout from './Layout';
import { useSnackbar } from './snackbarContext';

interface PsychicPicture {
  id: string;
  url: string;
  thumbnailUrl?: string;
  description?: string;
  photographer?: string;
  photographerUrl?: string;
  avgColor?: string;
}

interface PsychicPrediction {
  id: string;
  createdAt: string;
  status: 'created' | 'prediction_made' | 'revealed' | 'expired';
  team1: string;
  team2: string;
  picture1: PsychicPicture;
  picture2: PsychicPicture;
  team1PictureId?: string;
}

interface TestResult {
  matchedPictureId: string | null;
  confidenceScore: number;
  reasoning?: string;
  picture1Analysis?: string;
  picture2Analysis?: string;
}

export default function PsychicEditPage() {
  const { predictionId } = useParams<{ predictionId: string }>();
  const navigate = useNavigate();
  const [prediction, setPrediction] = useState<PsychicPrediction | null>(null);
  const [predictionText, setPredictionText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const showSnackbar = useSnackbar();

  useEffect(() => {
    const loadPrediction = async (id: string) => {
      setLoadingPrediction(true);
      try {
        const response = await apiFetch(
          `${import.meta.env.VITE_API_URL}/psychic/${id}`,
          {
            method: 'GET',
          }
        );

        if (!response.ok) {
          throw new Error('Failed to load prediction');
        }

        const data = await response.json();
        setPrediction(data.prediction);
      } catch (error) {
        console.error('Error loading prediction:', error);
        showSnackbar?.('Failed to load prediction', 'error');
      } finally {
        setLoadingPrediction(false);
      }
    };

    if (predictionId) {
      loadPrediction(predictionId);
    }
  }, [predictionId, showSnackbar]);

  const handleTestPrediction = async () => {
    if (!predictionText.trim()) {
      showSnackbar?.('Please enter your prediction', 'error');
      return;
    }

    if (!prediction) {
      showSnackbar?.('No prediction loaded', 'error');
      return;
    }

    setLoading(true);
    setTestResult(null);
    try {
      const response = await apiFetch(
        `${import.meta.env.VITE_API_URL}/psychic/${prediction.id}/test`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            predictionText,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to test prediction');
      }

      const data = await response.json();
      setTestResult(data);
      showSnackbar?.('Test complete!', 'success');
    } catch (error) {
      console.error('Error testing prediction:', error);
      showSnackbar?.('Failed to test prediction', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loadingPrediction) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  if (!prediction) {
    return (
      <Layout>
        <Typography variant="h6">Prediction not found</Typography>
        <Button onClick={() => navigate('/psychic')} sx={{ mt: 2 }}>
          Back to Predictions
        </Button>
      </Layout>
    );
  }

  const getMatchedTeam = () => {
    if (!testResult?.matchedPictureId) return null;
    if (testResult.matchedPictureId === prediction.team1PictureId) {
      return prediction.team1;
    }
    return prediction.team2;
  };

  return (
    <Layout>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Button variant="outlined" onClick={() => navigate('/psychic')}>
            ← Back
          </Button>
          <Typography variant="h4">Test Prediction</Typography>
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          This is a test mode. Enter a prediction and see how it matches against
          the two pictures. Results are NOT saved to the database.
        </Alert>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Prediction: {prediction.id}
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Teams: {prediction.team1} vs {prediction.team2}
            </Typography>

            <TextField
              fullWidth
              multiline
              rows={6}
              label="Test Prediction"
              variant="outlined"
              value={predictionText}
              onChange={(e) => setPredictionText(e.target.value)}
              placeholder="Describe what you see in your mind... colors, objects, setting, mood, etc."
              sx={{ mb: 2 }}
            />

            <Button
              variant="contained"
              onClick={handleTestPrediction}
              disabled={loading || !predictionText.trim()}
            >
              {loading ? <CircularProgress size={24} /> : 'Test Prediction'}
            </Button>
          </CardContent>
        </Card>

        {testResult && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Test Results
              </Typography>

              {getMatchedTeam() ? (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Matched: <strong>{getMatchedTeam()}</strong> (Confidence:{' '}
                  {testResult.confidenceScore}%)
                </Alert>
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>
                  No significant match found
                </Alert>
              )}

              {testResult.reasoning && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    <strong>Reasoning:</strong>
                  </Typography>
                  <Typography variant="body2">
                    {testResult.reasoning}
                  </Typography>
                </Box>
              )}

              {testResult.picture1Analysis && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" display="block">
                    <strong>Picture 1 Analysis:</strong>{' '}
                    {testResult.picture1Analysis}
                  </Typography>
                </Box>
              )}

              {testResult.picture2Analysis && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" display="block">
                    <strong>Picture 2 Analysis:</strong>{' '}
                    {testResult.picture2Analysis}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardMedia
                component="img"
                height="300"
                image={
                  prediction.picture1.thumbnailUrl || prediction.picture1.url
                }
                alt="Picture 1"
              />
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  {prediction.picture1.description}
                </Typography>
                {prediction.picture1.photographer && (
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', mt: 1 }}
                  >
                    Photo by {prediction.picture1.photographer}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardMedia
                component="img"
                height="300"
                image={
                  prediction.picture2.thumbnailUrl || prediction.picture2.url
                }
                alt="Picture 2"
              />
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  {prediction.picture2.description}
                </Typography>
                {prediction.picture2.photographer && (
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', mt: 1 }}
                  >
                    Photo by {prediction.picture2.photographer}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Layout>
  );
}
