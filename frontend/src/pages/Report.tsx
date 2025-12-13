import { Box, Typography, Button, Card, CardContent, Chip, Tooltip, TextField, FormControl, InputLabel, Select, MenuItem, Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { CloudSync as CloudSyncIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';

export default function Report() {
  const { isAuthenticated, login, logout, userDisplayName, isLoading: authLoading, error: authError, clearError } = useAuth();
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>Financial Report</Typography>
      
      {/* Error Display */}
      {authError && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          onClose={clearError}
        >
          {authError}
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
            <FormControl sx={{ minWidth: 140 }} size="small">
              <InputLabel sx={{ fontSize: '0.85rem' }}>Project</InputLabel>
              <Select
                value={projectFilter}
                label="Project"
                onChange={(e) => setProjectFilter(e.target.value)}
              >
                <MenuItem value="all">All Projects</MenuItem>
                <MenuItem value="ark">ARK Group</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Start Date"
              type="date"
              size="small"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 140 }}
            />

            <TextField
              label="End Date"
              type="date"
              size="small"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 140 }}
            />

            <Button 
              variant="contained" 
              color="primary"
              size="small"
              disabled={!isAuthenticated}
              onClick={() => {
                if (isAuthenticated) {
                  console.log('Generating report with filters:', { projectFilter, startDate, endDate });
                }
              }}
            >
              Generate
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
                  <TableCell sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#1976d2', fontSize: '0.75rem', border: '1px solid #ddd' }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#1976d2', fontSize: '0.75rem', border: '1px solid #ddd' }}>Invoice Number</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#1976d2', fontSize: '0.75rem', border: '1px solid #ddd' }}>Document Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#1976d2', fontSize: '0.75rem', border: '1px solid #ddd' }}>Supplier</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#1976d2', fontSize: '0.75rem', border: '1px solid #ddd' }}>Invoice Currency</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#1976d2', fontSize: '0.75rem', border: '1px solid #ddd' }}>Invoice Amount</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#1976d2', fontSize: '0.75rem', border: '1px solid #ddd' }}>Project Currency</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#1976d2', fontSize: '0.75rem', border: '1px solid #ddd' }}>Amount</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#1976d2', fontSize: '0.75rem', border: '1px solid #ddd' }}>Approved Budget</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#1976d2', fontSize: '0.75rem', border: '1px solid #ddd' }}>Variance To Budget</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!isAuthenticated ? (
                  <TableRow>
                    <TableCell colSpan={12} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      <Typography variant="body2">
                        No data. Connect to Business Central to generate a report.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  // Sample data rows (will be replaced with actual BC data)
                  [1, 2, 3].map((i) => (
                    <TableRow key={i} hover>
                      <TableCell sx={{ fontSize: '0.75rem', py: 1, px: 1, border: '1px solid #ddd' }}>Sample Cat {i}</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', py: 1, px: 1, border: '1px solid #ddd' }}>Detail {i}</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', py: 1, px: 1, border: '1px solid #ddd' }}>Sample Description {i}</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', py: 1, px: 1, border: '1px solid #ddd' }}>INV-{1000 + i}</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', py: 1, px: 1, border: '1px solid #ddd' }}>2024-12-{String(i).padStart(2, '0')}</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', py: 1, px: 1, border: '1px solid #ddd' }}>Supplier {i}</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', py: 1, px: 1, border: '1px solid #ddd' }}>USD</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.75rem', py: 1, px: 1, border: '1px solid #ddd' }}>$10,000.00</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', py: 1, px: 1, border: '1px solid #ddd' }}>USD</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.75rem', py: 1, px: 1, border: '1px solid #ddd' }}>$10,000.00</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.75rem', py: 1, px: 1, border: '1px solid #ddd' }}>$15,000.00</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.75rem', py: 1, px: 1, border: '1px solid #ddd', color: '#d32f2f', fontWeight: 'bold' }}>$-5,000.00</TableCell>
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
