import { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Button
} from '@mui/material';
import { 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Add as AddIcon
} from '@mui/icons-material';
import scheduledService, { type ScheduledRecord, type CreateScheduledRecord, type UpdateScheduledRecord } from '../services/scheduledService';
import ScheduledRecordModal from '../components/ScheduledRecordModal';
import DeleteConfirmDialog from '../components/DeleteConfirmDialog';
import ScheduledRecordViewModal from '../components/ScheduledRecordViewModal';

export default function ScheduledRecords() {
  const [records, setRecords] = useState<ScheduledRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // Filter state
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all'); // all, active, disposed
  
  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ScheduledRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    // Load saved date from localStorage
    const savedDate = localStorage.getItem('selectedDate');
    if (savedDate) {
      try {
        setSelectedDate(new Date(JSON.parse(savedDate)));
      } catch {
        setSelectedDate(new Date());
      }
    }
    loadScheduledRecords();
  }, []);

  // Listen for month changes from the AppBar
  useEffect(() => {
    let lastSelectedDate = JSON.stringify(selectedDate);

    const checkForDateChange = () => {
      const savedDate = localStorage.getItem('selectedDate');
      if (savedDate && savedDate !== lastSelectedDate) {
        try {
          setSelectedDate(new Date(JSON.parse(savedDate)));
          lastSelectedDate = savedDate;
        } catch {
          setSelectedDate(new Date());
        }
      }
    };

    // Check for changes every 500ms
    const interval = setInterval(checkForDateChange, 500);

    // Also listen to storage events for cross-tab changes
    const handleStorageChange = () => {
      const savedDate = localStorage.getItem('selectedDate');
      if (savedDate) {
        try {
          setSelectedDate(new Date(JSON.parse(savedDate)));
          lastSelectedDate = savedDate;
        } catch {
          setSelectedDate(new Date());
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const loadScheduledRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await scheduledService.getAllScheduledRecords();
      setRecords(data);
    } catch (err) {
      setError('Failed to load scheduled records');
      console.error('Error loading scheduled records:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency === 'USD' ? 'USD' : 'EUR',
    }).format(amount);
  };

  // Type filter options
  const TYPE_OPTIONS = [
    { value: 'all', label: 'All Types' },
    { value: 'Prepaid Expense', label: 'Prepaid Expense' },
    { value: 'Prepaid Rent', label: 'Prepaid Rent' },
    { value: 'Other Insurance', label: 'Other Insurance' },
    { value: 'Life Insurance', label: 'Life Insurance' },
    { value: 'Medical Insurance', label: 'Medical Insurance' },
    { value: 'Fixed Asset', label: 'Fixed Asset' }
  ];

  // Filter records by type and status
  const filteredRecords = records
    .filter(record => selectedType === 'all' || record.Type === selectedType)
    .filter(record => {
      if (selectedStatus === 'all') return true;
      if (selectedStatus === 'disposed') return record.Disposed;
      if (selectedStatus === 'active') return !record.Disposed;
      return true;
    });

  // CRUD operations
  const handleCreate = async (record: CreateScheduledRecord) => {
    try {
      setActionLoading(true);
      await scheduledService.createScheduledRecord(record);
      await loadScheduledRecords();
    } catch (err) {
      console.error('Error creating record:', err);
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async (record: CreateScheduledRecord | ScheduledRecord) => {
    try {
      setActionLoading(true);
      if ('ScheduledID' in record) {
        // Ensure all required fields are included for update
        const updatePayload: UpdateScheduledRecord = {
          ...record,
          Disposed: record.Disposed || false,
          DisposalDate: record.DisposalDate || undefined
        };
        await scheduledService.updateScheduledRecord(record.ScheduledID, updatePayload);
      }
      await loadScheduledRecords();
    } catch (err) {
      console.error('Error updating record:', err);
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRecord) return;
    
    try {
      setActionLoading(true);
      await scheduledService.deleteScheduledRecord(selectedRecord.ScheduledID);
      await loadScheduledRecords();
      setDeleteDialogOpen(false);
      setSelectedRecord(null);
    } catch (err) {
      console.error('Error deleting record:', err);
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const openEditModal = (record: ScheduledRecord) => {
    setSelectedRecord(record);
    setEditModalOpen(true);
  };

  const openViewModal = (record: ScheduledRecord) => {
    setSelectedRecord(record);
    setViewModalOpen(true);
  };

  const openDeleteDialog = (record: ScheduledRecord) => {
    setSelectedRecord(record);
    setDeleteDialogOpen(true);
  };

  // Helper functions for new calculated columns
  const getDailyDepreciationCost = (usdValue: number, usefulMonths: number): number => {
    if (usefulMonths <= 0) return 0;
    const totalDays = usefulMonths * 30;
    return usdValue / totalDays;
  };

  const calculateMonthlyDepreciation = (record: ScheduledRecord, monthOffset: number): number => {
    const purchaseDate = new Date(record.PurchaseDate);
    const purchaseDay = purchaseDate.getDate();
    const purchaseMonth = purchaseDate.getMonth();
    const purchaseYear = purchaseDate.getFullYear();
    
    const targetDate = new Date(selectedDate);
    targetDate.setMonth(targetDate.getMonth() + monthOffset);
    const targetMonth = targetDate.getMonth();
    const targetYear = targetDate.getFullYear();
    
    // Monthly allocation = total value / useful months
    const monthlyAllocation = record.USDValue / record.UsefulMonths;
    
    // Total days available = useful months * 30
    const totalDays = record.UsefulMonths * 30;
    
    // Calculate which month number this is (0 = purchase month, 1 = next month, etc.)
    const monthsFromPurchase = (targetYear - purchaseYear) * 12 + (targetMonth - purchaseMonth);
    
    // If this is before purchase month, return 0
    if (monthsFromPurchase < 0) return 0;
    
    // Check disposal date for Fixed Assets only
    if (record.Type === 'Fixed Asset' && record.Disposed && record.DisposalDate) {
      const disposalDate = new Date(record.DisposalDate);
      if (targetDate >= disposalDate) return 0;
    }
    
    let daysInMonth = 0;
    
    if (monthsFromPurchase === 0) {
      // Purchase month: days from purchase day to end of month (30 days)
      daysInMonth = 30 - purchaseDay + 1;
    } else {
      // Other months: 30 days each by default
      daysInMonth = 30;
    }
    
    // Calculate total days consumed up to the end of previous months
    let daysConsumedBefore = 0;
    if (monthsFromPurchase > 0) {
      daysConsumedBefore = (30 - purchaseDay + 1) + (monthsFromPurchase - 1) * 30;
    }
    
    // Calculate total days consumed through this month
    let daysConsumedThrough = daysConsumedBefore + daysInMonth;
    
    // If this month is entirely after the useful life, return 0
    if (daysConsumedBefore >= totalDays) return 0;
    
    // Cap the days to not exceed total useful life days
    if (daysConsumedThrough > totalDays) {
      daysInMonth = totalDays - daysConsumedBefore;
    }
    
    if (daysInMonth <= 0) return 0;
    
    // Daily allocation = monthly allocation / 30
    const dailyAllocation = monthlyAllocation / 30;
    const monthDepreciation = dailyAllocation * daysInMonth;
    
    // Cap at monthly allocation - amount for a month cannot exceed monthly cost
    return Math.min(monthDepreciation, monthlyAllocation);
  };

  const getMonthLabel = (date: Date, offset: number): string => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + offset);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = months[d.getMonth()];
    const year = d.getFullYear();
    return `${monthName} ${year}`;
  };

  const getMonthValue = (record: ScheduledRecord, monthOffset: number): number => {
    return calculateMonthlyDepreciation(record, monthOffset);
  };

  const getBalance = (record: ScheduledRecord): number => {
    const targetDate = new Date(selectedDate);
    const purchaseDate = new Date(record.PurchaseDate);
    const purchaseDay = purchaseDate.getDate();
    const purchaseMonth = purchaseDate.getMonth();
    const purchaseYear = purchaseDate.getFullYear();
    
    const targetMonth = targetDate.getMonth();
    const targetYear = targetDate.getFullYear();
    
    // For Fixed Assets only: if disposed, balance is 0
    if (record.Type === 'Fixed Asset' && record.Disposed) return 0;
    
    // If target date is before purchase, return full value
    if (targetYear < purchaseYear || (targetYear === purchaseYear && targetMonth < purchaseMonth)) {
      return record.USDValue;
    }
    
    // Calculate months from purchase to target (end of selected month)
    const monthsElapsed = (targetYear - purchaseYear) * 12 + (targetMonth - purchaseMonth);
    
    // Calculate total days depreciated
    let totalDepreciatedDays = 0;
    const monthlyAllocation = record.USDValue / record.UsefulMonths;
    const totalDays = record.UsefulMonths * 30;
    
    for (let m = 0; m <= monthsElapsed && totalDepreciatedDays < totalDays; m++) {
      let daysThisMonth = 0;
      
      if (m === 0) {
        // First month: remaining days from purchase date
        daysThisMonth = 30 - purchaseDay + 1;
      } else {
        // All other months: 30 days (until we reach total days)
        daysThisMonth = Math.min(30, totalDays - totalDepreciatedDays);
      }
      
      totalDepreciatedDays += daysThisMonth;
    }
    
    // Cap at total days
    totalDepreciatedDays = Math.min(totalDepreciatedDays, totalDays);
    
    const dailyAllocation = monthlyAllocation / 30;
    const totalDepreciated = dailyAllocation * totalDepreciatedDays;
    
    return Math.max(0, record.USDValue - totalDepreciated);
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>Scheduled Records</Typography>
        <Typography color="text.secondary">Loading...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>Scheduled Records</Typography>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Scheduled Records</Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={() => setAddModalOpen(true)}
        >
          Add Record
        </Button>
      </Box>
      
      {/* Filters */}
      <Box sx={{ mb: 2, p: 1.5, backgroundColor: '#f5f5f5', borderRadius: 1, border: '1px solid #e0e0e0' }}>
        {/* Status Filter */}
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#666', display: 'block', mb: 0.75 }}>
            STATUS
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {['all', 'active', 'disposed'].map((status) => (
              <Button
                key={status}
                size="small"
                variant={selectedStatus === status ? 'contained' : 'outlined'}
                onClick={() => setSelectedStatus(status)}
                sx={{
                  textTransform: 'capitalize',
                  fontSize: '0.8rem',
                  px: 1.5,
                  py: 0.5,
                  borderColor: selectedStatus === status ? 'primary.main' : '#d0d0d0',
                  color: selectedStatus === status ? 'primary.contrastText' : 'text.primary',
                  backgroundColor: selectedStatus === status ? 'primary.main' : 'white',
                  '&:hover': {
                    backgroundColor: selectedStatus === status ? 'primary.dark' : '#f0f0f0',
                    borderColor: 'primary.main',
                  }
                }}
              >
                {status === 'all' ? 'All' : status === 'active' ? 'Active' : 'Expensed/Disposed'}
              </Button>
            ))}
          </Box>
        </Box>

        {/* Type Filter */}
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#666', display: 'block', mb: 0.75 }}>
            TYPE
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {TYPE_OPTIONS.map((type) => (
              <Button
                key={type.value}
                size="small"
                variant={selectedType === type.value ? 'contained' : 'outlined'}
                onClick={() => setSelectedType(type.value)}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.8rem',
                  px: 1.5,
                  py: 0.5,
                  borderColor: selectedType === type.value ? 'primary.main' : '#d0d0d0',
                  color: selectedType === type.value ? 'primary.contrastText' : 'text.primary',
                  backgroundColor: selectedType === type.value ? 'primary.main' : 'white',
                  '&:hover': {
                    backgroundColor: selectedType === type.value ? 'primary.dark' : '#f0f0f0',
                    borderColor: 'primary.main',
                  }
                }}
              >
                {type.label}
                <Chip 
                  size="small" 
                  label={records.filter(r => r.Type === type.value).length}
                  sx={{ 
                    ml: 0.75, 
                    minWidth: 18, 
                    height: 18, 
                    fontSize: '0.65rem',
                    backgroundColor: selectedType === type.value ? 'rgba(255,255,255,0.3)' : '#e0e0e0'
                  }}
                />
              </Button>
            ))}
          </Box>
        </Box>
      </Box>
      
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell sx={{ fontSize: '0.75rem', fontWeight: 'bold', py: 0.5 }}>ID</TableCell>
              <TableCell sx={{ fontSize: '0.75rem', fontWeight: 'bold', py: 0.5 }}>Type</TableCell>
              <TableCell sx={{ fontSize: '0.75rem', fontWeight: 'bold', py: 0.5 }}>Description</TableCell>
              <TableCell align="center" sx={{ fontSize: '0.75rem', fontWeight: 'bold', py: 0.5 }}>Purchase Currency</TableCell>
              <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 'bold', py: 0.5 }}>Original Curr Value</TableCell>
              <TableCell sx={{ fontSize: '0.75rem', fontWeight: 'bold', py: 0.5 }}>Purchase Date</TableCell>
              <TableCell sx={{ fontSize: '0.75rem', fontWeight: 'bold', py: 0.5 }}>USD Value</TableCell>
              <TableCell sx={{ fontSize: '0.75rem', fontWeight: 'bold', py: 0.5 }}>Useful Months</TableCell>
              <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 'bold', py: 0.5 }}>Monthly Cost</TableCell>
              <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 'bold', py: 0.5 }}>{getMonthLabel(selectedDate, -2)}</TableCell>
              <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 'bold', py: 0.5 }}>{getMonthLabel(selectedDate, -1)}</TableCell>
              <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 'bold', py: 0.5 }}>{getMonthLabel(selectedDate, 0)}</TableCell>
              <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 'bold', py: 0.5 }}>Balance</TableCell>
              <TableCell sx={{ fontSize: '0.75rem', fontWeight: 'bold', py: 0.5 }}>Status</TableCell>
              {selectedType === 'Fixed Asset' && <TableCell sx={{ fontSize: '0.75rem', fontWeight: 'bold', py: 0.5 }}>Disposal Date</TableCell>}
              <TableCell sx={{ fontSize: '0.75rem', fontWeight: 'bold', py: 0.5 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={selectedType === 'Fixed Asset' ? 15 : 14} align="center" sx={{ py: 2, fontSize: '0.85rem' }}>
                  <Typography color="text.secondary" sx={{ py: 1 }}>
                    No scheduled records found for type: {selectedType}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredRecords.map((record) => (
                <TableRow key={record.ScheduledID} hover sx={{ '&:hover': { backgroundColor: '#fafafa' } }}>
                  <TableCell sx={{ fontSize: '0.75rem', py: 0.5 }}>{record.ScheduledID}</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', py: 0.5 }}>{record.Type}</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', py: 0.5, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Tooltip title={record.Description || ''}>
                      <span>{record.Description || '-'}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="center" sx={{ fontSize: '0.75rem', py: 0.5 }}>{record.PurchaseCurrency || '-'}</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem', py: 0.5 }}>{record.OriginalCurrencyValue?.toFixed(2) || '0.00'}</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', py: 0.5 }}>{formatDate(record.PurchaseDate)}</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem', py: 0.5 }}>{formatCurrency(record.USDValue, 'USD')}</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', py: 0.5 }}>{record.UsefulMonths}</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem', py: 0.5 }}>{formatCurrency(getDailyDepreciationCost(record.USDValue, record.UsefulMonths) * 30, 'USD')}</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem', py: 0.5 }}>{formatCurrency(getMonthValue(record, -2), 'USD')}</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem', py: 0.5 }}>{formatCurrency(getMonthValue(record, -1), 'USD')}</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem', py: 0.5 }}>{formatCurrency(getMonthValue(record, 0), 'USD')}</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem', py: 0.5, fontWeight: 'bold' }}>{formatCurrency(getBalance(record), 'USD')}</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', py: 0.5 }}>
                    <Chip 
                      label={record.Disposed ? (record.Type === 'Fixed Asset' ? 'Disposed' : 'Expensed') : 'Active'}
                      color={record.Disposed ? 'error' : 'success'}
                      size="small"
                      sx={{ fontSize: '0.65rem' }}
                    />
                  </TableCell>
                  {selectedType === 'Fixed Asset' && <TableCell sx={{ fontSize: '0.75rem', py: 0.5 }}>{formatDate(record.DisposalDate || null)}</TableCell>}
                  <TableCell sx={{ fontSize: '0.75rem', py: 0.5 }}>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="View">
                        <IconButton 
                          size="small" 
                          color="info"
                          onClick={() => openViewModal(record)}
                          sx={{ padding: '4px' }}
                        >
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton 
                          size="small" 
                          color="primary"
                          onClick={() => openEditModal(record)}
                          sx={{ padding: '4px' }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton 
                          size="small" 
                          color="error"
                          onClick={() => openDeleteDialog(record)}
                          sx={{ padding: '4px' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#e8e8e8', fontWeight: 'bold' }}>
              <TableCell sx={{ fontSize: '0.75rem', fontWeight: 'bold', py: 0.5 }} colSpan={6}></TableCell>
              <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 'bold', py: 0.5, color: '#1976d2' }}>
                {formatCurrency(filteredRecords.reduce((sum, r) => sum + r.USDValue, 0), 'USD')}
              </TableCell>
              <TableCell sx={{ fontSize: '0.75rem', fontWeight: 'bold', py: 0.5 }}></TableCell>
              <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 'bold', py: 0.5, color: '#1976d2' }}>
                {formatCurrency(filteredRecords.reduce((sum, r) => sum + (getDailyDepreciationCost(r.USDValue, r.UsefulMonths) * 30), 0), 'USD')}
              </TableCell>
              <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 'bold', py: 0.5, color: '#1976d2' }}>
                {formatCurrency(filteredRecords.reduce((sum, r) => sum + getMonthValue(r, -2), 0), 'USD')}
              </TableCell>
              <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 'bold', py: 0.5, color: '#1976d2' }}>
                {formatCurrency(filteredRecords.reduce((sum, r) => sum + getMonthValue(r, -1), 0), 'USD')}
              </TableCell>
              <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 'bold', py: 0.5, color: '#1976d2' }}>
                {formatCurrency(filteredRecords.reduce((sum, r) => sum + getMonthValue(r, 0), 0), 'USD')}
              </TableCell>
              <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 'bold', py: 0.5, color: '#1976d2' }}>
                {formatCurrency(filteredRecords.reduce((sum, r) => sum + getBalance(r), 0), 'USD')}
              </TableCell>
              <TableCell sx={{ fontSize: '0.75rem', fontWeight: 'bold', py: 0.5 }} colSpan={selectedType === 'Fixed Asset' ? 3 : 2}></TableCell>
            </TableRow>
          </TableHead>
        </Table>
      </TableContainer>
      
      {/* Modals */}
      <ScheduledRecordModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={handleCreate}
        isEdit={false}
      />
      
      <ScheduledRecordModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSave={handleUpdate}
        record={selectedRecord}
        isEdit={true}
      />
      
      <ScheduledRecordViewModal
        open={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        record={selectedRecord}
      />
      
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete Scheduled Record"
        message="Are you sure you want to delete this scheduled record? This action cannot be undone."
        loading={actionLoading}
      />
    </Box>
  );
}
