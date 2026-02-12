import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Chip,
  Divider,
  TextField,
  InputAdornment,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Pagination,
  Menu,
  MenuItem,
  ListItemAvatar,
  Avatar,
  Snackbar,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SaveIcon from "@mui/icons-material/Save";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import AudioFileIcon from "@mui/icons-material/AudioFile";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DownloadIcon from "@mui/icons-material/Download";
import TableChartIcon from "@mui/icons-material/TableChart";
import DataObjectIcon from "@mui/icons-material/DataObject";
import DescriptionIcon from "@mui/icons-material/Description";
import NERApiService from "../../../services/nerApi";
import AudioPlayer from "react-h5-audio-player";
import "react-h5-audio-player/lib/styles.css";

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

  const primaryColor = theme.palette.primary.main;
  const accentColor = theme.palette.primary[600];
  const barGradient = `linear-gradient(180deg, ${accentColor}, ${primaryColor})`;

  return (
    <Box sx={{ display: "flex", justifyContent: "center", gap: 0.8, py: 2 }}>
      {barHeights.map((height, i) => (
        <div
          key={i}
          style={{
            width: "3px",
            height: `${Math.max(4, height * 24)}px`,
            background: barGradient,
            borderRadius: "2px",
            animation: `barBounce 0.6s ease-in-out infinite`,
            animationDelay: `${i * 0.05}s`,
          }}
        />
      ))}
    </Box>
  );
};

