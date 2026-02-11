import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Grid,
  Chip,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import NERApiService from '../../services/nerApi';

const NERTraining = () => {
  const [training, setTraining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeStep, setActiveStep] = useState(0);

  const [config, setConfig] = useState({
    modelName: 'slot_model',
    baseModel: 'distilbert-base-uncased',
    epochs: 3,
    batchSize: 16,
    learningRate: 0.00002,
    maxLength: 512,
    dataPath: 'data/labels/train.jsonl',
  });

  const [stats, setStats] = useState({
    trainSamples: 0,
    devSamples: 0,
    totalLabels: 0,
  });

  useEffect(() => {
    loadDataStats();
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (window.trainingPollInterval) {
        clearInterval(window.trainingPollInterval);
        window.trainingPollInterval = null;
      }
    };
  }, []);

  const loadDataStats = async () => {
    try {
      const statsData = await NERApiService.getDataStats();
      setStats(statsData);
    } catch (err) {
      setError('Failed to load data statistics: ' + err.message);
    }
  };

  const handleConfigChange = (field, value) => {
    setConfig({ ...config, [field]: value });
  };

  const handleStartTraining = async () => {
    setTraining(true);
    setProgress(0);
    setCurrentEpoch(0);
    setLogs([]);
    setError('');
    setActiveStep(1);

    try {
      // Start training via API
      await NERApiService.startTraining(config);
      
      // Poll for training status
      const pollInterval = setInterval(async () => {
        try {
          const statusData = await NERApiService.getTrainingStatus();
          
          // Update logs
          setLogs(statusData.logs || []);
          
          // Calculate progress based on logs
          const logMessages = statusData.logs.map(l => l.message).join(' ');
          const epochMatch = logMessages.match(/Epoch (\d+)\/(\d+)/);
          if (epochMatch) {
            const current = parseInt(epochMatch[1]);
            const total = parseInt(epochMatch[2]);
            setCurrentEpoch(current);
            setProgress((current / total) * 100);
          }
          
          // Check if completed or failed
          if (statusData.status === 'completed') {
            clearInterval(pollInterval);
            setProgress(100);
            setSuccess('Training completed successfully!');
            setActiveStep(2);
            setTraining(false);
          } else if (statusData.status === 'failed') {
            clearInterval(pollInterval);
            setError('Training failed. Check logs for details.');
            setTraining(false);
          }
        } catch (err) {
          console.error('Error polling status:', err);
        }
      }, 1000); // Poll every second
      
      // Store interval ID for cleanup
      window.trainingPollInterval = pollInterval;
      
    } catch (err) {
      setError('Failed to start training: ' + err.message);
      setTraining(false);
    }
  };

  const handleStopTraining = async () => {
    try {
      // Clear polling interval
      if (window.trainingPollInterval) {
        clearInterval(window.trainingPollInterval);
        window.trainingPollInterval = null;
      }
      
      // Stop training via API
      await NERApiService.stopTraining();
      setTraining(false);
      setError('Training stopped by user');
      setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), message: 'Training stopped by user' }]);
    } catch (err) {
      setError('Failed to stop training: ' + err.message);
    }
  };

  const steps = ['Configure', 'Training', 'Complete'];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        NER Model Training
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Training Configuration
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                <TextField
                  label="Model Name"
                  value={config.modelName}
                  onChange={(e) => handleConfigChange('modelName', e.target.value)}
                  disabled={training}
                  fullWidth
                />

                <FormControl fullWidth disabled={training}>
                  <InputLabel>Base Model</InputLabel>
                  <Select
                    value={config.baseModel}
                    onChange={(e) => handleConfigChange('baseModel', e.target.value)}
                    label="Base Model"
                  >
                    <MenuItem value="distilbert-base-uncased">DistilBERT (base, uncased)</MenuItem>
                    <MenuItem value="bert-base-uncased">BERT (base, uncased)</MenuItem>
                    <MenuItem value="roberta-base">RoBERTa (base)</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  label="Epochs"
                  type="number"
                  value={config.epochs}
                  onChange={(e) => handleConfigChange('epochs', parseInt(e.target.value))}
                  disabled={training}
                  fullWidth
                />

                <TextField
                  label="Batch Size"
                  type="number"
                  value={config.batchSize}
                  onChange={(e) => handleConfigChange('batchSize', parseInt(e.target.value))}
                  disabled={training}
                  fullWidth
                />

                <TextField
                  label="Learning Rate"
                  type="number"
                  value={config.learningRate}
                  onChange={(e) => handleConfigChange('learningRate', parseFloat(e.target.value))}
                  disabled={training}
                  inputProps={{ step: 0.00001 }}
                  fullWidth
                />

                <TextField
                  label="Max Sequence Length"
                  type="number"
                  value={config.maxLength}
                  onChange={(e) => handleConfigChange('maxLength', parseInt(e.target.value))}
                  disabled={training}
                  fullWidth
                />

                <TextField
                  label="Training Data Path"
                  value={config.dataPath}
                  onChange={(e) => handleConfigChange('dataPath', e.target.value)}
                  disabled={training}
                  fullWidth
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Dataset Statistics
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="textSecondary">Training Samples:</Typography>
                  <Chip label={stats.trainSamples} color="primary" size="small" />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="textSecondary">Validation Samples:</Typography>
                  <Chip label={stats.devSamples} color="secondary" size="small" />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="textSecondary">Total Labels:</Typography>
                  <Chip label={stats.totalLabels} color="success" size="small" />
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Training Controls
              </Typography>

              <Box sx={{ mt: 2, mb: 2 }}>
                {training ? (
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<StopIcon />}
                    onClick={handleStopTraining}
                    fullWidth
                  >
                    Stop Training
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<PlayArrowIcon />}
                    onClick={handleStartTraining}
                    fullWidth
                  >
                    Start Training
                  </Button>
                )}
              </Box>

              {training && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Epoch {currentEpoch}/{config.epochs}
                  </Typography>
                  <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4 }} />
                  <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                    {progress.toFixed(1)}% complete
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Training Logs
              </Typography>
              <Paper
                sx={{
                  mt: 2,
                  p: 2,
                  maxHeight: 300,
                  overflow: 'auto',
                  backgroundColor: '#1e1e1e',
                  color: '#00ff00',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                }}
              >
                {logs.length === 0 ? (
                  <Typography color="textSecondary">No logs yet. Start training to see logs.</Typography>
                ) : (
                  logs.map((log, index) => (
                    <Box key={index} sx={{ mb: 0.5 }}>
                      <Typography component="span" sx={{ color: '#888' }}>
                        [{log.time}]
                      </Typography>{' '}
                      {log.message}
                    </Box>
                  ))
                )}
              </Paper>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default NERTraining;
