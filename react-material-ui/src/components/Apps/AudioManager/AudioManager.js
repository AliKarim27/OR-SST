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
import DeleteIcon from '@mui/icons-material/Delete';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

const API_BASE = "http://localhost:8000/api";

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

function readFileAsBlob(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Blob([reader.result], { type: file.type }));
    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(file);
  });
}

const AudioManager = () => {
  const [audios, setAudios] = useState([]);
  const [localAudios, setLocalAudios] = useState([]);
  const [name, setName] = useState("");
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // Fetch saved audios from backend on mount
  useEffect(() => {
    fetchServerAudios();
  }, []);

  const fetchServerAudios = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_BASE}/list_audio/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAudios(data.list || []);
    } catch (e) {
      console.error("Failed to fetch audios", e);
      setError(`Failed to load server audios: ${e.message}`);
    } finally {
      setLoading(false);
    }
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
      const data = await res.json();

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
                <audio controls src={a.dataUrl} style={{ marginLeft: 12, width: 250 }} />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Server Saved Audios */}
      <Box>
        <Typography variant="subtitle1" gutterBottom>
          ☁️ Saved Audios ({audios.length})
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
              <IconButton edge="end" aria-label="delete" disabled>
                <DeleteIcon />
              </IconButton>
            }>
              <ListItemText primary={a.name} secondary={`URL: ${a.url}`} />
              <audio controls src={a.url} style={{ marginLeft: 12, width: 250 }} />
            </ListItem>
          ))}
        </List>
      </Box>
    </Paper>
  );
};

export default AudioManager;
