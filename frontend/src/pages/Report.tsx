import { Box, Typography, Button, Card, CardContent, Chip, Tooltip, TextField, FormControl, InputLabel, Select, MenuItem, Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, CircularProgress, Autocomplete } from '@mui/material';
import { CloudSync as CloudSyncIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { getBusinessCentralService, initBusinessCentralService } from '../services/businessCentralService';

interface ProjectLedgerEntry {
  Donor_Project_No: string;
  Donor_Project_Task_No: string;
  Donor_Description: string;
  Document_No: string;
  Posting_Date: string;
  Azz_Vendor_Name: string;
  Azz_Transaction_Currency: string;
  Azz_Transaction_Amount: number;
  Project_Currency: string;
  // Amount will be calculated
}

export default function Report() {
  const { isAuthenticated, login, logout, userDisplayName, isLoading: authLoading, error: authError, clearError } = useAuth();
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [projectOptions, setProjectOptions] = useState<string[]>([]);
  const [ledgerData, setLedgerData] = useState<ProjectLedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Fetch available projects on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchProjects();
    }
  }, [isAuthenticated]);

  const fetchProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const response = await fetch('http://localhost:3001/api/bc/projects');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch projects');
      }
      
      setProjectOptions(data.projects.sort());
      console.log(`✅ Loaded ${data.projects.length} projects from Job_List`);
    } catch (err: any) {
      console.error('Failed to fetch projects:', err);
      setReportError('Failed to load project list: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const generateReport = async () => {
    if (!projectFilter) {
      setReportError('Please select a project');
      return;
    }

    setIsLoading(true);
    setReportError(null);

    try {
      const params = new URLSearchParams({
        project: projectFilter,
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      });

      const response = await fetch(`http://localhost:3001/api/bc/ledger-entries?${params}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate report');
      }
      
      setLedgerData(data.entries);
      console.log(`✅ Fetched ${data.count} ledger entries for project ${projectFilter} (${startDate} to ${endDate})`);
    } catch (err: any) {
      console.error('Failed to generate report:', err);
      setReportError(err.message || 'Failed to generate report');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate amount in project currency (placeholder formula - adjust as needed)
  const calculateAmount = (entry: ProjectLedgerEntry): number => {
    // If currencies match, return transaction amount
    if (entry.Azz_Transaction_Currency === entry.Project_Currency) {
      return entry.Azz_Transaction_Amount;
    }
    // Otherwise, would need exchange rate conversion
    return entry.Azz_Transaction_Amount;
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>Financial Report</Typography>
      
      {/* Error Display */}
      {(authError || reportError) && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          onClose={() => {
            clearError();
            setReportError(null);
          }}
        >
          {authError || reportError}
        </Alert>
      )}
      
      {/* Business Central Connection & Filters Combined */}
      <Card sx={{ mb: 3, backgroundColor: '#f5f5f5', border: '2px solid #1976d2' }}>
        <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 1.5 }}>
            {/* Left: Connection Status */}
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                  Business Central
                </Typography>
              </Box>
              {isAuthenticated && (
                <Chip
                  label={`Connected: ${userDisplayName}`}
                  color="success"
                  variant="filled"
                  size="small"
                  sx={{ fontWeight: 'bold' }}
                />
              )}
            </Box>
            
            {/* Right: Connect Button */}
            <Tooltip title={isAuthenticated ? 'Disconnect from Business Central' : 'Connect to Business Central'}>
              <Button 
                variant={isAuthenticated ? 'contained' : 'outlined'}
                color={isAuthenticated ? 'success' : 'primary'}
                startIcon={<CloudSyncIcon />}
                onClick={() => isAuthenticated ? logout() : login()}
                disabled={authLoading}
                size="small"
                sx={{ minWidth: '140px' }}
              >
                {authLoading ? 'Connecting...' : isAuthenticated ? 'Disconnect' : 'Connect to BC'}
              </Button>
            </Tooltip>
          </Box>

          {!isAuthenticated && (
            <Typography variant="caption" sx={{ color: '#d32f2f', display: 'block', mb: 1 }}>
              ⚠️ Configure VITE_MSAL_CLIENT_ID and VITE_MSAL_TENANT_ID in .env.local
            </Typography>
          )}

          {/* Filters Row */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Autocomplete
              sx={{ minWidth: 250 }}
              size="small"
              options={projectOptions}
              value={projectFilter}
              onChange={(event, newValue) => setProjectFilter(newValue || '')}
              renderInput={(params) => <TextField {...params} label="Donor Project No" />}
              disabled={!isAuthenticated}
              loading={isLoadingProjects}
            />

            <TextField
              label="From Date"
              type="date"
              size="small"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 140 }}
              disabled={!isAuthenticated}
            />

            <TextField
              label="To Date"
              type="date"
              size="small"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 140 }}
              disabled={!isAuthenticated}
            />

            <Button 
              variant="contained" 
              color="primary"
              size="small"
              disabled={!isAuthenticated || isLoading || !projectFilter}
              onClick={generateReport}
              startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {isLoading ? 'Loading...' : 'Generate Report'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Report Table */}
      <Card>
        <CardContent>
          <TableContainer component={Paper} sx={{ maxHeight: 600, border: '1px solid #ddd' }}>
            <Table stickyHeader aria-label="invoice report table">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#1976d2' }}>
                  <TableCell sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#1976d2', fontSize: '0.75rem', border: '1px solid #ddd' }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#1976d2', fontSize: '0.75rem', border: '1px solid #ddd' }}>Category Detail</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#1976d2', fontSize: '0.75rem', border: '1px solid #ddd' }}>Invoice Number</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#1976d2', fontSize: '0.75rem', border: '1px solid #ddd' }}>Document Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#1976d2', fontSize: '0.75rem', border: '1px solid #ddd' }}>Supplier</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#1976d2', fontSize: '0.75rem', border: '1px solid #ddd' }}>Invoice Currency</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#1976d2', fontSize: '0.75rem', border: '1px solid #ddd' }}>Invoice Amount</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#1976d2', fontSize: '0.75rem', border: '1px solid #ddd' }}>Project Currency</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#1976d2', fontSize: '0.75rem', border: '1px solid #ddd' }}>Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!isAuthenticated ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      <Typography variant="body2">
                        No data. Connect to Business Central to generate a report.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : ledgerData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      <Typography variant="body2">
                        {isLoading ? 'Loading report data...' : 'No data. Select a project and click Generate Report.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  ledgerData.map((entry, index) => (
                    <TableRow key={index} hover>
                      <TableCell sx={{ fontSize: '0.75rem', py: 1, px: 1, border: '1px solid #ddd' }}>
                        {entry.Donor_Project_Task_No}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', py: 1, px: 1, border: '1px solid #ddd' }}>
                        {entry.Donor_Description}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', py: 1, px: 1, border: '1px solid #ddd' }}>
                        {entry.Document_No}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', py: 1, px: 1, border: '1px solid #ddd' }}>
                        {new Date(entry.Posting_Date).toLocaleDateString()}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', py: 1, px: 1, border: '1px solid #ddd' }}>
                        {entry.Azz_Vendor_Name}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', py: 1, px: 1, border: '1px solid #ddd' }}>
                        {entry.Azz_Transaction_Currency}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.75rem', py: 1, px: 1, border: '1px solid #ddd' }}>
                        {entry.Azz_Transaction_Amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', py: 1, px: 1, border: '1px solid #ddd' }}>
                        {entry.Project_Currency}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.75rem', py: 1, px: 1, border: '1px solid #ddd' }}>
                        {calculateAmount(entry).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
