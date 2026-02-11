import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  TextField,
  Chip,
  Card,
  CardContent,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Select,
  MenuItem,
  FormControl,
  Snackbar,
  Autocomplete,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LabelIcon from '@mui/icons-material/Label';
import PsychologyIcon from '@mui/icons-material/Psychology';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import NERApiService from '../../../services/nerApi';

// Default fallback color
const DEFAULT_COLOR = '#9e9e9e';

// Sample texts for testing
const SAMPLE_TEXTS = [
  {
    title: "General Surgery",
    text: "Patient John Doe underwent appendectomy on January 15, 2026 at 08:30. Surgeon was Dr. Smith with anesthetist Dr. Johnson. Blood pressure was 120 over 80. Administered propofol 200mg IV."
  },
  {
    title: "Orthopedic Procedure",
    text: "Total knee replacement performed by Dr. Williams on February 3, 2026. Patient received spinal anesthesia. Operation duration was 2 hours 30 minutes. Cefazolin 1g prophylaxis given."
  },
  {
    title: "Cardiac Surgery",
    text: "CABG procedure started at 07:00 in OR 5. Lead surgeon Dr. Anderson, first assistant Dr. Brown. Patient vitals: heart rate 72, oxygen saturation 98 percent. Heparin administered during bypass."
  },
];

