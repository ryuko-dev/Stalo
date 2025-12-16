import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { type ScheduledRecord, type CreateScheduledRecord } from '../services/scheduledService';

interface ScheduledRecordModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (record: CreateScheduledRecord | ScheduledRecord) => Promise<void>;
  record?: ScheduledRecord | null;
  isEdit: boolean;
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'AED', 'LBP', 'JOD', 'YER'];
const COMMON_TYPES = [
  'Prepaid Expense',
  'Prepaid Rent',
  'Other Insurance',
  'Life Insurance',
  'Medical Insurance',
  'Fixed Asset'
];

export default function ScheduledRecordModal({
  open,
  onClose,
  onSave,
  record,
  isEdit
}: ScheduledRecordModalProps) {
  const [formData, setFormData] = useState<CreateScheduledRecord>({
    Type: '',
    PurchaseDate: new Date().toISOString().split('T')[0],
    Supplier: '',
    Description: '',
    PurchaseCurrency: 'USD',
    OriginalCurrencyValue: 0,
    USDValue: 0,
    UsefulMonths: 12,
    Disposed: false,
    DisposalDate: null
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEdit && record) {
      setFormData({
        Type: record.Type,
        PurchaseDate: record.PurchaseDate,
        Supplier: record.Supplier || '',
        Description: record.Description || '',
        PurchaseCurrency: record.PurchaseCurrency,
        OriginalCurrencyValue: record.OriginalCurrencyValue,
        USDValue: record.USDValue,
        UsefulMonths: record.UsefulMonths,
        Disposed: record.Disposed,
        DisposalDate: record.DisposalDate
      });
    } else {
      setFormData({
        Type: '',
        PurchaseDate: new Date().toISOString().split('T')[0],
        Supplier: '',
        Description: '',
        PurchaseCurrency: 'USD',
        OriginalCurrencyValue: 0,
        USDValue: 0,
        UsefulMonths: 12,
        Disposed: false,
        DisposalDate: null
      });
    }
    setErrors({});
  }, [record, isEdit, open]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.Type.trim()) {
      newErrors.Type = 'Type is required';
    }
    if (!formData.PurchaseDate) {
      newErrors.PurchaseDate = 'Purchase date is required';
    }
    if (formData.OriginalCurrencyValue <= 0) {
      newErrors.OriginalCurrencyValue = 'Original value must be greater than 0';
    }
    if (formData.USDValue <= 0) {
      newErrors.USDValue = 'USD value must be greater than 0';
    }
    if (formData.UsefulMonths <= 0) {
      newErrors.UsefulMonths = 'Useful months must be greater than 0';
    }
    // Only validate disposal date for Fixed Asset types
    if (formData.Type === 'Fixed Asset' && formData.Disposed && !formData.DisposalDate) {
      newErrors.DisposalDate = 'Disposal date is required when disposed';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // If editing, include the ScheduledID in the payload
      if (isEdit && record) {
        await onSave({
          ...formData,
          ScheduledID: record.ScheduledID
        });
      } else {
        await onSave(formData);
      }
      onClose();
    } catch (error) {
      console.error('Error saving record:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof CreateScheduledRecord, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {isEdit ? 'Edit Scheduled Record' : 'Add Scheduled Record'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
              <Box sx={{ flex: '1 1 300px' }}>
                <FormControl fullWidth error={!!errors.Type}>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={formData.Type}
                    label="Type"
                    onChange={(e) => handleInputChange('Type', e.target.value)}
                  >
                    {COMMON_TYPES.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.Type && (
                    <Box sx={{ color: 'error.main', fontSize: '0.75rem', mt: 0.5 }}>
                      {errors.Type}
                    </Box>
                  )}
                </FormControl>
              </Box>

              <Box sx={{ flex: '1 1 300px' }}>
                <DatePicker
                  label="Purchase Date"
                  value={formData.PurchaseDate ? new Date(formData.PurchaseDate) : null}
                  onChange={(date) => 
                    handleInputChange('PurchaseDate', date ? date.toISOString().split('T')[0] : '')
                  }
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      error: !!errors.PurchaseDate,
                      helperText: errors.PurchaseDate
                    }
                  }}
                />
              </Box>

              <Box sx={{ flex: '1 1 300px' }}>
                <TextField
                  fullWidth
                  label="Supplier"
                  value={formData.Supplier}
                  onChange={(e) => handleInputChange('Supplier', e.target.value)}
                />
              </Box>

              <Box sx={{ flex: '1 1 300px' }}>
                <TextField
                  fullWidth
                  label="Description"
                  value={formData.Description}
                  onChange={(e) => handleInputChange('Description', e.target.value)}
                  multiline
                  rows={2}
                />
              </Box>

              <Box sx={{ flex: '1 1 200px' }}>
                <FormControl fullWidth>
                  <InputLabel>Purchase Currency</InputLabel>
                  <Select
                    value={formData.PurchaseCurrency}
                    label="Purchase Currency"
                    onChange={(e) => handleInputChange('PurchaseCurrency', e.target.value)}
                  >
                    {CURRENCIES.map((currency) => (
                      <MenuItem key={currency} value={currency}>
                        {currency}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ flex: '1 1 200px' }}>
                <TextField
                  fullWidth
                  label="Original Value"
                  type="number"
                  value={formData.OriginalCurrencyValue}
                  onChange={(e) => handleInputChange('OriginalCurrencyValue', parseFloat(e.target.value) || 0)}
                  error={!!errors.OriginalCurrencyValue}
                  helperText={errors.OriginalCurrencyValue}
                  inputProps={{ step: '0.01', min: '0' }}
                />
              </Box>

              <Box sx={{ flex: '1 1 200px' }}>
                <TextField
                  fullWidth
                  label="USD Value"
                  type="number"
                  value={formData.USDValue}
                  onChange={(e) => handleInputChange('USDValue', parseFloat(e.target.value) || 0)}
                  error={!!errors.USDValue}
                  helperText={errors.USDValue}
                  inputProps={{ step: '0.01', min: '0' }}
                />
              </Box>

              <Box sx={{ flex: '1 1 300px' }}>
                <TextField
                  fullWidth
                  label="Useful Months"
                  type="number"
                  value={formData.UsefulMonths}
                  onChange={(e) => handleInputChange('UsefulMonths', parseInt(e.target.value) || 0)}
                  error={!!errors.UsefulMonths}
                  helperText={errors.UsefulMonths}
                  inputProps={{ min: '1' }}
                />
              </Box>

              <Box sx={{ flex: '1 1 300px' }}>
                <DatePicker
                  label="Disposal Date"
                  value={formData.DisposalDate ? new Date(formData.DisposalDate) : null}
                  onChange={(date) => 
                    handleInputChange('DisposalDate', date ? date.toISOString().split('T')[0] : null)
                  }
                  disabled={!formData.Disposed || formData.Type !== 'Fixed Asset'}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      error: !!errors.DisposalDate,
                      helperText: errors.DisposalDate
                    }
                  }}
                />
              </Box>

              <Box sx={{ flex: '1 1 100%' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.Disposed}
                      onChange={(e) => {
                        handleInputChange('Disposed', e.target.checked);
                        if (e.target.checked && formData.Type !== 'Fixed Asset') {
                          // Auto-calculate disposal date for non-Fixed Asset types
                          const purchaseDate = new Date(formData.PurchaseDate);
                          purchaseDate.setMonth(purchaseDate.getMonth() + formData.UsefulMonths);
                          // Set to last day of the month
                          purchaseDate.setDate(0);
                          handleInputChange('DisposalDate', purchaseDate.toISOString().split('T')[0]);
                        } else if (!e.target.checked) {
                          // Clear disposal date if unchecking disposed
                          handleInputChange('DisposalDate', null);
                        }
                      }}
                      color="primary"
                    />
                  }
                  label={formData.Type === 'Fixed Asset' ? 'Disposed' : 'Expensed'}
                />
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? 'Saving...' : (isEdit ? 'Update' : 'Create')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </LocalizationProvider>
  );
}
