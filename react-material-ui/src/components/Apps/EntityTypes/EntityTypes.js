import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Grid,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import LabelIcon from "@mui/icons-material/Label";
import InfoIcon from "@mui/icons-material/Info";
import NERApiService from "../../../services/nerApi";

const EntityTypes = () => {
  const theme = useTheme();
  
  // State
  const [entityTypes, setEntityTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newEntityName, setNewEntityName] = useState("");
  const [entityToDelete, setEntityToDelete] = useState(null);
  const [addingEntity, setAddingEntity] = useState(false);
  const [deletingEntity, setDeletingEntity] = useState(false);

  // Fetch entity types on mount
  useEffect(() => {
    fetchEntityTypes();
  }, []);

  const fetchEntityTypes = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await NERApiService.getEntityTypes();
      setEntityTypes(data.entity_types || []);
    } catch (err) {
      setError("Failed to load entity types: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntityType = async () => {
    if (!newEntityName.trim()) return;
    
    try {
      setAddingEntity(true);
      setError("");
      const result = await NERApiService.addEntityType(newEntityName.trim());
      setSuccess(`Entity type "${newEntityName}" added successfully`);
      setNewEntityName("");
      setAddDialogOpen(false);
      fetchEntityTypes();
    } catch (err) {
      setError("Failed to add entity type: " + err.message);
    } finally {
      setAddingEntity(false);
    }
  };

  const handleDeleteEntityType = async () => {
    if (!entityToDelete) return;
    
    try {
      setDeletingEntity(true);
      setError("");
      await NERApiService.deleteEntityType(entityToDelete.name);
      setSuccess(`Entity type "${entityToDelete.name}" deleted successfully`);
      setDeleteDialogOpen(false);
      setEntityToDelete(null);
      fetchEntityTypes();
    } catch (err) {
      setError("Failed to delete entity type: " + err.message);
    } finally {
      setDeletingEntity(false);
    }
  };

  const openDeleteDialog = (entityType) => {
    setEntityToDelete(entityType);
    setDeleteDialogOpen(true);
  };

  // Clear messages after timeout
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Entity Types
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage entity types used for NER model training. Each entity type generates B- (Begin) and I- (Inside) tags.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchEntityTypes} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
          >
            Add Entity Type
          </Button>
        </Box>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      {/* Info Card */}
      <Card sx={{ mb: 3, bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50' }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
            <InfoIcon color="info" />
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                How Entity Types Work
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Entity types define what information the NER model extracts from text. Each type automatically creates
                BIO tags for training:
              </Typography>
              <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
                <Chip size="small" label="O" variant="outlined" />
                <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
                  Outside (no entity)
                </Typography>
                <Chip size="small" label="B-TYPE" color="primary" variant="outlined" />
                <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
                  Begin entity
                </Typography>
                <Chip size="small" label="I-TYPE" color="secondary" variant="outlined" />
                <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
                  Inside/Continue entity
                </Typography>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Statistics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, textAlign: "center" }}>
            <Typography variant="h3" color="primary">
              {entityTypes.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Entity Types
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, textAlign: "center" }}>
            <Typography variant="h3" color="secondary">
              {entityTypes.length * 2}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              BIO Tags (B- and I-)
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, textAlign: "center" }}>
            <Typography variant="h3" color="success.main">
              {entityTypes.length * 2 + 1}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Labels (incl. O)
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Entity Types Table */}
      <Paper sx={{ p: 0, overflow: "hidden" }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: "bold" }}>Entity Type</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Color</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Generated Tags</TableCell>
                <TableCell sx={{ fontWeight: "bold" }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : entityTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    <LabelIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
                    <Typography color="text.secondary">
                      No entity types defined. Add some to start training.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                entityTypes.map((entityType) => (
                  <TableRow key={entityType.name} hover>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <LabelIcon sx={{ color: entityType.color }} />
                        <Typography fontWeight="medium">{entityType.name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: 1,
                            bgcolor: entityType.color,
                          }}
                        />
                        <Typography variant="body2" color="text.secondary">
                          {entityType.color}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 1 }}>
                        <Chip
                          size="small"
                          label={`B-${entityType.name}`}
                          sx={{ bgcolor: entityType.color, color: "white" }}
                        />
                        <Chip
                          size="small"
                          label={`I-${entityType.name}`}
                          sx={{ bgcolor: entityType.color, color: "white", opacity: 0.8 }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Delete entity type">
                        <IconButton
                          color="error"
                          onClick={() => openDeleteDialog(entityType)}
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Visual Legend */}
      {entityTypes.length > 0 && (
        <Paper sx={{ p: 2, mt: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Quick Reference
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            <Chip label="O" size="small" variant="outlined" />
            {entityTypes.map((entityType) => (
              <Chip
                key={entityType.name}
                label={entityType.name}
                size="small"
                sx={{ bgcolor: entityType.color, color: "white" }}
              />
            ))}
          </Box>
        </Paper>
      )}

      {/* Add Entity Type Dialog */}
      <Dialog 
        open={addDialogOpen} 
        onClose={() => setAddDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>Add New Entity Type</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter a name for the new entity type. This will automatically create B- and I- tags
            for training data annotation.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Entity Type Name"
            variant="outlined"
            value={newEntityName}
            onChange={(e) => setNewEntityName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
            placeholder="e.g., MEDICATION, PROCEDURE, DIAGNOSIS"
            helperText="Use uppercase letters, numbers, and underscores only"
            sx={{ mt: 1 }}
          />
          {newEntityName && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Preview tags that will be created:
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Chip size="small" label={`B-${newEntityName}`} color="primary" />
                <Chip size="small" label={`I-${newEntityName}`} color="secondary" />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAddEntityType}
            variant="contained"
            disabled={!newEntityName.trim() || addingEntity}
          >
            {addingEntity ? "Adding..." : "Add Entity Type"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Entity Type</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the entity type{" "}
            <strong>{entityToDelete?.name}</strong>?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            This will remove both <strong>B-{entityToDelete?.name}</strong> and{" "}
            <strong>I-{entityToDelete?.name}</strong> tags from the label map.
            If this entity type is used in existing training data, you may need to
            update those entries before retraining.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteEntityType}
            color="error"
            variant="contained"
            disabled={deletingEntity}
          >
            {deletingEntity ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EntityTypes;
