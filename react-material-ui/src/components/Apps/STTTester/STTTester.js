import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  Chip,
  Card,
  CardContent,
  Divider,
  Pagination,
  Grid,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AudioPlayer from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';

const API_BASE = "http://localhost:8000/api";

// Hide audio player controls via CSS
const playerStyles = `
  .minimal-player .rhap_volume-button,
  .minimal-player .rhap_volume-container,
  .minimal-player .rhap_additional-controls,
  .minimal-player .rhap_loop-button,
  .minimal-player .rhap_skip-button,
  .minimal-player .rhap_time-loop-button,
  .minimal-player .rhap_repeat-button,
  .minimal-player .rhap_download-progress {
    display: none !important;
  }
  
  .minimal-player .rhap_container {
    width: 100% !important;
    padding: 4px 8px !important;
  }
  
  .minimal-player .rhap_progress-container {
    flex: 1;
  }
`;

// Recording Visualizer Component (simplified from AudioManager)
const RecordingVisualizer = ({ isRecording }) => {
  const theme = useTheme();
  const [barHeights, setBarHeights] = useState(Array(12).fill(0.3));

  useEffect(() => {
    if (!isRecording) {
      setBarHeights(Array(12).fill(0.3));
      return;
    }

    const interval = setInterval(() => {
      setBarHeights(prev => prev.map(() => Math.random() * 0.7 + 0.3));
    }, 100);

    return () => clearInterval(interval);
  }, [isRecording]);

  if (!isRecording) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5,
        height: 40,
        py: 1,
      }}
    >
      {barHeights.map((height, i) => (
        <Box
          key={i}
          sx={{
            width: 3,
            height: `${height * 32}px`,
            bgcolor: theme.palette.primary.main,
            borderRadius: 1,
            transition: 'height 0.1s ease',
          }}
        />
      ))}
    </Box>
  );
};

