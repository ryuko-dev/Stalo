import { Dialog, DialogTitle, DialogContent, DialogActions, Button, RadioGroup, FormControlLabel, Radio, TextField, Box, Typography, Alert, CircularProgress } from '@mui/material';
import { useState } from 'react';

interface SaveBudgetDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (saveAsNew: boolean, versionName?: string, description?: string) => void;
  currentVersionName?: string;
  changeCount?: number;
  mode: 'upload' | 'edit';
  isSaving?: boolean;
}

export default function SaveBudgetDialog({ 
  open, 
  onClose, 
  onSave, 
  currentVersionName, 
  changeCount = 0,
  mode,
  isSaving = false
}: SaveBudgetDialogProps) {
  const [saveMode, setSaveMode] = useState<'update' | 'new'>('update');
  const [versionName, setVersionName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (saveMode === 'new' && !versionName.trim()) {
      setError('Version name is required');
      return;
    }
    
    setError('');
    onSave(saveMode === 'new', versionName.trim(), description.trim());
    
    // Reset form
    setVersionName('');
    setDescription('');
    setSaveMode('update');
  };

  const handleClose = () => {
    setError('');
    setVersionName('');
    setDescription('');
    setSaveMode('update');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {mode === 'upload' ? 'Save Budget Data' : 'Save Budget Changes'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          {mode === 'upload' ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              You have uploaded new budget data. How would you like to save it?
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              You have modified {changeCount} {changeCount === 1 ? 'cell' : 'cells'}.
            </Typography>
          )}

          <RadioGroup
            value={saveMode}
            onChange={(e) => setSaveMode(e.target.value as 'update' | 'new')}
          >
            {currentVersionName && (
              <>
                <FormControlLabel
                  value="update"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight="bold">
                        Update Existing Version
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Version: {currentVersionName}
                      </Typography>
                    </Box>
                  }
                />
                {mode === 'upload' && (
                  <Alert severity="warning" sx={{ ml: 4, mr: 2, mb: 2 }}>
                    This will overwrite existing data
                  </Alert>
                )}
              </>
            )}

            <FormControlLabel
              value="new"
              control={<Radio />}
              label={
                <Typography variant="body2" fontWeight="bold">
                  Save as New Version
                </Typography>
              }
            />
          </RadioGroup>

          {saveMode === 'new' && (
            <Box sx={{ ml: 4, mr: 2, mt: 2 }}>
              <TextField
                label="Version Name"
                fullWidth
                size="small"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                error={!!error}
                helperText={error}
                sx={{ mb: 2 }}
                placeholder="e.g., 2025 Q1 Budget"
                required
              />
              <TextField
                label="Description (Optional)"
                fullWidth
                size="small"
                multiline
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add notes about this version..."
              />
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isSaving}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          disabled={isSaving || (saveMode === 'new' && !versionName.trim())}
          startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : undefined}
        >
          {isSaving ? 'Saving...' : (saveMode === 'update' ? 'Update Version' : 'Create Version')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
