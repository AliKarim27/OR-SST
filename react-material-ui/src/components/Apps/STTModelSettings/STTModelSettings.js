import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Chip,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InfoIcon from "@mui/icons-material/Info";

const API_BASE = "http://localhost:8000/api";

// Model descriptions
const MODEL_DESCRIPTIONS = {
  tiny: "Fastest, lowest accuracy. Best for quick processing.",
  base: "Balanced speed and accuracy. Recommended default.",
  small: "Better accuracy than base, slower processing.",
  medium: "High accuracy, significantly slower inference.",
  large: "Best accuracy, slowest inference. Requires more resources.",
};

const STTModelSettings = () => {
  const theme = useTheme();
  const [availableModels, setAvailableModels] = useState([]);
  const [currentModel, setCurrentModel] = useState("base");
  const [selectedModel, setSelectedModel] = useState("base");
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fetch available models and current model on mount
  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_BASE}/get_stt_models/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAvailableModels(data.available_models);
      setCurrentModel(data.current_model);
      setSelectedModel(data.current_model);
    } catch (e) {
      console.error("Failed to fetch models", e);
      setError(`Failed to load models: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleModelChange = async () => {
    if (selectedModel === currentModel) {
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
        body: JSON.stringify({ model_name: selectedModel }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setCurrentModel(selectedModel);
      setSuccess(`Model changed to ${selectedModel} successfully!`);
      
      // Clear success message after 4 seconds
      setTimeout(() => setSuccess(""), 4000);
    } catch (e) {
      console.error("Failed to set model", e);
      setError(`Failed to change model: ${e.message}`);
    } finally {
      setChanging(false);
    }
  };

  return (
    <Paper style={{ padding: 24 }}>
      <Box style={{ marginBottom: 24 }}>
        <Typography variant="h4" gutterBottom style={{ fontWeight: 600, marginBottom: 8 }}>
          🎤 Speech-to-Text Model Settings
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Configure which Whisper model is used for speech transcription
        </Typography>
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
          <Card style={{ marginBottom: 24, backgroundColor: theme.palette.primary[50] }}>
            <CardContent>
              <Box style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <CheckCircleIcon style={{ color: theme.palette.success.main, fontSize: 32 }} />
                <Box>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    Current Model
                  </Typography>
                  <Typography variant="h5" style={{ fontWeight: 600 }}>
                    {currentModel.toUpperCase()}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" style={{ marginTop: 4 }}>
                    {MODEL_DESCRIPTIONS[currentModel]}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Model Selection */}
          <Box style={{ marginBottom: 24 }}>
            <Typography variant="h6" gutterBottom style={{ marginBottom: 12 }}>
              Available Models
            </Typography>

            <Box style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {availableModels.map((model) => (
                <Chip
                  key={model}
                  label={model.toUpperCase()}
                  onClick={() => setSelectedModel(model)}
                  color={selectedModel === model ? "primary" : "default"}
                  variant={selectedModel === model ? "filled" : "outlined"}
                  style={{ cursor: "pointer", padding: 4 }}
                />
              ))}
            </Box>

            {selectedModel !== currentModel && (
              <Box
                style={{
                  padding: 12,
                  backgroundColor: theme.palette.warning[50],
                  borderLeft: `4px solid ${theme.palette.warning.main}`,
                  borderRadius: 4,
                  marginBottom: 16,
                }}
              >
                <Typography variant="body2">
                  <strong>Note:</strong> The {selectedModel.toUpperCase()} model will be downloaded on first use.
                  This may take some time depending on your internet connection.
                </Typography>
              </Box>
            )}
          </Box>

          {/* Model Descriptions */}
          <Box style={{ marginBottom: 24 }}>
            <Typography variant="h6" gutterBottom style={{ marginBottom: 12 }}>
              Model Comparison
            </Typography>
            <Box style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              {availableModels.map((model) => (
                <Card
                  key={model}
                  style={{
                    borderLeft: `4px solid ${selectedModel === model ? theme.palette.primary.main : theme.palette.grey[300]}`,
                    backgroundColor: selectedModel === model ? theme.palette.primary[50] : "transparent",
                  }}
                >
                  <CardContent>
                    <Typography variant="subtitle2" style={{ fontWeight: 600, marginBottom: 4 }}>
                      {model.toUpperCase()}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {MODEL_DESCRIPTIONS[model]}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Box>

          {/* Action Buttons */}
          <Box style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleModelChange}
              disabled={changing || selectedModel === currentModel}
            >
              {changing ? (
                <>
                  <CircularProgress size={20} style={{ marginRight: 8 }} />
                  Changing Model...
                </>
              ) : (
                `Apply ${selectedModel.toUpperCase()} Model`
              )}
            </Button>
            {selectedModel === currentModel && (
              <Typography variant="body2" color="textSecondary">
                This model is already in use
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
                💡 Tips
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>
                  <Typography variant="body2">
                    <strong>For production:</strong> Use "base" or "small" for good balance
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>For quick testing:</strong> Use "tiny" model for fast responses
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>For best accuracy:</strong> Use "medium" or "large" (requires more resources)
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    Models are downloaded on first use and cached locally
                  </Typography>
                </li>
              </ul>
            </Box>
          </Box>
        </>
      )}
    </Paper>
  );
};

export default STTModelSettings;