function STTTester() {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  
  // Audio list state
  const [audios, setAudios] = useState([]);
  const [selectedAudioName, setSelectedAudioName] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, total_pages: 0, current_page: 1, page_size: 5 });
  
  // Recording state
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  
  // Transcript state
  const [transcript, setTranscript] = useState("");
  const [modelInfo, setModelInfo] = useState(null);

  useEffect(() => {
    if (tabValue === 0) {
      fetchAudios();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabValue, page]);

  const fetchAudios = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_BASE}/list_audio/?page=${page}&page_size=5`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      const audiosWithAbsoluteUrls = (data.list || []).map(audio => ({
        ...audio,
        url: audio.url.startsWith('http') ? audio.url : `${API_BASE}${audio.url}`
      }));
      
      setAudios(audiosWithAbsoluteUrls);
      setPagination(data.pagination || { total: 0, total_pages: 0, current_page: page, page_size: 5 });
    } catch (e) {
      console.error("Failed to fetch audios", e);
      setError(`Failed to load audios: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Media recording is not supported in this browser.");
      return;
    }
    try {
      setError("");
      setRecordedBlob(null);
      setRecordedUrl(null);
      setTranscript("");
      setModelInfo(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
      };
      
      mr.start();
      setRecording(true);
    } catch (e) {
      console.error(e);
      setError(`Could not start recording: ${e.message}`);
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
      mr.stream && mr.stream.getTracks().forEach((t) => t.stop());
    }
    setRecording(false);
  };

  const transcribeFromServer = async (filename) => {
    try {
      setTranscribing(true);
      setError("");
      setTranscript("");
      setModelInfo(null);

      const formData = new FormData();
      formData.append("filename", filename);

      const res = await fetch(`${API_BASE}/transcribe_only/`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setTranscript(data.transcript);
      setModelInfo(data.model_info);
    } catch (e) {
      console.error("Transcription failed", e);
      setError(`Transcription failed: ${e.message}`);
    } finally {
      setTranscribing(false);
    }
  };

  const transcribeRecorded = async () => {
    if (!recordedBlob) {
      setError("No recording available");
      return;
    }

    try {
      setTranscribing(true);
      setError("");
      setTranscript("");
      setModelInfo(null);

      const formData = new FormData();
      formData.append("audio", recordedBlob, "recording.webm");

      const res = await fetch(`${API_BASE}/transcribe_only/`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setTranscript(data.transcript);
      setModelInfo(data.model_info);
    } catch (e) {
      console.error("Transcription failed", e);
      setError(`Transcription failed: ${e.message}`);
    } finally {
      setTranscribing(false);
    }
  };

  const handleAudioSelect = (audioName) => {
    setSelectedAudioName(audioName);
    setTranscript("");
    setModelInfo(null);
    setError("");
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <style>{playerStyles}</style>
      <Typography variant="h4" gutterBottom>
        STT Model Tester
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Test the active STT model by selecting existing audio or recording new audio
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Select from Audio Manager" />
          <Tab label="Record New Audio" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Tab 0: Select from Audio Manager */}
          {tabValue === 0 && (
            <Grid container spacing={3}>
              {/* Left Column: Audio List */}
              <Grid item xs={12} md={6}>
                <Box>
                  {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : audios.length === 0 ? (
                    <Alert severity="info">
                      No audio files found. Upload some audio in Audio Manager first.
                    </Alert>
                  ) : (
                    <>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Select an audio file to transcribe ({pagination.total} total)
                      </Typography>
                      <List>
                        {audios.map((audio) => (
                          <ListItem
                            key={audio.name}
                            divider
                            sx={{
                              flexDirection: 'column',
                              alignItems: 'stretch',
                              bgcolor: selectedAudioName === audio.name ? 'action.selected' : 'transparent',
                              cursor: 'pointer',
                              '&:hover': { bgcolor: 'action.hover' },
                            }}
                            onClick={() => handleAudioSelect(audio.name)}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', py: 1 }}>
                              <ListItemText
                                primary={audio.name}
                                secondary={audio.url}
                              />
                              {selectedAudioName === audio.name && (
                                <CheckCircleIcon color="primary" sx={{ ml: 2 }} />
                              )}
                            </Box>
                            <Box sx={{ width: '100%', mb: 1 }} className="minimal-player">
                              <AudioPlayer
                                src={audio.url}
                                onError={(e) => {
                                  console.error("AudioPlayer Error for", audio.name, ":", e);
                                  console.error("URL:", audio.url);
                                }}
                                onLoadStart={() => console.log("Loading audio:", audio.name, audio.url)}
                                layout="horizontal"
                                showVolumeControl={false}
                                showSkipControls={false}
                                showLoopControl={false}
                                showDownloadProgress={false}
                                customProgressBarSection={[
                                  'CURRENT_TIME',
                                  'PROGRESS_BAR',
                                  'DURATION',
                                ]}
                                style={{
                                  boxShadow: 'none',
                                  backgroundColor: theme.palette.background.paper,
                                  borderRadius: '4px',
                                  padding: '2px',
                                  width: '100%',
                                  fontSize: '12px',
                                  '--rhap_theme-color': theme.palette.primary.main,
                                  '--rhap_bar-color': theme.palette.primary.main,
                                }}
                              />
                            </Box>
                          </ListItem>
                        ))}
                      </List>
                      {pagination.total_pages > 1 && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                          <Pagination 
                            count={pagination.total_pages} 
                            page={page} 
                            onChange={handlePageChange}
                            color="primary"
                            showFirstButton
                            showLastButton
                          />
                        </Box>
                      )}
                    </>
                  )}
                </Box>
              </Grid>

              {/* Right Column: Transcribe Button & Results */}
              <Grid item xs={12} md={6}>
                <Box sx={{ position: 'sticky', top: 16 }}>
                  {/* Transcribe Button */}
                  <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    onClick={() => transcribeFromServer(selectedAudioName)}
                    disabled={!selectedAudioName || transcribing}
                    startIcon={transcribing ? <CircularProgress size={20} /> : <PlayArrowIcon />}
                    sx={{ mb: 3 }}
                  >
                    {transcribing ? "Transcribing..." : "Transcribe Selected Audio"}
                  </Button>

                  {/* Transcript Results */}
                  {(transcript || transcribing) && (
                    <Paper variant="outlined" sx={{ p: 3 }}>
                      <Typography variant="h6" gutterBottom>
                        Transcription Result
                      </Typography>
                      
                      {modelInfo && (
                        <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip label={`Model: ${modelInfo.name}`} size="small" color="primary" />
                          <Chip label={`Type: ${modelInfo.type}`} size="small" />
                          <Chip label={`Device: ${modelInfo.device}`} size="small" />
                        </Box>
                      )}
                      
                      <Divider sx={{ my: 2 }} />
                      
                      {transcribing ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 4 }}>
                          <CircularProgress size={24} />
                          <Typography color="text.secondary">
                            Transcribing audio with active STT model...
                          </Typography>
                        </Box>
                      ) : (
                        <Card variant="outlined">
                          <CardContent>
                            <Typography
                              variant="body1"
                              sx={{
                                whiteSpace: 'pre-wrap',
                                fontFamily: 'monospace',
                                minHeight: 100,
                              }}
                            >
                              {transcript || "No transcript yet"}
                            </Typography>
                          </CardContent>
                        </Card>
                      )}
                    </Paper>
                  )}
                </Box>
              </Grid>
            </Grid>
          )}

          {/* Tab 1: Record New Audio */}
          {tabValue === 1 && (
            <Grid container spacing={3}>
              {/* Left Column: Recording Interface */}
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <RecordingVisualizer isRecording={recording} />
                  
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    {!recording ? (
                      <Button
                        variant="contained"
                        size="large"
                        onClick={startRecording}
                        startIcon={<MicIcon />}
                        disabled={transcribing}
                      >
                        Start Recording
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        color="error"
                        size="large"
                        onClick={stopRecording}
                        startIcon={<StopIcon />}
                      >
                        Stop Recording
                      </Button>
                    )}
                  </Box>

                  {recordedUrl && (
                    <Box sx={{ width: '100%', mt: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Recording preview:
                      </Typography>
                      <Box className="minimal-player" sx={{ width: '100%' }}>
                        <AudioPlayer
                          src={recordedUrl}
                          onError={(e) => {
                            console.error("AudioPlayer Error for recording:", e);
                            console.error("URL:", recordedUrl);
                          }}
                          onLoadStart={() => console.log("Loading recorded audio:", recordedUrl)}
                          layout="horizontal"
                          showVolumeControl={false}
                          showSkipControls={false}
                          showLoopControl={false}
                          showDownloadProgress={false}
                          customProgressBarSection={[
                            'CURRENT_TIME',
                            'PROGRESS_BAR',
                            'DURATION',
                          ]}
                          style={{
                            boxShadow: 'none',
                            backgroundColor: theme.palette.background.paper,
                            borderRadius: '4px',
                            width: '100%',
                            '--rhap_theme-color': theme.palette.primary.main,
                            '--rhap_bar-color': theme.palette.primary.main,
                          }}
                        />
                      </Box>
                    </Box>
                  )}
                </Box>
              </Grid>

              {/* Right Column: Transcribe Button & Results */}
              <Grid item xs={12} md={6}>
                <Box sx={{ position: 'sticky', top: 16 }}>
                  {/* Transcribe Button */}
                  <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    onClick={transcribeRecorded}
                    disabled={!recordedUrl || transcribing}
                    startIcon={transcribing ? <CircularProgress size={20} /> : <PlayArrowIcon />}
                    sx={{ mb: 3 }}
                  >
                    {transcribing ? "Transcribing..." : "Transcribe Recording"}
                  </Button>

                  {/* Transcript Results */}
                  {(transcript || transcribing) && (
                    <Paper variant="outlined" sx={{ p: 3 }}>
                      <Typography variant="h6" gutterBottom>
                        Transcription Result
                      </Typography>
                      
                      {modelInfo && (
                        <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip label={`Model: ${modelInfo.name}`} size="small" color="primary" />
                          <Chip label={`Type: ${modelInfo.type}`} size="small" />
                          <Chip label={`Device: ${modelInfo.device}`} size="small" />
                        </Box>
                      )}
                      
                      <Divider sx={{ my: 2 }} />
                      
                      {transcribing ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 4 }}>
                          <CircularProgress size={24} />
                          <Typography color="text.secondary">
                            Transcribing audio with active STT model...
                          </Typography>
                        </Box>
                      ) : (
                        <Card variant="outlined">
                          <CardContent>
                            <Typography
                              variant="body1"
                              sx={{
                                whiteSpace: 'pre-wrap',
                                fontFamily: 'monospace',
                                minHeight: 100,
                              }}
                            >
                              {transcript || "No transcript yet"}
                            </Typography>
                          </CardContent>
                        </Card>
                      )}
                    </Paper>
                  )}
                </Box>
              </Grid>
            </Grid>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

export default STTTester;