function NERTester() {
  const [tabValue, setTabValue] = useState(0);
  const [error, setError] = useState("");
  const [extracting, setExtracting] = useState(false);
  
  // Input text state
  const [inputText, setInputText] = useState("");
  
  // Results state
  const [result, setResult] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  
  // Previous transcripts (from STT)
  const [transcripts, setTranscripts] = useState([]);
  const [selectedTranscript, setSelectedTranscript] = useState(null);

  // Entity types state (for coloring)
  const [entityTypes, setEntityTypes] = useState([]);
  const [entityTypesLoading, setEntityTypesLoading] = useState(false);

  // Label editing state
  const [isEditingLabels, setIsEditingLabels] = useState(false);
  const [editableTokens, setEditableTokens] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [savingToTraining, setSavingToTraining] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // Pagination state for label editor and raw entities
  const [labelEditorPage, setLabelEditorPage] = useState(0);
  const [labelEditorRowsPerPage, setLabelEditorRowsPerPage] = useState(10);
  const [rawEntitiesPage, setRawEntitiesPage] = useState(0);
  const [rawEntitiesRowsPerPage, setRawEntitiesRowsPerPage] = useState(10);

  // Fetch entity types on mount
  useEffect(() => {
    fetchEntityTypes();
  }, []);

  // Fetch previous transcripts on mount (from localStorage for now)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('recentTranscripts');
      if (stored) {
        setTranscripts(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load transcripts from storage', e);
    }
  }, []);

  const fetchEntityTypes = async () => {
    try {
      setEntityTypesLoading(true);
      const response = await NERApiService.getEntityTypes();
      setEntityTypes(response.entity_types || []);
    } catch (e) {
      console.error("Failed to fetch entity types", e);
    } finally {
      setEntityTypesLoading(false);
    }
  };

  const fetchAvailableTags = async () => {
    try {
      const response = await NERApiService.getAvailableTags();
      setAvailableTags(response.tags || []);
    } catch (e) {
      console.error("Failed to fetch available tags", e);
    }
  };

  // Get color for entity type from fetched data
  const getEntityColor = (entityType) => {
    const typeName = entityType.replace(/^[BI]-/, '').toUpperCase();
    const found = entityTypes.find(et => et.name.toUpperCase() === typeName);
    return found?.color || DEFAULT_COLOR;
  };

  const handleExtract = async (text) => {
    if (!text || !text.trim()) {
      setError("Please enter some text to analyze");
      return;
    }

    try {
      setExtracting(true);
      setError("");
      setResult(null);
      setModelInfo(null);
      setRawEntitiesPage(0);
      setLabelEditorPage(0);

      const response = await NERApiService.extract(text.trim());

      if (response.error && !response.entities) {
        throw new Error(response.error);
      }

      setResult(response);
      setModelInfo(response.model_info);
      
      // Save to recent transcripts
      saveToRecentTranscripts(text.trim());
      
    } catch (e) {
      console.error("Extraction failed", e);
      setError(`Extraction failed: ${e.message}`);
    } finally {
      setExtracting(false);
    }
  };

  const saveToRecentTranscripts = (text) => {
    try {
      const exists = transcripts.some(t => t.text === text);
      if (!exists && text.length > 10) {
        const newTranscripts = [
          { text, timestamp: new Date().toISOString() },
          ...transcripts.slice(0, 9)
        ];
        setTranscripts(newTranscripts);
        localStorage.setItem('recentTranscripts', JSON.stringify(newTranscripts));
      }
    } catch (e) {
      console.error('Failed to save transcript', e);
    }
  };

  const handleSelectSample = (sample) => {
    setInputText(sample.text);
    setSelectedTranscript(null);
  };

  const handleSelectTranscript = (transcript) => {
    setInputText(transcript.text);
    setSelectedTranscript(transcript.text);
  };

  const handleStartEditLabels = async () => {
    if (!result || !result.text) return;
    
    // Fetch available tags if not already loaded
    if (availableTags.length === 0) {
      await fetchAvailableTags();
    }

    // Tokenize text (split by whitespace)
    const tokens = result.text.trim().split(/\s+/);
    
    // Create a map of token positions to their predicted tags
    const tokenTags = tokens.map((token, idx) => {
      // Find if this token is part of an entity
      let tag = 'O'; // Default to Outside
      
      if (result.raw_entities) {
        // Calculate token position in original text
        let position = 0;
        for (let i = 0; i < idx; i++) {
          position += tokens[i].length + 1; // +1 for space
        }
        
        // Find entity that overlaps with this token
        const entity = result.raw_entities.find(e => {
          return (position >= e.start && position < e.end) ||
                 (position + token.length > e.start && position + token.length <= e.end) ||
                 (position <= e.start && position + token.length >= e.end);
        });
        
        if (entity) {
          // Extract entity type name (remove B- or I- prefix if present)
          let entityType = entity.entity.replace(/^[BI]-/, '');
          
          // Determine if this is the beginning or inside of the entity
          // Check if this token is at the start position of the entity
          const isBeginning = position === entity.start || 
                             (position < entity.start && position + token.length > entity.start);
          
          // Apply proper BIO tagging
          tag = isBeginning ? `B-${entityType}` : `I-${entityType}`;
        }
      }
      
      return { token, tag, index: idx };
    });
    
    setEditableTokens(tokenTags);
    setIsEditingLabels(true);
  };

  const handleTagChange = (index, newTag) => {
    setEditableTokens(prev => 
      prev.map(item => 
        item.index === index ? { ...item, tag: newTag } : item
      )
    );
  };

  const handleSaveToTrainingData = async () => {
    if (editableTokens.length === 0) return;

    try {
      setSavingToTraining(true);
      
      const tokens = editableTokens.map(item => item.token);
      const tags = editableTokens.map(item => item.tag);
      
      // Validate that all tags are in the correct BIO format
      const invalidTags = tags.filter(tag => {
        if (tag === 'O') return false; // O is valid
        if (tag.startsWith('B-') || tag.startsWith('I-')) return false; // Proper BIO tags are valid
        return true; // Everything else is invalid
      });
      
      if (invalidTags.length > 0) {
        throw new Error(`Invalid tags detected: ${[...new Set(invalidTags)].join(', ')}. All entity tags must start with B- or I-`);
      }
      
      // Validate against available tags
      if (availableTags.length > 0) {
        const unavailableTags = tags.filter(tag => !availableTags.includes(tag));
        if (unavailableTags.length > 0) {
          throw new Error(`Tags not in label map: ${[...new Set(unavailableTags)].join(', ')}. Available: ${availableTags.join(', ')}`);
        }
      }
      
      await NERApiService.addTrainingEntry(tokens, tags);
      
      setSnackbar({
        open: true,
        message: 'Successfully saved to training data!',
        severity: 'success'
      });
      
      setIsEditingLabels(false);
      
    } catch (e) {
      console.error('Failed to save training data', e);
      setSnackbar({
        open: true,
        message: `Failed to save: ${e.message}`,
        severity: 'error'
      });
    } finally {
      setSavingToTraining(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingLabels(false);
    setEditableTokens([]);
    setLabelEditorPage(0);
  };

  const handleLabelEditorPageChange = (event, newPage) => {
    setLabelEditorPage(newPage);
  };

  const handleLabelEditorRowsPerPageChange = (event) => {
    setLabelEditorRowsPerPage(parseInt(event.target.value, 10));
    setLabelEditorPage(0);
  };

  const handleRawEntitiesPageChange = (event, newPage) => {
    setRawEntitiesPage(newPage);
  };

  const handleRawEntitiesRowsPerPageChange = (event) => {
    setRawEntitiesRowsPerPage(parseInt(event.target.value, 10));
    setRawEntitiesPage(0);
  };

  const renderEntityHighlight = () => {
    if (!result || !result.raw_entities || result.raw_entities.length === 0) {
      return null;
    }

    // Create highlighted text
    const text = result.text;
    const entities = result.raw_entities.sort((a, b) => a.start - b.start);
    
    if (entities.length === 0) {
      return <Typography>{text}</Typography>;
    }

    const segments = [];
    let lastEnd = 0;

    entities.forEach((entity, idx) => {
      // Add text before entity
      if (entity.start > lastEnd) {
        segments.push(
          <span key={`text-${idx}`}>{text.slice(lastEnd, entity.start)}</span>
        );
      }
      
      // Add highlighted entity
      segments.push(
        <Chip
          key={`entity-${idx}`}
          label={`${entity.word}`}
          size="small"
          sx={{
            mx: 0.25,
            bgcolor: getEntityColor(entity.entity),
            color: 'white',
            fontWeight: 500,
            '& .MuiChip-label': { px: 1 }
          }}
          title={`${entity.entity}: ${(entity.score * 100).toFixed(1)}%`}
        />
      );
      
      lastEnd = entity.end;
    });

    // Add remaining text
    if (lastEnd < text.length) {
      segments.push(<span key="text-final">{text.slice(lastEnd)}</span>);
    }

    return (
      <Box sx={{ lineHeight: 2.2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        {segments}
      </Box>
    );
  };

  const renderExtractedEntities = () => {
    if (!result || !result.entities) {
      return null;
    }

    const entities = result.entities;
    const hasRawEntities = result.raw_entities && result.raw_entities.length > 0;
    
    // Show "no entities" message only if both structured AND raw entities are empty
    if (Object.keys(entities).length === 0 && !hasRawEntities) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          No entities were extracted from the text. The model may need more training data.
        </Alert>
      );
    }
    
    // If no structured entities but raw entities exist, show info message
    if (Object.keys(entities).length === 0 && hasRawEntities) {
      return (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Model detected {hasRawEntities ? result.raw_entities.length : 0} entities, but post-processing returned no structured data. 
          Check raw predictions below or edit labels to improve training data.
        </Alert>
      );
    }

    return (
      <Grid container spacing={2} sx={{ mt: 1 }}>
        {Object.entries(entities).map(([category, value]) => {
          if (value === null || value === undefined || value === '') return null;
          
          // Handle different value types
          let displayValue;
          if (typeof value === 'object') {
            displayValue = JSON.stringify(value, null, 2);
          } else if (Array.isArray(value)) {
            displayValue = value.join(', ');
          } else {
            displayValue = String(value);
          }

          return (
            <Grid item xs={12} sm={6} md={4} key={category}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                    {category.replace(/_/g, ' ')}
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
                    {displayValue.length > 100 ? (
                      <Box component="pre" sx={{ fontSize: '0.85rem', overflow: 'auto', maxHeight: 150 }}>
                        {displayValue}
                      </Box>
                    ) : displayValue}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    );
  };

  const renderRawEntities = () => {
    if (!result || !result.raw_entities || result.raw_entities.length === 0) {
      return null;
    }

    // Paginate entities
    const startIndex = rawEntitiesPage * rawEntitiesRowsPerPage;
    const endIndex = startIndex + rawEntitiesRowsPerPage;
    const paginatedEntities = result.raw_entities.slice(startIndex, endIndex);

    return (
      <Accordion sx={{ mt: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">
            Raw Model Predictions ({result.raw_entities.length} entities)
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Entity</TableCell>
                  <TableCell>Label</TableCell>
                  <TableCell>Confidence</TableCell>
                  <TableCell>Position</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedEntities.map((entity, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Chip 
                        label={entity.word} 
                        size="small"
                        sx={{ 
                          bgcolor: getEntityColor(entity.entity),
                          color: 'white'
                        }}
                      />
                    </TableCell>
                    <TableCell>{entity.entity}</TableCell>
                    <TableCell>{(entity.score * 100).toFixed(1)}%</TableCell>
                    <TableCell>{entity.start}-{entity.end}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={result.raw_entities.length}
            rowsPerPage={rawEntitiesRowsPerPage}
            page={rawEntitiesPage}
            onPageChange={handleRawEntitiesPageChange}
            onRowsPerPageChange={handleRawEntitiesRowsPerPageChange}
          />
        </AccordionDetails>
      </Accordion>
    );
  };

  const renderLabelEditor = () => {
    if (!isEditingLabels || editableTokens.length === 0) {
      return null;
    }

    // Paginate tokens
    const startIndex = labelEditorPage * labelEditorRowsPerPage;
    const endIndex = startIndex + labelEditorRowsPerPage;
    const paginatedTokens = editableTokens.slice(startIndex, endIndex);

    return (
      <Paper sx={{ p: 3, mt: 3, border: 2, borderColor: 'primary.main' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Edit Labels for Training
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleCancelEdit}
              startIcon={<CloseIcon />}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleSaveToTrainingData}
              disabled={savingToTraining}
              startIcon={savingToTraining ? <CircularProgress size={16} /> : <SaveIcon />}
            >
              {savingToTraining ? 'Saving...' : 'Save to Training Data'}
            </Button>
          </Box>
        </Box>

        <Alert severity="info" sx={{ mb: 2 }}>
          Review and correct the predicted labels below. Use BIO tagging: O (Outside), B-TYPE (Begin), I-TYPE (Inside)
        </Alert>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Index</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Token</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Label</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedTokens.map((item) => (
                <TableRow key={item.index}>
                  <TableCell>{item.index + 1}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                      {item.token}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Autocomplete
                      size="small"
                      value={item.tag}
                      onChange={(event, newValue) => handleTagChange(item.index, newValue || 'O')}
                      options={availableTags.length > 0 ? availableTags : ['O']}
                      disableClearable
                      sx={{ minWidth: 150 }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Search tag..."
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              bgcolor: item.tag !== 'O' ? getEntityColor(item.tag) : 'transparent',
                              color: item.tag !== 'O' ? 'white' : 'inherit',
                              '& fieldset': {
                                borderColor: item.tag !== 'O' ? 'white' : undefined,
                              },
                              '&:hover fieldset': {
                                borderColor: item.tag !== 'O' ? 'white' : undefined,
                              },
                              '&.Mui-focused fieldset': {
                                borderColor: item.tag !== 'O' ? 'white' : 'primary.main',
                              },
                            },
                            '& .MuiInputBase-input': {
                              color: item.tag !== 'O' ? 'white !important' : 'inherit',
                            },
                            '& .MuiSvgIcon-root': {
                              color: item.tag !== 'O' ? 'white' : undefined,
                            },
                          }}
                        />
                      )}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 20, 50]}
          component="div"
          count={editableTokens.length}
          rowsPerPage={labelEditorRowsPerPage}
          page={labelEditorPage}
          onPageChange={handleLabelEditorPageChange}
          onRowsPerPageChange={handleLabelEditorRowsPerPageChange}
        />

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Typography variant="caption" color="text.secondary">
            {editableTokens.length} tokens • {editableTokens.filter(t => t.tag !== 'O').length} labeled entities
          </Typography>
        </Box>
      </Paper>
    );
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        NER Model Tester
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Test the active NER model by entering text or selecting from samples and previous transcripts
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Enter Text" icon={<PsychologyIcon />} iconPosition="start" />
          <Tab label="Sample Texts" icon={<LabelIcon />} iconPosition="start" />
          <Tab label="Previous Transcripts" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Tab 0: Enter Text */}
          {tabValue === 0 && (
            <Box>
              <TextField
                fullWidth
                multiline
                rows={6}
                variant="outlined"
                placeholder="Enter medical transcript text to analyze for entities..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Button
                variant="contained"
                size="large"
                onClick={() => handleExtract(inputText)}
                disabled={!inputText.trim() || extracting}
                startIcon={extracting ? <CircularProgress size={20} /> : <PlayArrowIcon />}
              >
                {extracting ? "Extracting..." : "Extract Entities"}
              </Button>
            </Box>
          )}

          {/* Tab 1: Sample Texts */}
          {tabValue === 1 && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Select a sample text to test the NER model
              </Typography>
              <Grid container spacing={2}>
                {SAMPLE_TEXTS.map((sample, idx) => (
                  <Grid item xs={12} md={4} key={idx}>
                    <Card 
                      variant="outlined"
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                        border: inputText === sample.text ? 2 : 1,
                        borderColor: inputText === sample.text ? 'primary.main' : 'divider'
                      }}
                      onClick={() => handleSelectSample(sample)}
                    >
                      <CardContent>
                        <Typography variant="subtitle2" gutterBottom>
                          {sample.title}
                        </Typography>
                        <Typography 
                          variant="body2" 
                          color="text.secondary"
                          sx={{ 
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical'
                          }}
                        >
                          {sample.text}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
              
              {inputText && (
                <Box sx={{ mt: 3 }}>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>Selected Text:</Typography>
                  <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="body2">{inputText}</Typography>
                  </Paper>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => handleExtract(inputText)}
                    disabled={extracting}
                    startIcon={extracting ? <CircularProgress size={20} /> : <PlayArrowIcon />}
                  >
                    {extracting ? "Extracting..." : "Extract Entities"}
                  </Button>
                </Box>
              )}
            </Box>
          )}

          {/* Tab 2: Previous Transcripts */}
          {tabValue === 2 && (
            <Box>
              {transcripts.length === 0 ? (
                <Alert severity="info">
                  No previous transcripts found. Use the STT Tester to transcribe audio first, or enter text manually.
                </Alert>
              ) : (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Select from recent transcripts ({transcripts.length} available)
                  </Typography>
                  <List>
                    {transcripts.map((transcript, idx) => (
                      <ListItem
                        key={idx}
                        divider
                        sx={{
                          cursor: 'pointer',
                          bgcolor: selectedTranscript === transcript.text ? 'action.selected' : 'transparent',
                          '&:hover': { bgcolor: 'action.hover' }
                        }}
                        onClick={() => handleSelectTranscript(transcript)}
                      >
                        <ListItemIcon>
                          <LabelIcon color={selectedTranscript === transcript.text ? "primary" : "inherit"} />
                        </ListItemIcon>
                        <ListItemText
                          primary={transcript.text.slice(0, 100) + (transcript.text.length > 100 ? '...' : '')}
                          secondary={new Date(transcript.timestamp).toLocaleString()}
                        />
                      </ListItem>
                    ))}
                  </List>
                  
                  {inputText && (
                    <Box sx={{ mt: 2 }}>
                      <Button
                        variant="contained"
                        size="large"
                        onClick={() => handleExtract(inputText)}
                        disabled={extracting}
                        startIcon={extracting ? <CircularProgress size={20} /> : <PlayArrowIcon />}
                      >
                        {extracting ? "Extracting..." : "Extract Entities"}
                      </Button>
                    </Box>
                  )}
                </>
              )}
            </Box>
          )}
        </Box>
      </Paper>

      {/* Results Section */}
      {(result || extracting) && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Extraction Results
          </Typography>
          
          {modelInfo && (
            <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip label={`Model: ${modelInfo.name}`} size="small" color="primary" />
              <Chip label={`Type: ${modelInfo.type}`} size="small" />
              <Chip label={`Device: ${modelInfo.device}`} size="small" />
            </Box>
          )}
          
          <Divider sx={{ my: 2 }} />
          
          {extracting ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 4 }}>
              <CircularProgress size={24} />
              <Typography color="text.secondary">
                Analyzing text with active NER model...
              </Typography>
            </Box>
          ) : result ? (
            <>
              {/* Highlighted Text */}
              <Typography variant="subtitle2" gutterBottom>
                Highlighted Entities
              </Typography>
              {renderEntityHighlight()}
              
              {/* Extracted Structured Data */}
              <Typography variant="subtitle2" sx={{ mt: 3 }} gutterBottom>
                Extracted Information
              </Typography>
              {renderExtractedEntities()}
              
              {/* Raw Predictions */}
              {renderRawEntities()}
              
              {/* Edit Labels Button */}
              {!isEditingLabels && (
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                  <Button
                    variant="contained"
                    color="secondary"
                    size="large"
                    onClick={handleStartEditLabels}
                    startIcon={<EditIcon />}
                  >
                    Edit Labels & Save to Training Data
                  </Button>
                </Box>
              )}
            </>
          ) : null}
        </Paper>
      )}

      {/* Label Editor */}
      {renderLabelEditor()}

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Entity Types Legend */}
      <Paper sx={{ p: 2, mt: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle2">
            Entity Types ({entityTypes.length})
          </Typography>
          <Button
            size="small"
            variant="text"
            onClick={() => window.location.href = '/apps/ner-entity-types'}
          >
            Manage Entity Types
          </Button>
        </Box>
        
        {entityTypesLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {entityTypes.map((entityType) => (
              <Chip
                key={entityType.name}
                label={entityType.name}
                size="small"
                sx={{ bgcolor: entityType.color, color: 'white' }}
              />
            ))}
            {entityTypes.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No entity types defined.
              </Typography>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
}

export default NERTester;
