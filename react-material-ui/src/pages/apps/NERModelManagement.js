import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import InfoIcon from '@mui/icons-material/Info';
import NERApiService from '../../services/nerApi';

const NERModelManagement = () => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [newModelName, setNewModelName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    setLoading(true);
    try {
      const response = await NERApiService.getModels();
      setModels(response.models || []);
    } catch (err) {
      setError('Failed to load models: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateModel = async () => {
    if (!newModelName.trim()) {
      setError('Model name is required');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await NERApiService.createModel({
        name: newModelName,
        model_type: 'slot-filling',
        device: 'cpu',
        description: 'User-created model'
      });
      
      setSuccess(`Model "${newModelName}" created successfully`);
      setNewModelName('');
      setOpenDialog(false);
      await loadModels();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to create model: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModel = async (model) => {
    if (model.is_active || model.status === 'active') {
      setError('Cannot delete active model');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (window.confirm(`Are you sure you want to delete model "${model.name}"?`)) {
      setLoading(true);
      try {
        await NERApiService.deleteModel(model.id);
        setSuccess(`Model "${model.name}" deleted successfully`);
        await loadModels();
        setTimeout(() => setSuccess(''), 3000);
      } catch (err) {
        setError('Failed to delete model: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleOpenDialog = () => {
    setOpenDialog(true);
    setError('');
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">NER Model Management</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenDialog}
          disabled={loading}
        >
          Create Model
        </Button>
      </Box>

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

      <Card>
        <CardContent>
          {loading && models.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : models.length === 0 ? (
            <Box sx={{ textAlign: 'center', p: 3 }}>
              <Typography variant="body1" color="textSecondary">
                No models found. Create your first NER model to get started.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Model Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {models.map((model) => (
                    <TableRow key={model.id} hover>
                      <TableCell>
                        <Typography variant="body1" fontWeight="medium">
                          {model.name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {model.path}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={model.type} size="small" color="primary" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={model.status}
                          size="small"
                          color={model.status === 'active' || model.is_active ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>{model.created}</TableCell>
                      <TableCell>{model.size}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => setSelectedModel(model)}
                          color="primary"
                        >
                          <InfoIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteModel(model)}
                          color="error"
                          disabled={model.status === 'active' || model.is_active || loading}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Create Model Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New NER Model</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Model Name"
            fullWidth
            variant="outlined"
            value={newModelName}
            onChange={(e) => setNewModelName(e.target.value)}
            helperText="Enter a unique name for the new model"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreateModel} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Model Info Dialog */}
      <Dialog
        open={selectedModel !== null}
        onClose={() => setSelectedModel(null)}
        maxWidth="sm"
        fullWidth
      >
        {selectedModel && (
          <>
            <DialogTitle>Model Information</DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">
                    Name
                  </Typography>
                  <Typography variant="body1">{selectedModel.name}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">
                    Path
                  </Typography>
                  <Typography variant="body1">{selectedModel.path}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">
                    Type
                  </Typography>
                  <Typography variant="body1">{selectedModel.type}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">
                    Status
                  </Typography>
                  <Chip
                    label={selectedModel.status}
                    size="small"
                    color={selectedModel.status === 'active' ? 'success' : 'default'}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">
                    Created
                  </Typography>
                  <Typography variant="body1">{selectedModel.created}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">
                    Size
                  </Typography>
                  <Typography variant="body1">{selectedModel.size}</Typography>
                </Box>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedModel(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default NERModelManagement;
