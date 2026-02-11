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
  Pagination,
  Tooltip,
  Grid,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import NERApiService from '../../services/nerApi';

const NERDataManagement = () => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage] = useState(10);

  const [formData, setFormData] = useState({
    tokens: '',
    tags: '',
  });

  const [stats, setStats] = useState({
    totalEntries: 0,
    uniqueLabels: 0,
    avgTokens: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = data.filter((entry) =>
        entry.tokens.join(' ').toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredData(filtered);
    } else {
      setFilteredData(data);
    }
    setPage(1);
  }, [searchTerm, data]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await NERApiService.getTrainingData();
      setData(response.data || []);
      setFilteredData(response.data || []);
      setStats(response.stats || {
        totalEntries: 0,
        uniqueLabels: 0,
        avgTokens: 0
      });
    } catch (err) {
      setError('Failed to load training data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (entry = null) => {
    if (entry) {
      setEditMode(true);
      setSelectedEntry(entry);
      setFormData({
        tokens: entry.tokens.join(' '),
        tags: entry.tags.join(' '),
      });
    } else {
      setEditMode(false);
      setSelectedEntry(null);
      setFormData({ tokens: '', tags: '' });
    }
    setOpenDialog(true);
    setError('');
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setFormData({ tokens: '', tags: '' });
    setSelectedEntry(null);
    setError('');
  };

  const handleSave = async () => {
    const tokensArray = formData.tokens.trim().split(/\s+/);
    const tagsArray = formData.tags.trim().split(/\s+/);

    if (tokensArray.length !== tagsArray.length) {
      setError('Number of tokens must match number of tags');
      return;
    }

    if (tokensArray.length === 0) {
      setError('Tokens and tags cannot be empty');
      return;
    }

    setLoading(true);
    try {
      if (editMode && selectedEntry) {
        await NERApiService.updateTrainingEntry(selectedEntry.id, tokensArray, tagsArray);
        setSuccess('Entry updated successfully');
      } else {
        await NERApiService.addTrainingEntry(tokensArray, tagsArray);
        setSuccess('Entry added successfully');
      }

      handleCloseDialog();
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to save entry: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (entry) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      setLoading(true);
      try {
        await NERApiService.deleteTrainingEntry(entry.id);
        setSuccess('Entry deleted successfully');
        await loadData();
        setTimeout(() => setSuccess(''), 3000);
      } catch (err) {
        setError('Failed to delete entry: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleExport = () => {
    // Export data to JSONL format
    const jsonlContent = data
      .map((entry) => JSON.stringify({ tokens: entry.tokens, tags: entry.tags }))
      .join('\n');

    const blob = new Blob([jsonlContent], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'train.jsonl';
    link.click();
    URL.revokeObjectURL(url);
  };

  const paginatedData = filteredData.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  const getLabelColor = (tag) => {
    if (tag === 'O') return 'default';
    if (tag.startsWith('B-')) return 'primary';
    if (tag.startsWith('I-')) return 'secondary';
    return 'default';
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Training Data Management</Typography>
        <Box>
          <Button
            startIcon={<RefreshIcon />}
            onClick={loadData}
            sx={{ mr: 1 }}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            sx={{ mr: 1 }}
            disabled={data.length === 0}
          >
            Export
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            disabled={loading}
          >
            Add Entry
          </Button>
        </Box>
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

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" variant="body2">
                Total Entries
              </Typography>
              <Typography variant="h4">{stats.totalEntries}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" variant="body2">
                Unique Labels
              </Typography>
              <Typography variant="h4">{stats.uniqueLabels}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" variant="body2">
                Avg Tokens per Entry
              </Typography>
              <Typography variant="h4">{stats.avgTokens}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            placeholder="Search tokens..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
          />
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          {loading && data.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : filteredData.length === 0 ? (
            <Box sx={{ textAlign: 'center', p: 3 }}>
              <Typography variant="body1" color="textSecondary">
                {searchTerm ? 'No entries match your search.' : 'No training data found.'}
              </Typography>
            </Box>
          ) : (
            <>
              <TableContainer component={Paper} elevation={0}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell width="50">#</TableCell>
                      <TableCell>Tokens</TableCell>
                      <TableCell>Tags</TableCell>
                      <TableCell width="120" align="right">
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedData.map((entry, index) => (
                      <TableRow key={entry.id} hover>
                        <TableCell>{(page - 1) * rowsPerPage + index + 1}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {entry.tokens.map((token, idx) => (
                              <Chip
                                key={idx}
                                label={token}
                                size="small"
                                variant="outlined"
                              />
                            ))}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {entry.tags.map((tag, idx) => (
                              <Chip
                                key={idx}
                                label={tag}
                                size="small"
                                color={getLabelColor(tag)}
                              />
                            ))}
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenDialog(entry)}
                              color="primary"
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              onClick={() => handleDelete(entry)}
                              color="error"
                              disabled={loading}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(e, value) => setPage(value)}
                  color="primary"
                />
              </Box>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editMode ? 'Edit Entry' : 'Add New Entry'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Tokens (space-separated)"
              multiline
              rows={3}
              fullWidth
              value={formData.tokens}
              onChange={(e) => setFormData({ ...formData, tokens: e.target.value })}
              helperText="Example: date twenty one eleven two thousand twenty six"
              placeholder="Enter tokens separated by spaces"
            />

            <TextField
              label="Tags (space-separated, BIO format)"
              multiline
              rows={3}
              fullWidth
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              helperText="Example: O B-DATE I-DATE I-DATE I-DATE I-DATE I-DATE I-DATE"
              placeholder="Enter tags separated by spaces (must match tokens count)"
            />

            <Alert severity="info">
              Ensure the number of tokens matches the number of tags. Use BIO tagging format:
              <ul style={{ marginBottom: 0 }}>
                <li>O - Outside any entity</li>
                <li>B-LABEL - Beginning of entity</li>
                <li>I-LABEL - Inside (continuation) of entity</li>
              </ul>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : editMode ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default NERDataManagement;
