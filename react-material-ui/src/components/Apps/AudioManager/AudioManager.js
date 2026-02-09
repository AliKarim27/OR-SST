import React, { useState, useEffect, useRef } from "react";
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Pagination from '@mui/material/Pagination';
import { useTheme } from '@mui/material/styles';
import DeleteIcon from '@mui/icons-material/Delete';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AudioPlayer from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';

// Recording visualizer styles (colors will be injected dynamically)
const visualizerStyles = `
  @keyframes barBounce {
    0%, 100% { height: 4px; }
    50% { height: 24px; }
  }
  
  .recording-visualizer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    height: 40px;
    padding: 8px;
  }
  
  .visualizer-bar {
    width: 3px;
    border-radius: 2px;
    animation: barBounce 0.6s ease-in-out infinite;
  }
`;

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
  
  /* Make the player fill its container */
  .minimal-player .rhap_container {
    width: 100% !important;
    padding: 4px 8px !important;
  }
  
  .minimal-player .rhap_progress-container {
    flex: 1;
  }
`;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

// Recording Visualizer Component
const RecordingVisualizer = ({ isRecording, mediaRecorder }) => {
  const theme = useTheme();
  const [barHeights, setBarHeights] = useState(Array(12).fill(0.3));
  const analyserRef = useRef(null);
  const animationIdRef = useRef(null);

  useEffect(() => {
    if (!isRecording) {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      return;
    }

    const animate = () => {
      if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        const newHeights = Array(12).fill(0).map((_, i) => {
          const index = Math.floor((i / 12) * dataArray.length);
          return Math.min(1, (dataArray[index] / 255) * 1.5);
        });
        setBarHeights(newHeights);
      }
      animationIdRef.current = requestAnimationFrame(animate);
    };

    animationIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [isRecording]);

  useEffect(() => {
    if (isRecording && mediaRecorder?.stream) {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        const source = audioContext.createMediaStreamAudioSource(mediaRecorder.stream);
        source.connect(analyser);
        analyserRef.current = analyser;
      } catch (e) {
        console.error("Could not setup visualizer:", e);
      }
    }
  }, [isRecording, mediaRecorder]);

  // Create gradient using theme colors
  const primaryColor = theme.palette.primary.main; // #605DFF
  const accentColor = theme.palette.primary[600]; // #1f64f1
  const barGradient = `linear-gradient(180deg, ${accentColor}, ${primaryColor})`;

  return (
    <Box className="recording-visualizer">
      {barHeights.map((height, i) => (
        <div
          key={i}
          className="visualizer-bar"
          style={{
            height: `${Math.max(4, height * 24)}px`,
            background: barGradient,
            animationDelay: `${i * 0.05}s`,
          }}
        />
      ))}
    </Box>
  );
}

const AudioManager = () => {
  const theme = useTheme();
  const [audios, setAudios] = useState([]);
  const [localAudios, setLocalAudios] = useState([]);
  const [name, setName] = useState("");
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, total_pages: 0, current_page: 1, page_size: 5 });
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // Inject CSS to hide extra controls
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = playerStyles + visualizerStyles;
    document.head.appendChild(styleElement);
    return () => document.head.removeChild(styleElement);
  }, []);

  // Fetch saved audios from backend on mount and when page changes
  useEffect(() => {
    fetchServerAudios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const fetchServerAudios = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_BASE}/list_audio/?page=${page}&page_size=5`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Convert relative URLs to absolute URLs
      const audiosWithAbsoluteUrls = (data.list || []).map(audio => ({
        ...audio,
        url: audio.url.startsWith('http') ? audio.url : `${API_BASE}${audio.url}`
      }));
      setAudios(audiosWithAbsoluteUrls);
      setPagination(data.pagination || { total: 0, total_pages: 0, current_page: page, page_size: 5 });
    } catch (e) {
      console.error("Failed to fetch audios", e);
      setError(`Failed to load server audios: ${e.message}`);
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const dataUrl = await new Promise((res) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result);
          reader.readAsDataURL(blob);
        });
        const id = Date.now().toString();
        const newAudio = { id, name: name || `Audio ${localAudios.length + 1}`, dataUrl, blob, createdAt: new Date().toISOString(), saved: false };
        setLocalAudios((s) => [newAudio, ...s]);
        setName("");
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

  const handleUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      setError("");
      const dataUrl = await readFileAsDataUrl(file);
      const id = Date.now().toString();
      const newAudio = { id, name: name || file.name, dataUrl, blob: file, createdAt: new Date().toISOString(), saved: false };
      setLocalAudios((s) => [newAudio, ...s]);
      setName("");
      e.target.value = null;
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
    }
  };

  const saveAudioToServer = async (audioId, isLocal = true) => {
    try {
      setError("");
      setSavingId(audioId);
      const audio = isLocal ? localAudios.find((a) => a.id === audioId) : null;
      if (!audio) {
        setError("Audio not found");
        return;
      }

      const formData = new FormData();
      formData.append("audio", audio.blob);
      formData.append("filename", audio.name);

      const res = await fetch(`${API_BASE}/upload_audio/`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await res.json();

      // Remove from local, fetch updated list from server
      setLocalAudios((s) => s.filter((a) => a.id !== audioId));
      await fetchServerAudios();
    } catch (e) {
      console.error("Failed to save audio", e);
      setError(`Failed to save audio: ${e.message}`);
    } finally {
      setSavingId(null);
    }
  };

  const deleteLocalAudio = (id) => {
    setLocalAudios((s) => s.filter((a) => a.id !== id));
  };

  const deleteAudioFromServer = async (audioName) => {
    try {
      setError("");
      setSavingId(audioName);
      const res = await fetch(`${API_BASE}/delete_audio/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filename: audioName }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      // Remove from list and fetch updated audios
      setAudios((s) => s.filter((a) => a.name !== audioName));
      await fetchServerAudios();
    } catch (e) {
      console.error("Failed to delete audio", e);
      setError(`Failed to delete audio: ${e.message}`);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Paper style={{ padding: 16 }}>
      <Typography variant="h5" gutterBottom>
        OR Central
      </Typography>

      {error && <Alert severity="error" onClose={() => setError("")} style={{ marginBottom: 12 }}>{error}</Alert>}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <TextField label="Name" size="small" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          accept="audio/*"
          style={{ display: "none" }}
          id="audio-upload"
          type="file"
          onChange={handleUpload}
        />
        <label htmlFor="audio-upload">
          <Button variant="outlined" component="span" startIcon={<UploadFileIcon />}>
            Upload
          </Button>
        </label>
        {!recording ? (
          <Button variant="contained" color="primary" startIcon={<MicIcon />} onClick={startRecording}>
            Record
          </Button>
        ) : (
          <Button variant="contained" color="secondary" startIcon={<StopIcon />} onClick={stopRecording}>
            Stop
          </Button>
        )}
      </div>

      {/* Recording Visualizer */}
      {recording && (
        <Box style={{ marginBottom: 16, border: "1px solid #ccc", borderRadius: 4, backgroundColor: "#f5f5f5" }}>
          <RecordingVisualizer isRecording={recording} mediaRecorder={mediaRecorderRef.current} />
        </Box>
      )}

      {/* Local Unsaved Audios */}
      {localAudios.length > 0 && (
        <Box style={{ marginBottom: 24 }}>
          <Typography variant="subtitle1" gutterBottom>
            📝 Local Audios ({localAudios.length}) - Not yet saved
          </Typography>
          <List>
            {localAudios.map((a) => (
              <ListItem key={a.id} divider secondaryAction={
                <Box style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Button
                    size="small"
                    color="primary"
                    startIcon={savingId === a.id ? <CircularProgress size={20} /> : <CloudUploadIcon />}
                    onClick={() => saveAudioToServer(a.id, true)}
                    disabled={savingId !== null}
                  >
                    Save
                  </Button>
                  <IconButton edge="end" aria-label="delete" onClick={() => deleteLocalAudio(a.id)}>
                    <DeleteIcon />
                  </IconButton>
                </Box>
              }>
                <ListItemText primary={a.name} secondary={new Date(a.createdAt).toLocaleString()} />
                <Box style={{ marginLeft: 12, width: 350, flex: 'none', overflow: 'visible', display: 'flex', alignItems: 'center', gap: '8px' }} className="minimal-player">
                  <AudioPlayer
                    src={a.dataUrl}
                    onError={(e) => console.log("Error:", e)}
                    layout="horizontal"
                    showVolumeControl={false}
                    showSkipControls={false}
                    showLoopControl={false}
                    showDownloadProgress={false}
                    style={{
                      boxShadow: 'none',
                      backgroundColor: '#ffffff',
                      borderRadius: '4px',
                      padding: '2px',
                      width: '100%',
                      fontSize: '12px',
                      transform: 'scale(0.75)',
                      transformOrigin: 'left center'
                    }}
                  />
                </Box>
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Server Saved Audios */}
      <Box>
        <Typography variant="subtitle1" gutterBottom>
          ☁️ Saved Audios ({pagination.total})
        </Typography>
        {loading && <CircularProgress />}
        {!loading && audios.length === 0 && (
          <Typography variant="body2" color="textSecondary">
            No audios saved yet. Record or upload and save to server.
          </Typography>
        )}
        <List>
          {audios.map((a) => (
            <ListItem key={a.name} divider secondaryAction={
              <IconButton edge="end" aria-label="delete" onClick={() => deleteAudioFromServer(a.name)} disabled={savingId !== null}>
                <DeleteIcon />
              </IconButton>
            }>
              <ListItemText primary={a.name} secondary={`URL: ${a.url}`} />
              <Box style={{ marginLeft: 12, width: 350, flex: 'none', overflow: 'visible', display: 'flex', alignItems: 'center', gap: '8px' }} className="minimal-player">
                <AudioPlayer
                  src={a.url}
                  onError={(e) => {
                    console.error("AudioPlayer Error for", a.name, ":", e);
                    console.error("URL:", a.url);
                  }}
                  onLoadStart={() => console.log("Loading audio:", a.name, a.url)}
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
                    transform: 'scale(0.75)',
                    transformOrigin: 'left center',
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
      </Box>
    </Paper>
  );
};

export default AudioManager;
