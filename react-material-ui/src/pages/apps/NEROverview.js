import React from 'react';
import { Container, Box, Typography, Card, CardContent, Grid, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import StorageIcon from '@mui/icons-material/Storage';
import SchoolIcon from '@mui/icons-material/School';
import DatasetIcon from '@mui/icons-material/Dataset';
import ScienceIcon from '@mui/icons-material/Science';

const NEROverview = () => {
  const navigate = useNavigate();

  const cards = [
    {
      title: 'Model Management',
      description: 'Create, view, and delete NER models. Manage your trained models and configurations.',
      icon: <StorageIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/apps/ner-model-management',
      color: '#1976d2',
    },
    {
      title: 'Training',
      description: 'Train new NER models on your labeled data. Configure hyperparameters and monitor progress.',
      icon: <SchoolIcon sx={{ fontSize: 48, color: 'success.main' }} />,
      path: '/apps/ner-training',
      color: '#2e7d32',
    },
    {
      title: 'Training Data',
      description: 'View, edit, and manage training data. Add new labeled examples or modify existing ones.',
      icon: <DatasetIcon sx={{ fontSize: 48, color: 'warning.main' }} />,
      path: '/apps/ner-data-management',
      color: '#ed6c02',
    },
    {
      title: 'Tester',
      description: 'Test the NER model with custom text or previous STT transcripts. View extracted entities.',
      icon: <ScienceIcon sx={{ fontSize: 48, color: 'info.main' }} />,
      path: '/apps/ner-tester',
      color: '#0288d1',
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          NER Management
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Manage your Named Entity Recognition models, training data, and model training workflows.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {cards.map((card, index) => (
          <Grid item xs={12} md={4} key={index}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                  cursor: 'pointer',
                },
              }}
              onClick={() => navigate(card.path)}
            >
              <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                <Box sx={{ mb: 2, mt: 2 }}>{card.icon}</Box>
                <Typography variant="h5" component="h2" gutterBottom>
                  {card.title}
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  {card.description}
                </Typography>
                <Button variant="outlined" fullWidth onClick={() => navigate(card.path)}>
                  Open
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mt: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              About NER Module
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              The Named Entity Recognition (NER) module uses a fine-tuned token classification model to
              extract structured information from medical transcripts. The system employs BIO tagging to
              identify entities such as dates, times, personnel, diagnoses, procedures, and more.
            </Typography>
            <Typography variant="body2" color="textSecondary">
              The module follows a factory pattern architecture with BaseNER as the abstract parent class,
              NERConfig for centralized configuration, and SlotFillingExtractor as the default implementation
              using DistilBERT for token-level classification.
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ mt: 3 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Quick Stats
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    1
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Active Models
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main">
                    32
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Entity Types
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="warning.main">
                    1250
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Training Samples
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="info.main">
                    512
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Max Tokens
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default NEROverview;
