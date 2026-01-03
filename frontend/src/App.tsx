import { useState } from 'react';
import { Box, AppBar, Toolbar, Container, Select, FormControl, InputLabel, MenuItem, Button, Chip, IconButton, Tooltip } from '@mui/material';
import { ExitToApp as ExitIcon } from '@mui/icons-material';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getYear, getMonth } from 'date-fns';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PermissionsProvider, usePermissions } from './contexts/PermissionsContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Home from './pages/Home';
import Projects from './pages/Projects';
import GanttChart from './pages/GanttChart';
import Glidepath from './pages/Glidepath';
import Payments from './pages/Payments';
import Positions from './pages/Positions';
import Resources from './pages/Resources';
import PayrollAllocation from './pages/PayrollAllocation';
import ScheduledRecords from './pages/ScheduledRecords';
import Report from './pages/Report';
import Settings from './pages/Settings';
import NoAccessPage from './pages/NoAccessPage';
import PermissionDenied from './pages/PermissionDenied';

const queryClient = new QueryClient();

function AppContent() {
  const { isAuthenticated, userDisplayName, logout } = useAuth();
  const { userRole, hasAccess, getPagePermissions, canAccessSettings, isSuperAdmin, viewingAsRole, setViewingAsRole } = usePermissions();

  // Load saved date from localStorage or use current date
  const getSavedDate = () => {
    const savedDate = localStorage.getItem('selectedDate');
    if (savedDate) {
      try {
        return new Date(JSON.parse(savedDate));
      } catch {
        return new Date();
      }
    }
    return new Date();
  };

  const [selectedDate, setSelectedDate] = useState(getSavedDate);

  // Save date to localStorage whenever it changes
  const updateSelectedDate = (newDate: Date) => {
    setSelectedDate(newDate);
    localStorage.setItem('selectedDate', JSON.stringify(newDate));
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = getYear(new Date());
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 1 + i);

  const handleMonthChange = (event: any) => {
    const newMonth = parseInt(event.target.value);
    const newDate = new Date(selectedDate);
    newDate.setMonth(newMonth);
    updateSelectedDate(newDate);
  };

  const handleYearChange = (event: any) => {
    const newYear = parseInt(event.target.value);
    const newDate = new Date(selectedDate);
    newDate.setFullYear(newYear);
    updateSelectedDate(newDate);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {isAuthenticated && hasAccess && (
        <AppBar position="static">
          <Toolbar>
            <Box component={Link} to="/" sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
              <img src="/logo.png" alt="Stalo" style={{ height: '40px', marginRight: '8px' }} />
            </Box>
            
            {/* Navigation menu - conditional based on permissions */}
            <Box sx={{ flexGrow: 1, display: 'flex', gap: 1, alignItems: 'center', ml: 2 }}>
              {getPagePermissions('home').canView && (
                <Button component={Link} to="/" color="inherit" sx={{ textTransform: 'none' }}>Home</Button>
              )}
              {getPagePermissions('projects').canView && (
                <Button component={Link} to="/projects" color="inherit" sx={{ textTransform: 'none' }}>Projects</Button>
              )}
              {getPagePermissions('positions').canView && (
                <Button component={Link} to="/positions" color="inherit" sx={{ textTransform: 'none' }}>Positions</Button>
              )}
              {getPagePermissions('resources').canView && (
                <Button component={Link} to="/resources" color="inherit" sx={{ textTransform: 'none' }}>Resources</Button>
              )}
              {getPagePermissions('payroll').canView && (
                <Button component={Link} to="/payroll-allocation" color="inherit" sx={{ textTransform: 'none' }}>Payroll Allocation</Button>
              )}
              {getPagePermissions('scheduled-records').canView && (
                <Button component={Link} to="/scheduled-records" color="inherit" sx={{ textTransform: 'none' }}>Scheduled Records</Button>
              )}
              {getPagePermissions('report').canView && (
                <Button component={Link} to="/report" color="inherit" sx={{ textTransform: 'none' }}>Report</Button>
              )}
              {getPagePermissions('glidepath').canView && (
                <Button component={Link} to="/glidepath" color="inherit" sx={{ textTransform: 'none' }}>Glidepath</Button>
              )}
              {getPagePermissions('payments').canView && (
                <Button component={Link} to="/payments" color="inherit" sx={{ textTransform: 'none' }}>Payments</Button>
              )}
              {canAccessSettings() && (
                <Button component={Link} to="/settings" color="inherit" sx={{ textTransform: 'none' }}>Settings</Button>
              )}
            </Box>

            {/* User info and Month/Year Filter */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <FormControl sx={{ minWidth: 150 }} size="small">
                <InputLabel sx={{ color: 'white' }}>Month</InputLabel>
                <Select
                  value={getMonth(selectedDate)}
                  label="Month"
                  onChange={handleMonthChange}
                  sx={{ color: 'white', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'white' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'white' }, '.MuiSvgIcon-root': { color: 'white' } }}
                >
                  {months.map((month, index) => (
                    <MenuItem key={index} value={index}>
                      {month}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl sx={{ minWidth: 120 }} size="small">
                <InputLabel sx={{ color: 'white' }}>Year</InputLabel>
                <Select
                  value={getYear(selectedDate)}
                  label="Year"
                  onChange={handleYearChange}
                  sx={{ color: 'white', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'white' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'white' }, '.MuiSvgIcon-root': { color: 'white' } }}
                >
                  {years.map((year) => (
                    <MenuItem key={year} value={year}>
                      {year}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {isSuperAdmin && viewingAsRole && (
                <Tooltip title="Exit View Mode - Return to Super Admin">
                  <IconButton 
                    onClick={() => setViewingAsRole(null)}
                    sx={{ 
                      color: 'white', 
                      backgroundColor: 'error.main',
                      '&:hover': { backgroundColor: 'error.dark' },
                      mr: 1
                    }}
                    size="small"
                  >
                    <ExitIcon />
                  </IconButton>
                </Tooltip>
              )}
              <Chip 
                label={`${userDisplayName} (${userRole || 'No Role'})`} 
                color={userRole === 'Admin' ? 'error' : viewingAsRole ? 'warning' : 'default'}
                size="small"
                sx={{ color: 'white', borderColor: 'white' }}
                variant="outlined"
              />
              <Button color="inherit" onClick={logout} sx={{ textTransform: 'none' }}>
                Logout
              </Button>
            </Box>
          </Toolbar>
        </AppBar>
      )}

      <Container maxWidth="xl" sx={{ mt: isAuthenticated && hasAccess ? 4 : 0, mb: 4, flexGrow: 1 }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/no-access" element={<NoAccessPage />} />
          <Route path="/permission-denied" element={<PermissionDenied />} />
          <Route path="/" element={<ProtectedRoute page="home"><Home selectedDate={selectedDate} /></ProtectedRoute>} />
          <Route path="/projects" element={<ProtectedRoute page="projects"><Projects /></ProtectedRoute>} />
          <Route path="/gantt" element={<ProtectedRoute page="gantt"><GanttChart selectedDate={selectedDate} /></ProtectedRoute>} />
          <Route path="/glidepath" element={<ProtectedRoute page="glidepath"><Glidepath /></ProtectedRoute>} />
          <Route path="/payments" element={<ProtectedRoute page="payments"><Payments /></ProtectedRoute>} />
          <Route path="/positions" element={<ProtectedRoute page="positions"><Positions /></ProtectedRoute>} />
          <Route path="/resources" element={<ProtectedRoute page="resources"><Resources /></ProtectedRoute>} />
          <Route path="/payroll-allocation" element={<ProtectedRoute page="payroll"><PayrollAllocation selectedDate={selectedDate} /></ProtectedRoute>} />
          <Route path="/scheduled-records" element={<ProtectedRoute page="scheduled-records"><ScheduledRecords /></ProtectedRoute>} />
          <Route path="/report" element={<ProtectedRoute page="report"><Report /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute page="settings"><Settings /></ProtectedRoute>} />
        </Routes>
      </Container>
    </Box>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PermissionsProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </PermissionsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
