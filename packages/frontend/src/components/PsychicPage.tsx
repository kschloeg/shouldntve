import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Grid from '@mui/material/Grid';
import CircularProgress from '@mui/material/CircularProgress';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
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
  predictionText?: string;
  predictionSketchUrl?: string;
  matchedTeam?: string;
  confidenceScore?: number;
  reasoning?: string;
  picture1Analysis?: string;
  picture2Analysis?: string;
  winningTeam?: string;
  revealedPictureId?: string;
}

const steps = ['Create Prediction', 'Make Prediction', 'Reveal Result'];

export default function PsychicPage() {
  const { predictionId } = useParams<{ predictionId?: string }>();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');
  const [prediction, setPrediction] = useState<PsychicPrediction | null>(null);
  const [predictionText, setPredictionText] = useState('');
  const [winningTeam, setWinningTeam] = useState('');
  const [loading, setLoading] = useState(false);
  const showSnackbar = useSnackbar();

  // Load prediction if predictionId is in URL
  useEffect(() => {
    if (predictionId) {
      loadPrediction(predictionId);
    }
  }, [predictionId]);

  const loadPrediction = async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/psychic/${id}`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load prediction');
      }

      const data = await response.json();
      setPrediction(data.prediction);

      // Set the appropriate step based on prediction status
      if (data.prediction.status === 'created') {
        setActiveStep(1);
      } else if (data.prediction.status === 'prediction_made' || data.prediction.status === 'revealed') {
        setActiveStep(2);
        setPredictionText(data.prediction.predictionText || '');
        if (data.prediction.status === 'revealed') {
          setWinningTeam(data.prediction.winningTeam || '');
        }
      }
    } catch (error) {
      console.error('Error loading prediction:', error);
      showSnackbar?.('Failed to load prediction', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Create a new prediction
  const handleCreatePrediction = async () => {
    if (!team1 || !team2) {
      showSnackbar?.('Please enter both team names', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/psychic/create`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ team1, team2 }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create prediction');
      }

      const data = await response.json();
      setPrediction(data.prediction);
      setActiveStep(1);

      // Navigate to the prediction-specific URL
      navigate(`/psychic/${data.prediction.id}`);

      showSnackbar?.(
        'Prediction created! Now describe the picture you will be shown.',
        'success'
      );
    } catch (error) {
      console.error('Error creating prediction:', error);
      showSnackbar?.('Failed to create prediction', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Submit the psychic's prediction
  const handleSubmitPrediction = async () => {
    if (!predictionText.trim()) {
      showSnackbar?.('Please enter your prediction', 'error');
      return;
    }

    if (!prediction) {
      showSnackbar?.('No active prediction', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/psychic/predict`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            predictionId: prediction.id,
            predictionText,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to submit prediction');
      }

      const data = await response.json();
      setPrediction(data.prediction);
      setActiveStep(2);

      if (data.prediction.matchedTeam) {
        showSnackbar?.(
          `Match found! Predicted team: ${data.prediction.matchedTeam} (Confidence: ${data.prediction.confidenceScore}%)`,
          'success'
        );
      } else {
        showSnackbar?.('No significant match found', 'info');
      }
    } catch (error) {
      console.error('Error submitting prediction:', error);
      showSnackbar?.('Failed to submit prediction', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reveal the winning team's picture
  const handleReveal = async () => {
    if (!winningTeam) {
      showSnackbar?.('Please select the winning team', 'error');
      return;
    }

    if (!prediction) {
      showSnackbar?.('No active prediction', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/psychic/reveal`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            predictionId: prediction.id,
            winningTeam,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to reveal prediction');
      }

      const data = await response.json();
      setPrediction(data.prediction);
      showSnackbar?.('Picture revealed!', 'success');
    } catch (error) {
      console.error('Error revealing prediction:', error);
      showSnackbar?.('Failed to reveal prediction', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setActiveStep(0);
    setTeam1('');
    setTeam2('');
    setPrediction(null);
    setPredictionText('');
    setWinningTeam('');
    navigate('/psychic');
  };

  const copyPredictionUrl = () => {
    if (!prediction) return;
    const url = `${window.location.origin}/psychic/${prediction.id}`;
    navigator.clipboard.writeText(url);
    showSnackbar?.('URL copied to clipboard!', 'success');
  };

  const getRevealedPicture = () => {
    if (!prediction || !prediction.revealedPictureId) return null;
    return prediction.picture1.id === prediction.revealedPictureId
      ? prediction.picture1
      : prediction.picture2;
  };

  return (
    <Layout>
      <Box>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Psychic Prediction System
        </Typography>

        <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
          Test psychic abilities by predicting which picture will be shown based
          on a future event outcome.
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step 1: Create Prediction */}
        {activeStep === 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Enter the two competing teams
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Team 1"
                    variant="outlined"
                    value={team1}
                    onChange={(e) => setTeam1(e.target.value)}
                    placeholder="e.g., Minnesota Vikings"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Team 2"
                    variant="outlined"
                    value={team2}
                    onChange={(e) => setTeam2(e.target.value)}
                    placeholder="e.g., Green Bay Packers"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    onClick={handleCreatePrediction}
                    disabled={loading || !team1 || !team2}
                    sx={{ mt: 2 }}
                  >
                    {loading ? (
                      <CircularProgress size={24} />
                    ) : (
                      'Create Prediction'
                    )}
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Make Prediction */}
        {activeStep === 1 && prediction && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <Alert severity="info" sx={{ flexGrow: 1 }}>
                Without looking at the pictures below, describe the picture you
                will be shown after the event. Be as specific as possible about
                colors, objects, composition, and mood.
              </Alert>
              <Button
                variant="outlined"
                size="small"
                startIcon={<ContentCopyIcon />}
                onClick={copyPredictionUrl}
              >
                Copy URL
              </Button>
            </Box>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Teams: {prediction.team1} vs {prediction.team2}
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={6}
                  label="Your Prediction"
                  variant="outlined"
                  value={predictionText}
                  onChange={(e) => setPredictionText(e.target.value)}
                  placeholder="Describe what you see in your mind... colors, objects, setting, mood, etc."
                  sx={{ mb: 2 }}
                />
                <Button
                  variant="contained"
                  onClick={handleSubmitPrediction}
                  disabled={loading || !predictionText.trim()}
                >
                  {loading ? (
                    <CircularProgress size={24} />
                  ) : (
                    'Submit Prediction'
                  )}
                </Button>
              </CardContent>
            </Card>

            <Typography
              variant="caption"
              sx={{ display: 'block', mb: 2, color: 'text.secondary' }}
            >
              The pictures below are for reference only. Do not look at them
              before making your prediction.
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardMedia
                    component="img"
                    height="300"
                    image={
                      prediction.picture1.thumbnailUrl ||
                      prediction.picture1.url
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
                      prediction.picture2.thumbnailUrl ||
                      prediction.picture2.url
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
        )}

        {/* Step 3: Reveal */}
        {activeStep === 2 && prediction && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Prediction: {prediction.id}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<ContentCopyIcon />}
                onClick={copyPredictionUrl}
              >
                Copy URL
              </Button>
            </Box>
            {prediction.matchedTeam && (
              <Box sx={{ mb: 3 }}>
                <Alert severity="success" sx={{ mb: 2 }}>
                  Your prediction matched:{' '}
                  <strong>{prediction.matchedTeam}</strong> (Confidence:{' '}
                  {prediction.confidenceScore}%)
                </Alert>
                {prediction.reasoning && (
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        <strong>Why it matched:</strong>
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        {prediction.reasoning}
                      </Typography>
                      {prediction.picture1Analysis && (
                        <Typography variant="caption" display="block" sx={{ mb: 1 }}>
                          <strong>Picture 1:</strong> {prediction.picture1Analysis}
                        </Typography>
                      )}
                      {prediction.picture2Analysis && (
                        <Typography variant="caption" display="block">
                          <strong>Picture 2:</strong> {prediction.picture2Analysis}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                )}
              </Box>
            )}

            {!prediction.matchedTeam && (
              <Box sx={{ mb: 3 }}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  No significant match was found between your prediction and
                  either picture.
                </Alert>
                {prediction.reasoning && (
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        <strong>Why it didn't match:</strong>
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        {prediction.reasoning}
                      </Typography>
                      {prediction.picture1Analysis && (
                        <Typography variant="caption" display="block" sx={{ mb: 1 }}>
                          <strong>Picture 1:</strong> {prediction.picture1Analysis}
                        </Typography>
                      )}
                      {prediction.picture2Analysis && (
                        <Typography variant="caption" display="block">
                          <strong>Picture 2:</strong> {prediction.picture2Analysis}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                )}
              </Box>
            )}

            {prediction.status !== 'revealed' ? (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Enter the winning team to reveal the picture
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <Button
                      variant={
                        winningTeam === prediction.team1
                          ? 'contained'
                          : 'outlined'
                      }
                      onClick={() => setWinningTeam(prediction.team1)}
                    >
                      {prediction.team1}
                    </Button>
                    <Button
                      variant={
                        winningTeam === prediction.team2
                          ? 'contained'
                          : 'outlined'
                      }
                      onClick={() => setWinningTeam(prediction.team2)}
                    >
                      {prediction.team2}
                    </Button>
                  </Box>
                  <Button
                    variant="contained"
                    onClick={handleReveal}
                    disabled={loading || !winningTeam}
                  >
                    {loading ? (
                      <CircularProgress size={24} />
                    ) : (
                      'Reveal Picture'
                    )}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Winning Team: {prediction.winningTeam}
                  </Typography>

                  {prediction.matchedTeam === prediction.winningTeam && (
                    <Chip
                      label="✓ Prediction Correct!"
                      color="success"
                      sx={{ mb: 2 }}
                    />
                  )}

                  {prediction.matchedTeam &&
                    prediction.matchedTeam !== prediction.winningTeam && (
                      <Chip
                        label="✗ Prediction Incorrect"
                        color="error"
                        sx={{ mb: 2 }}
                      />
                    )}

                  <Typography variant="body2" sx={{ mb: 2 }}>
                    Your prediction: "{prediction.predictionText}"
                  </Typography>

                  <Typography variant="h6" sx={{ mb: 2, mt: 3 }}>
                    Revealed Picture:
                  </Typography>

                  {getRevealedPicture() && (
                    <Card>
                      <CardMedia
                        component="img"
                        height="400"
                        image={
                          getRevealedPicture()!.thumbnailUrl ||
                          getRevealedPicture()!.url
                        }
                        alt="Revealed Picture"
                      />
                      <CardContent>
                        <Typography variant="body2" color="text.secondary">
                          {getRevealedPicture()!.description}
                        </Typography>
                        {getRevealedPicture()!.photographer && (
                          <Typography
                            variant="caption"
                            sx={{ display: 'block', mt: 1 }}
                          >
                            Photo by {getRevealedPicture()!.photographer}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  <Button
                    variant="outlined"
                    onClick={handleReset}
                    sx={{ mt: 3 }}
                  >
                    Start New Prediction
                  </Button>
                </CardContent>
              </Card>
            )}
          </Box>
        )}
      </Box>
    </Layout>
  );
}
