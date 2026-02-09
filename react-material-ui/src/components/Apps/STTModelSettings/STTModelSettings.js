import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Grid,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InfoIcon from "@mui/icons-material/Info";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

const API_BASE = "http://localhost:8000/api";

const STTModelSettings = () => {
  const theme = useTheme();
  const [models, setModels] = useState([]);
  const [currentModelId, setCurrentModelId] = useState(null);
  const [selectedModelId, setSelectedModelId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [availableTypes, setAvailableTypes] = useState(["whisper"]);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  
  // New model form
  const [newModel, setNewModel] = useState({
    name: "",
    model_type: "whisper",
    device: "cpu",
    compute_type: "int8",
    description: "",
  });

  useEffect(() => {
    fetchModels();
    fetchAvailableTypes();
  }, []);

  const fetchAvailableTypes = async () => {
    try {
      const res = await fetch(`${API_BASE}/get_stt_types/`);
      if (res.ok) {
        const data = await res.json();
        setAvailableTypes(data.types || ["whisper"]);
      }
    } catch (e) {
      console.error("Failed to fetch types", e);
    }
  };

  const validateModel = async (modelData) => {
    try {
      setValidating(true);
      const res = await fetch(`${API_BASE}/validate_stt_model/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model_type: modelData.model_type,
          model_name: modelData.name,
          device: modelData.device,
          compute_type: modelData.compute_type,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setValidationResult(data);
        return data;
      }
    } catch (e) {
      console.error("Validation failed", e);
    } finally {
      setValidating(false);
    }
    return null;
  };

  const fetchModels = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_BASE}/get_stt_models/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setModels(data.models);
      setCurrentModelId(data.current_model_id);
      setSelectedModelId(data.current_model_id);
    } catch (e) {
      console.error("Failed to fetch models", e);
      setError(`Failed to load models: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleModelChange = async () => {
    if (selectedModelId === currentModelId) {
      setError("Please select a different model");
      return;
    }

    try {
      setChanging(true);
      setError("");
      setSuccess("");
      const res = await fetch(`${API_BASE}/set_stt_model/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model_id: selectedModelId }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setCurrentModelId(selectedModelId);
      setSuccess(`Model changed successfully!`);
      fetchModels();
      
      setTimeout(() => setSuccess(""), 4000);
    } catch (e) {
      console.error("Failed to set model", e);
      setError(`Failed to change model: ${e.message}`);
    } finally {
      setChanging(false);
    }
  };

  const handleCreateModel = async () => {
    if (!newModel.name.trim()) {
      setError("Model name is required");
      return;
    }

    // Validate before creating
    const validation = await validateModel(newModel);
    if (!validation) {
      setError("Failed to validate model configuration");
      return;
    }

    if (!validation.valid) {
      setError(`Invalid model: ${validation.message}`);
      return;
    }

    if (!validation.available) {
      setError(`Model not available: ${validation.message}`);
      return;
    }

    try {
      setError("");
      const res = await fetch(`${API_BASE}/create_stt_model/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newModel),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      let successMsg = "Model created successfully!";
      if (data.warnings && data.warnings.length > 0) {
        successMsg += ` Warnings: ${data.warnings.join(", ")}`;
      }
      setSuccess(successMsg);
      setOpenDialog(false);
      setNewModel({
        name: "",
        model_type: "whisper",
        device: "cpu",
        compute_type: "int8",
        description: "",
      });
      setValidationResult(null);
      fetchModels();
      setTimeout(() => setSuccess(""), 4000);
    } catch (e) {
      console.error("Failed to create model", e);
      setError(`Failed to create model: ${e.message}`);
    }
  };

  const handleDeleteModel = async (modelId) => {
    if (!window.confirm("Are you sure you want to delete this model?")) return;

    try {
      setError("");
      const res = await fetch(`${API_BASE}/delete_stt_model/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model_id: modelId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setSuccess("Model deleted successfully!");
      fetchModels();
      setTimeout(() => setSuccess(""), 4000);
    } catch (e) {
      console.error("Failed to delete model", e);
      setError(`Failed to delete model: ${e.message}`);
    }
  };

  const currentModel = models.find(m => m.id === currentModelId);

  return (
    <Paper style={{ padding: 24 }}>
      <Box style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h4" gutterBottom style={{ fontWeight: 600, marginBottom: 8 }}>
            Speech-to-Text Model Settings
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Configure and manage Whisper models for speech transcription
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
        >
          Add Model
        </Button>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError("")} style={{ marginBottom: 16 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" onClose={() => setSuccess("")} style={{ marginBottom: 16 }}>
          {success}
        </Alert>
      )}

      {loading ? (
        <Box style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Current Model Display */}
          {currentModel && (
            <Card style={{ marginBottom: 24, backgroundColor: theme.palette.primary[50] }}>
              <CardContent>
                <Box style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <CheckCircleIcon style={{ color: theme.palette.success.main, fontSize: 32 }} />
                  <Box style={{ flex: 1 }}>
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                      Active Model
                    </Typography>
                    <Typography variant="h5" style={{ fontWeight: 600 }}>
                      {currentModel.name.toUpperCase()}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" style={{ marginTop: 4 }}>
                      {currentModel.description}
                    </Typography>
                    <Box style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Chip label={`Type: ${currentModel.model_type}`} size="small" />
                      <Chip label={`Device: ${currentModel.device}`} size="small" />
                      <Chip label={`Compute: ${currentModel.compute_type}`} size="small" />
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Model List */}
          <Box style={{ marginBottom: 24 }}>
            <Typography variant="h6" gutterBottom style={{ marginBottom: 12 }}>
              Available Models ({models.length})
            </Typography>

            <Grid container spacing={2}>
              {models.map((model) => (
                <Grid item xs={12} md={6} key={model.id}>
                  <Card
                    style={{
                      borderLeft: `4px solid ${selectedModelId === model.id ? theme.palette.primary.main : theme.palette.grey[300]}`,
                      backgroundColor: selectedModelId === model.id ? theme.palette.primary[50] : "transparent",
                      cursor: "pointer",
                      position: "relative",
                    }}
                    onClick={() => setSelectedModelId(model.id)}
                  >
                    <CardContent>
                      <Box style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Box style={{ flex: 1 }}>
                          <Box style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                            <Typography variant="h6" style={{ fontWeight: 600 }}>
                              {model.name.toUpperCase()}
                            </Typography>
                            {model.is_active && (
                              <Chip label="Active" color="success" size="small" />
                            )}
                            {model.is_default && (
                              <Chip label="Default" color="info" size="small" />
                            )}
                          </Box>
                          <Typography variant="body2" color="textSecondary" style={{ marginBottom: 8 }}>
                            {model.description || "No description"}
                          </Typography>
                          <Box style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            <Chip label={model.model_type} size="small" variant="outlined" />
                            <Chip label={model.device} size="small" variant="outlined" />
                            <Chip label={model.compute_type} size="small" variant="outlined" />
                          </Box>
                        </Box>
                        {!model.is_active && !model.is_default && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteModel(model.id);
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* Action Buttons */}
          <Box style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleModelChange}
              disabled={changing || selectedModelId === currentModelId}
            >
              {changing ? (
                <>
                  <CircularProgress size={20} style={{ marginRight: 8 }} />
                  Changing Model...
                </>
              ) : (
                "Activate Selected Model"
              )}
            </Button>
            {selectedModelId === currentModelId && (
              <Typography variant="body2" color="textSecondary">
                This model is already active
              </Typography>
            )}
          </Box>

          {/* Info Box */}
          <Box
            style={{
              marginTop: 24,
              padding: 16,
              backgroundColor: theme.palette.info[50],
              borderRadius: 4,
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <InfoIcon style={{ color: theme.palette.info.main, marginTop: 2 }} />
            <Box>
              <Typography variant="subtitle2" style={{ fontWeight: 600, marginBottom: 4 }}>
                Tips
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>
                  <Typography variant="body2">
                    Models are downloaded on first use and cached locally
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    Use CPU for compatibility, CUDA for GPU acceleration
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    int8 provides good balance between speed and quality
                  </Typography>
                </li>
              </ul>
            </Box>
          </Box>
        </>
      )}

      {/* Add Model Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New STT Model</DialogTitle>
        <DialogContent>
          <Box style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
            <TextField
              label="Model Name"
              fullWidth
              required
              value={newModel.name}
              onChange={(e) => {
                setNewModel({ ...newModel, name: e.target.value });
                setValidationResult(null);
              }}
              helperText="e.g., base, small, medium, large, tiny"
            />
            
            <FormControl fullWidth>
              <InputLabel>Model Type</InputLabel>
              <Select
                value={newModel.model_type}
                onChange={(e) => {
                  setNewModel({ ...newModel, model_type: e.target.value });
                  setValidationResult(null);
                }}
                label="Model Type"
              >
                {availableTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Device</InputLabel>
              <Select
                value={newModel.device}
                onChange={(e) => {
                  setNewModel({ ...newModel, device: e.target.value });
                  setValidationResult(null);
                }}
                label="Device"
              >
                <MenuItem value="cpu">CPU</MenuItem>
                <MenuItem value="cuda">CUDA (GPU)</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Compute Type</InputLabel>
              <Select
                value={newModel.compute_type}
                onChange={(e) => {
                  setNewModel({ ...newModel, compute_type: e.target.value });
                  setValidationResult(null);
                }}
                label="Compute Type"
              >
                <MenuItem value="int8">int8</MenuItem>
                <MenuItem value="float16">float16</MenuItem>
                <MenuItem value="float32">float32</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={newModel.description}
              onChange={(e) => setNewModel({ ...newModel, description: e.target.value })}
            />

            <Button
              variant="outlined"
              onClick={() => validateModel(newModel)}
              disabled={!newModel.name || validating}
            >
              {validating ? <CircularProgress size={20} /> : "Validate Configuration"}
            </Button>

            {validationResult && (
              <Box
                style={{
                  padding: 12,
                  backgroundColor: validationResult.valid && validationResult.available
                    ? theme.palette.success[50]
                    : theme.palette.error[50],
                  borderRadius: 4,
                  borderLeft: `4px solid ${validationResult.valid && validationResult.available
                    ? theme.palette.success.main
                    : theme.palette.error.main}`,
                }}
              >
                <Typography variant="body2" style={{ fontWeight: 600 }}>
                  {validationResult.valid && validationResult.available ? "✓ Valid" : "✗ Invalid"}
                </Typography>
                <Typography variant="body2" style={{ marginTop: 4 }}>
                  {validationResult.message}
                </Typography>
                {validationResult.warnings && validationResult.warnings.length > 0 && (
                  <Box style={{ marginTop: 8 }}>
                    <Typography variant="caption" style={{ fontWeight: 600 }}>
                      Warnings:
                    </Typography>
                    {validationResult.warnings.map((warning, i) => (
                      <Typography key={i} variant="caption" style={{ display: "block" }}>
                        • {warning}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setOpenDialog(false);
            setValidationResult(null);
          }}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateModel} 
            variant="contained" 
            color="primary"
            disabled={!newModel.name || validating}
          >
            Create Model
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default STTModelSettings;