const Workflow = () => {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  
  // Step 1: Audio state
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioName, setAudioName] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordingError, setRecordingError] = useState("");
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // Audio Library Dialog state
  const [libraryDialogOpen, setLibraryDialogOpen] = useState(false);
  const [savedAudios, setSavedAudios] = useState([]);
  const [loadingAudios, setLoadingAudios] = useState(false);
  const [audioLibraryPage, setAudioLibraryPage] = useState(1);
  const [audioLibraryPagination, setAudioLibraryPagination] = useState({ total: 0, total_pages: 0, current_page: 1, page_size: 10 });
  const [audioLibrarySearch, setAudioLibrarySearch] = useState("");
  const [selectedLibraryAudio, setSelectedLibraryAudio] = useState(null);

  // Step 2: Transcription state
  const [transcript, setTranscript] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState("");

  // Step 3: NER extraction state
  const [extracting, setExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState("");
  const [extractionResult, setExtractionResult] = useState(null);
  const [rawEntities, setRawEntities] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [entityPage, setEntityPage] = useState(0);
  const [entityRowsPerPage, setEntityRowsPerPage] = useState(5);

  // Export state
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [exportSnackbar, setExportSnackbar] = useState({ open: false, message: "", severity: "success" });

  // Export utility functions
  const flattenObject = (obj, prefix = "") => {
    const result = {};
    for (const key in obj) {
      const newKey = prefix ? `${prefix}_${key}` : key;
      if (obj[key] !== null && typeof obj[key] === "object" && !Array.isArray(obj[key])) {
        Object.assign(result, flattenObject(obj[key], newKey));
      } else if (Array.isArray(obj[key])) {
        result[newKey] = obj[key].map(item => 
          typeof item === "object" ? JSON.stringify(item) : item
        ).join("; ");
      } else {
        result[newKey] = obj[key];
      }
    }
    return result;
  };

  const exportToJSON = () => {
    try {
      const exportData = {
        transcript,
        extractionResult,
        rawEntities,
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `or-extraction-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setExportSnackbar({ open: true, message: "Exported as JSON successfully", severity: "success" });
    } catch (e) {
      setExportSnackbar({ open: true, message: `Export failed: ${e.message}`, severity: "error" });
    }
    setExportMenuAnchor(null);
  };

  const exportToCSV = () => {
    try {
      // Create CSV from raw entities
      if (rawEntities.length === 0) {
        setExportSnackbar({ open: true, message: "No entities to export", severity: "warning" });
        return;
      }
      
      const headers = ["Entity", "Label", "Confidence", "Start", "End"];
      const rows = rawEntities.map(e => [
        `"${(e.word || "").replace(/"/g, '""')}"`,
        e.entity || "",
        ((e.score || 0) * 100).toFixed(1),
        e.start || 0,
        e.end || 0
      ]);
      
      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `or-entities-${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setExportSnackbar({ open: true, message: "Exported as CSV successfully", severity: "success" });
    } catch (e) {
      setExportSnackbar({ open: true, message: `Export failed: ${e.message}`, severity: "error" });
    }
    setExportMenuAnchor(null);
  };

  const exportToExcel = () => {
    try {
      // Create Excel-compatible XML (SpreadsheetML)
      if (!extractionResult && rawEntities.length === 0) {
        setExportSnackbar({ open: true, message: "No data to export", severity: "warning" });
        return;
      }

      // Flatten the extraction result for tabular display
      const flatData = extractionResult ? flattenObject(extractionResult) : {};
      
      let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#E3F2FD" ss:Pattern="Solid"/>
    </Style>
  </Styles>`;

      // Sheet 1: Extracted Information
      xmlContent += `
  <Worksheet ss:Name="Extracted Info">
    <Table>
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Field</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Value</Data></Cell>
      </Row>`;
      
      for (const [key, value] of Object.entries(flatData)) {
        const displayValue = value === null || value === undefined ? "" : String(value);
        xmlContent += `
      <Row>
        <Cell><Data ss:Type="String">${key.replace(/_/g, " ").replace(/&/g, "&amp;")}</Data></Cell>
        <Cell><Data ss:Type="String">${displayValue.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Data></Cell>
      </Row>`;
      }
      
      xmlContent += `
    </Table>
  </Worksheet>`;

      // Sheet 2: Raw Entities
      if (rawEntities.length > 0) {
        xmlContent += `
  <Worksheet ss:Name="Raw Entities">
    <Table>
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Entity</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Label</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Confidence</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Start</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">End</Data></Cell>
      </Row>`;
        
        for (const entity of rawEntities) {
          xmlContent += `
      <Row>
        <Cell><Data ss:Type="String">${(entity.word || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Data></Cell>
        <Cell><Data ss:Type="String">${entity.entity || ""}</Data></Cell>
        <Cell><Data ss:Type="Number">${((entity.score || 0) * 100).toFixed(1)}</Data></Cell>
        <Cell><Data ss:Type="Number">${entity.start || 0}</Data></Cell>
        <Cell><Data ss:Type="Number">${entity.end || 0}</Data></Cell>
      </Row>`;
        }
        
        xmlContent += `
    </Table>
  </Worksheet>`;
      }

      // Sheet 3: Transcript
      xmlContent += `
  <Worksheet ss:Name="Transcript">
    <Table>
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Original Transcript</Data></Cell>
      </Row>
      <Row>
        <Cell><Data ss:Type="String">${(transcript || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Data></Cell>
      </Row>
    </Table>
  </Worksheet>
</Workbook>`;

      const blob = new Blob([xmlContent], { type: "application/vnd.ms-excel" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `or-extraction-${Date.now()}.xls`;
      link.click();
      URL.revokeObjectURL(url);
      setExportSnackbar({ open: true, message: "Exported as Excel successfully", severity: "success" });
    } catch (e) {
      setExportSnackbar({ open: true, message: `Export failed: ${e.message}`, severity: "error" });
    }
    setExportMenuAnchor(null);
  };

  const exportFormattedReport = () => {
    try {
      // Create a formatted text report
      let reportContent = "OR-SST EXTRACTION REPORT\n";
      reportContent += "=".repeat(50) + "\n\n";
      reportContent += `Generated: ${new Date().toLocaleString()}\n\n`;
      
      reportContent += "TRANSCRIPT\n";
      reportContent += "-".repeat(30) + "\n";
      reportContent += (transcript || "No transcript available") + "\n\n";
      
      if (extractionResult) {
        reportContent += "EXTRACTED INFORMATION\n";
        reportContent += "-".repeat(30) + "\n";
        const flatData = flattenObject(extractionResult);
        for (const [key, value] of Object.entries(flatData)) {
          if (value !== null && value !== undefined && value !== "" && value !== "false") {
            reportContent += `${key.replace(/_/g, " ").toUpperCase()}: ${value}\n`;
          }
        }
        reportContent += "\n";
      }
      
      if (rawEntities.length > 0) {
        reportContent += "RAW ENTITIES\n";
        reportContent += "-".repeat(30) + "\n";
        reportContent += "Entity | Label | Confidence\n";
        for (const entity of rawEntities) {
          reportContent += `${entity.word} | ${entity.entity} | ${((entity.score || 0) * 100).toFixed(1)}%\n`;
        }
      }

      const blob = new Blob([reportContent], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `or-report-${Date.now()}.txt`;
      link.click();
      URL.revokeObjectURL(url);
      setExportSnackbar({ open: true, message: "Exported report successfully", severity: "success" });
    } catch (e) {
      setExportSnackbar({ open: true, message: `Export failed: ${e.message}`, severity: "error" });
    }
    setExportMenuAnchor(null);
  };

  // Inject CSS
  useEffect(() => {
    const styleElement = document.createElement("style");
    styleElement.textContent = playerStyles;
    document.head.appendChild(styleElement);
    return () => document.head.removeChild(styleElement);
  }, []);

  // Fetch saved audios when library dialog opens or page changes
  useEffect(() => {
    if (libraryDialogOpen) {
      fetchSavedAudios();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryDialogOpen, audioLibraryPage]);

  const fetchSavedAudios = async () => {
    try {
      setLoadingAudios(true);
      const res = await fetch(`${API_BASE}/list_audio/?page=${audioLibraryPage}&page_size=10`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Convert relative URLs to absolute URLs
      const audiosWithAbsoluteUrls = (data.list || []).map(audio => ({
        ...audio,
        url: audio.url.startsWith('http') ? audio.url : `${API_BASE}${audio.url}`
      }));
      setSavedAudios(audiosWithAbsoluteUrls);
      setAudioLibraryPagination(data.pagination || { total: 0, total_pages: 0, current_page: audioLibraryPage, page_size: 10 });
    } catch (e) {
      console.error("Failed to fetch audios", e);
      setRecordingError(`Failed to load audio library: ${e.message}`);
    } finally {
      setLoadingAudios(false);
    }
  };

  const handleSelectFromLibrary = async (audio) => {
    try {
      setRecordingError("");
      // Fetch the audio file as a blob
      const response = await fetch(audio.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      setAudioBlob(blob);
      setAudioUrl(audio.url);
      setAudioName(audio.name);
      setLibraryDialogOpen(false);
      setSelectedLibraryAudio(null);
    } catch (e) {
      setRecordingError(`Failed to load audio: ${e.message}`);
    }
  };

  const handleLibraryPageChange = (event, value) => {
    setAudioLibraryPage(value);
  };

  // Filter audios based on search
  const filteredSavedAudios = savedAudios.filter(audio =>
    audio.name.toLowerCase().includes(audioLibrarySearch.toLowerCase())
  );

  // Step 1: Record or upload audio
  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setRecordingError("Media recording is not supported in this browser.");
      return;
    }
    try {
      setRecordingError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };
      mr.start();
      setRecording(true);
    } catch (e) {
      setRecordingError(`Could not start recording: ${e.message}`);
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
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setRecordingError("");
      setAudioBlob(file);
      setAudioUrl(URL.createObjectURL(file));
      e.target.value = null;
    } catch (err) {
      setRecordingError(`Upload failed: ${err.message}`);
    }
  };

  const handleTranscribe = async () => {
    if (!audioBlob) {
      setTranscriptionError("No audio selected");
      return;
    }

    try {
      setTranscribing(true);
      setTranscriptionError("");
      setTranscript("");

      const formData = new FormData();
      formData.append("audio", audioBlob);

      const response = await fetch(`${API_BASE}/transcribe_extract/`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data.transcript) {
        setTranscript(data.transcript);
        setActiveStep(2); // Move to NER step
      } else {
        setTranscriptionError(data.error || "Transcription failed");
      }
    } catch (e) {
      setTranscriptionError(`Transcription error: ${e.message}`);
    } finally {
      setTranscribing(false);
    }
  };

  const handleExtractEntities = async () => {
    if (!transcript) {
      setExtractionError("No transcript available");
      return;
    }

    try {
      setExtracting(true);
      setExtractionError("");

      const response = await NERApiService.extract(transcript);
      
      setExtractionResult(response.entities || {});
      setRawEntities(response.raw_entities || []);
      setEntityPage(0);
    } catch (e) {
      setExtractionError(`Extraction error: ${e.message}`);
    } finally {
      setExtracting(false);
    }
  };

  const handleEditTranscript = () => {
    setActiveStep(1);
  };

  // Filter and paginate entities
  const filteredEntities = rawEntities.filter(e =>
    e.word?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.entity?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const paginatedEntities = filteredEntities.slice(
    entityPage * entityRowsPerPage,
    entityPage * entityRowsPerPage + entityRowsPerPage
  );

  const steps = ["Audio", "Transcription", "NER Extraction"];

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
      <Typography variant="h4" gutterBottom>
        OR-SST Workflow
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Complete workflow: Record/Upload audio → Transcribe to text → Extract entities
      </Typography>

      {/* Stepper */}
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Step 1: Audio */}
      {activeStep === 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Step 1: Record or Upload Audio
          </Typography>

          {recordingError && (
            <Alert severity="error" onClose={() => setRecordingError("")} sx={{ mb: 2 }}>
              {recordingError}
            </Alert>
          )}

          <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
            <Button
              variant="outlined"
              startIcon={<FolderOpenIcon />}
              onClick={() => setLibraryDialogOpen(true)}
            >
              Select from Library
            </Button>
            
            {!recording ? (
              <Button
                variant="contained"
                startIcon={<MicIcon />}
                onClick={startRecording}
              >
                Start Recording
              </Button>
            ) : (
              <Button
                variant="contained"
                color="error"
                startIcon={<StopIcon />}
                onClick={stopRecording}
              >
                Stop Recording
              </Button>
            )}

            <input
              accept="audio/*"
              style={{ display: "none" }}
              id="audio-upload"
              type="file"
              onChange={handleUpload}
            />
            <label htmlFor="audio-upload">
              <Button
                variant="outlined"
                component="span"
                startIcon={<UploadFileIcon />}
              >
                Upload Audio
              </Button>
            </label>
          </Box>

          {recording && (
            <Box sx={{ border: "1px solid #ccc", borderRadius: 1, mb: 3 }}>
              <RecordingVisualizer isRecording={recording} mediaRecorder={mediaRecorderRef.current} />
            </Box>
          )}

          {audioUrl && (
            <Box sx={{ mb: 3, p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Audio Preview {audioName && <Chip label={audioName} size="small" sx={{ ml: 1 }} />}
              </Typography>
              <Box className="minimal-player">
                <AudioPlayer
                  src={audioUrl}
                  layout="horizontal"
                  showVolumeControl={false}
                  showSkipControls={false}
                  showLoopControl={false}
                  showDownloadProgress={false}
                  style={{
                    boxShadow: "none",
                    backgroundColor: "#ffffff",
                    borderRadius: "4px",
                    padding: "2px",
                    width: "100%",
                    fontSize: "12px",
                  }}
                />
              </Box>
            </Box>
          )}

          <Button
            variant="contained"
            onClick={handleTranscribe}
            disabled={!audioBlob || transcribing}
            startIcon={transcribing ? <CircularProgress size={20} /> : <PlayArrowIcon />}
          >
            {transcribing ? "Transcribing..." : "Proceed to Transcription"}
          </Button>
        </Paper>
      )}

      {/* Step 2: Transcription */}
      {activeStep === 1 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Step 2: Review Transcript
          </Typography>

          {transcriptionError && (
            <Alert severity="error" onClose={() => setTranscriptionError("")} sx={{ mb: 2 }}>
              {transcriptionError}
            </Alert>
          )}

          <Typography variant="subtitle2" gutterBottom>
            Transcribed Text
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={6}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            variant="outlined"
            sx={{ mb: 2 }}
          />

          <Box sx={{ display: "flex", gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => setActiveStep(0)}
            >
              Back to Audio
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                setActiveStep(2);
                handleExtractEntities();
              }}
              disabled={!transcript}
              startIcon={<PlayArrowIcon />}
            >
              Proceed to NER Extraction
            </Button>
          </Box>
        </Paper>
      )}

      {/* Step 3: NER Extraction */}
      {activeStep === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Step 3: Entity Extraction Results
          </Typography>

          {extractionError && (
            <Alert severity="error" onClose={() => setExtractionError("")} sx={{ mb: 2 }}>
              {extractionError}
            </Alert>
          )}

          {/* Transcript Summary */}
          <Accordion sx={{ mb: 3 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">
                Original Transcript
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Paper variant="outlined" sx={{ p: 2, width: "100%", bgcolor: "grey.50" }}>
                <Typography variant="body2">{transcript}</Typography>
              </Paper>
            </AccordionDetails>
          </Accordion>

          {extracting ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 4 }}>
              <CircularProgress size={24} />
              <Typography color="text.secondary">
                Extracting entities...
              </Typography>
            </Box>
          ) : (
            <>
              {/* Extracted Entities Summary */}
              {extractionResult && Object.keys(extractionResult).length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Extracted Information
                  </Typography>
                  <Grid container spacing={2}>
                    {Object.entries(extractionResult).slice(0, 6).map(([key, value]) => (
                      <Grid item xs={12} sm={6} key={key}>
                        <Card variant="outlined">
                          <CardContent sx={{ py: 1.5 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase" }}>
                              {key.replace(/_/g, " ")}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 500, mt: 0.5 }}>
                              {Array.isArray(value) ? value.join(", ") : String(value)}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              {/* Raw Entities Table */}
              {rawEntities.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Raw Entity Predictions ({rawEntities.length})
                  </Typography>

                  {/* Search */}
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search entities by word or label..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setEntityPage(0);
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ mb: 2 }}
                  />

                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: "bold" }}>Entity</TableCell>
                          <TableCell sx={{ fontWeight: "bold" }}>Label</TableCell>
                          <TableCell sx={{ fontWeight: "bold" }}>Confidence</TableCell>
                          <TableCell sx={{ fontWeight: "bold" }}>Position</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {paginatedEntities.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                              <SearchIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
                              <Typography color="text.secondary">
                                No entities match your search
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedEntities.map((entity, idx) => (
                            <TableRow key={idx}>
                              <TableCell>
                                <Chip
                                  label={entity.word}
                                  size="small"
                                  sx={{
                                    bgcolor: "#e3f2fd",
                                    color: "primary.main",
                                  }}
                                />
                              </TableCell>
                              <TableCell>{entity.entity}</TableCell>
                              <TableCell>{(entity.score * 100).toFixed(1)}%</TableCell>
                              <TableCell>{entity.start}-{entity.end}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </>
          )}

          <Divider sx={{ my: 2 }} />

          {/* Export Section */}
          {(extractionResult || rawEntities.length > 0) && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Export Results
              </Typography>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Download the extraction results in your preferred format
                </Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  <Button
                    variant="outlined"
                    startIcon={<TableChartIcon />}
                    onClick={exportToExcel}
                    size="small"
                  >
                    Excel (.xls)
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<DescriptionIcon />}
                    onClick={exportToCSV}
                    size="small"
                  >
                    CSV
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<DataObjectIcon />}
                    onClick={exportToJSON}
                    size="small"
                  >
                    JSON
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<DescriptionIcon />}
                    onClick={exportFormattedReport}
                    size="small"
                  >
                    Text Report
                  </Button>
                </Box>
              </Paper>
            </Box>
          )}

          <Box sx={{ display: "flex", gap: 2 }}>
            <Button
              variant="outlined"
              onClick={handleEditTranscript}
            >
              Edit Transcript
            </Button>
            <Button
              variant="contained"
              onClick={() => setActiveStep(0)}
            >
              New Workflow
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={<DownloadIcon />}
              onClick={(e) => setExportMenuAnchor(e.currentTarget)}
              disabled={!extractionResult && rawEntities.length === 0}
            >
              Quick Export
            </Button>
          </Box>

          {/* Export Quick Menu */}
          <Menu
            anchorEl={exportMenuAnchor}
            open={Boolean(exportMenuAnchor)}
            onClose={() => setExportMenuAnchor(null)}
          >
            <MenuItem onClick={exportToExcel}>
              <ListItemIcon>
                <TableChartIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Export as Excel</ListItemText>
            </MenuItem>
            <MenuItem onClick={exportToCSV}>
              <ListItemIcon>
                <DescriptionIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Export as CSV</ListItemText>
            </MenuItem>
            <MenuItem onClick={exportToJSON}>
              <ListItemIcon>
                <DataObjectIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Export as JSON</ListItemText>
            </MenuItem>
            <MenuItem onClick={exportFormattedReport}>
              <ListItemIcon>
                <DescriptionIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Export Text Report</ListItemText>
            </MenuItem>
          </Menu>
        </Paper>
      )}

      {/* Export Snackbar */}
      <Snackbar
        open={exportSnackbar.open}
        autoHideDuration={4000}
        onClose={() => setExportSnackbar({ ...exportSnackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setExportSnackbar({ ...exportSnackbar, open: false })}
          severity={exportSnackbar.severity}
          sx={{ width: "100%" }}
        >
          {exportSnackbar.message}
        </Alert>
      </Snackbar>

      {/* Audio Library Selection Dialog */}
      <Dialog
        open={libraryDialogOpen}
        onClose={() => {
          setLibraryDialogOpen(false);
          setSelectedLibraryAudio(null);
          setAudioLibrarySearch("");
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Select Audio from Library</DialogTitle>
        <DialogContent dividers>
          {/* Search */}
          <TextField
            fullWidth
            size="small"
            placeholder="Search audio files..."
            value={audioLibrarySearch}
            onChange={(e) => setAudioLibrarySearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />

          {loadingAudios ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : filteredSavedAudios.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <AudioFileIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
              <Typography color="text.secondary">
                {audioLibrarySearch
                  ? `No audio files match "${audioLibrarySearch}"`
                  : "No saved audio files. Record or upload audio in Audio Management first."}
              </Typography>
            </Box>
          ) : (
            <>
              <List sx={{ maxHeight: 300, overflow: "auto" }}>
                {filteredSavedAudios.map((audio) => (
                  <ListItem key={audio.name} disablePadding>
                    <ListItemButton
                      selected={selectedLibraryAudio?.name === audio.name}
                      onClick={() => setSelectedLibraryAudio(audio)}
                    >
                      <ListItemIcon>
                        {selectedLibraryAudio?.name === audio.name ? (
                          <CheckCircleIcon color="primary" />
                        ) : (
                          <AudioFileIcon />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={audio.name}
                        secondary={audio.url.split('/').pop()}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>

              {/* Preview selected audio */}
              {selectedLibraryAudio && (
                <Box sx={{ mt: 2, p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    Preview: {selectedLibraryAudio.name}
                  </Typography>
                  <Box className="minimal-player">
                    <AudioPlayer
                      src={selectedLibraryAudio.url}
                      layout="horizontal"
                      showVolumeControl={false}
                      showSkipControls={false}
                      showLoopControl={false}
                      showDownloadProgress={false}
                      style={{
                        boxShadow: "none",
                        backgroundColor: "#ffffff",
                        borderRadius: "4px",
                        padding: "2px",
                        fontSize: "12px",
                      }}
                    />
                  </Box>
                </Box>
              )}

              {/* Pagination */}
              {audioLibraryPagination.total_pages > 1 && (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                  <Pagination
                    count={audioLibraryPagination.total_pages}
                    page={audioLibraryPage}
                    onChange={handleLibraryPageChange}
                    color="primary"
                    size="small"
                  />
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setLibraryDialogOpen(false);
              setSelectedLibraryAudio(null);
              setAudioLibrarySearch("");
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => handleSelectFromLibrary(selectedLibraryAudio)}
            disabled={!selectedLibraryAudio}
          >
            Select Audio
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Workflow;
