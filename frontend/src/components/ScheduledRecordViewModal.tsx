import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from '@mui/material';
import { type ScheduledRecord } from '../services/scheduledService';

interface ScheduledRecordViewModalProps {
  open: boolean;
  record: ScheduledRecord | null;
  onClose: () => void;
}

export default function ScheduledRecordViewModal({
  open,
  record,
  onClose,
}: ScheduledRecordViewModalProps) {
  if (!record) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>View Scheduled Record</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant="caption" color="textSecondary">
                ID
              </Typography>
              <Typography>{record.ScheduledID}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="textSecondary">
                Type
              </Typography>
              <Typography>{record.Type}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="textSecondary">
                Purchase Date
              </Typography>
              <Typography>{new Date(record.PurchaseDate).toLocaleDateString()}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="textSecondary">
                Supplier
              </Typography>
              <Typography>{record.Supplier}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="textSecondary">
                Description
              </Typography>
              <Typography>{record.Description}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="textSecondary">
                Purchase Currency
              </Typography>
              <Typography>{record.PurchaseCurrency}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="textSecondary">
                Original Currency Value
              </Typography>
              <Typography>{record.OriginalCurrencyValue.toFixed(2)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="textSecondary">
                USD Value
              </Typography>
              <Typography>${record.USDValue.toFixed(2)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="textSecondary">
                Useful Months
              </Typography>
              <Typography>{record.UsefulMonths}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="textSecondary">
                Status
              </Typography>
              <Typography>{record.Disposed ? 'Disposed/Expensed' : 'Active'}</Typography>
            </Box>
            {record.Disposed && record.DisposalDate && (
              <Box>
                <Typography variant="caption" color="textSecondary">
                  {record.Type === 'Fixed Asset' ? 'Disposal Date' : 'Expensed Date'}
                </Typography>
                <Typography>{new Date(record.DisposalDate).toLocaleDateString()}</Typography>
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
