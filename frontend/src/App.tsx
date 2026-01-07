import { useState } from 'react';
import { Box, AppBar, Toolbar, Container, Select, FormControl, InputLabel, MenuItem, Button, Chip, IconButton, Tooltip, Menu, Typography } from '@mui/material';
import { ExitToApp as ExitIcon, ArrowDropDown as ArrowDropDownIcon, Settings as SettingsIcon, Logout as LogoutIcon } from '@mui/icons-material';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
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
  const location = useLocation();

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

  // State for Staff Allocation dropdown
  const [staffAllocationAnchorEl, setStaffAllocationAnchorEl] = useState<null | HTMLElement>(null);
  const isStaffAllocationOpen = Boolean(staffAllocationAnchorEl);

  const handleStaffAllocationClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setStaffAllocationAnchorEl(event.currentTarget);
  };

  const handleStaffAllocationClose = () => {
    setStaffAllocationAnchorEl(null);
  };

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
                <Button component={Link} to="/" color="inherit" sx={{ textTransform: 'none', fontSize: '0.8rem', border: '1px solid rgba(255, 255, 255, 0.5)', '&:hover': { border: '1px solid white' }, minHeight: '40px', display: 'flex', alignItems: 'center', backgroundColor: location.pathname === '/' ? 'rgba(255, 255, 255, 0.2)' : 'transparent', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)' }}>Home</Button>
              )}
              {/* Staff Allocation Dropdown */}
              {(getPagePermissions('projects').canView || getPagePermissions('positions').canView || getPagePermissions('resources').canView) && (
                <>
                  <Button 
                    color="inherit" 
                    sx={{ textTransform: 'none', fontSize: '0.8rem', whiteSpace: 'normal', lineHeight: 1.2, py: 0.5, border: '1px solid rgba(255, 255, 255, 0.5)', '&:hover': { border: '1px solid white' }, minHeight: '40px', display: 'flex', alignItems: 'center', backgroundColor: ['/projects', '/positions', '/resources'].includes(location.pathname) ? 'rgba(255, 255, 255, 0.2)' : 'transparent', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)' }}
                    onClick={handleStaffAllocationClick}
                    endIcon={<ArrowDropDownIcon />}
                  >
                    Staff Allocation
                  </Button>
                  <Menu
                    anchorEl={staffAllocationAnchorEl}
                    open={isStaffAllocationOpen}
                    onClose={handleStaffAllocationClose}
                    anchorOrigin={{
                      vertical: 'bottom',
                      horizontal: 'left',
                    }}
                    transformOrigin={{
                      vertical: 'top',
                      horizontal: 'left',
                    }}
                  >
                    {getPagePermissions('projects').canView && (
                      <MenuItem component={Link} to="/projects" onClick={handleStaffAllocationClose}>
                        Projects
                      </MenuItem>
                    )}
                    {getPagePermissions('positions').canView && (
                      <MenuItem component={Link} to="/positions" onClick={handleStaffAllocationClose}>
                        Positions
                      </MenuItem>
                    )}
                    {getPagePermissions('resources').canView && (
                      <MenuItem component={Link} to="/resources" onClick={handleStaffAllocationClose}>
                        Resources
                      </MenuItem>
                    )}
                  </Menu>
                </>
              )}
              {getPagePermissions('payroll').canView && (
                <Button component={Link} to="/payroll-allocation" color="inherit" sx={{ textTransform: 'none', fontSize: '0.8rem', whiteSpace: 'normal', lineHeight: 1.2, py: 0.5, border: '1px solid rgba(255, 255, 255, 0.5)', '&:hover': { border: '1px solid white' }, minHeight: '40px', display: 'flex', alignItems: 'center', backgroundColor: location.pathname === '/payroll-allocation' ? 'rgba(255, 255, 255, 0.2)' : 'transparent', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)' }}>Payroll Allocation</Button>
              )}
              {getPagePermissions('scheduled-records').canView && (
                <Button component={Link} to="/scheduled-records" color="inherit" sx={{ textTransform: 'none', fontSize: '0.8rem', whiteSpace: 'normal', lineHeight: 1.2, py: 0.5, border: '1px solid rgba(255, 255, 255, 0.5)', '&:hover': { border: '1px solid white' }, minHeight: '40px', display: 'flex', alignItems: 'center', backgroundColor: location.pathname === '/scheduled-records' ? 'rgba(255, 255, 255, 0.2)' : 'transparent', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)' }}>Scheduled Records</Button>
              )}
              {getPagePermissions('report').canView && (
                <Button component={Link} to="/report" color="inherit" sx={{ textTransform: 'none', fontSize: '0.8rem', border: '1px solid rgba(255, 255, 255, 0.5)', '&:hover': { border: '1px solid white' }, minHeight: '40px', display: 'flex', alignItems: 'center', backgroundColor: location.pathname === '/report' ? 'rgba(255, 255, 255, 0.2)' : 'transparent', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)' }}>Report</Button>
              )}
              {getPagePermissions('glidepath').canView && (
                <Button component={Link} to="/glidepath" color="inherit" sx={{ textTransform: 'none', fontSize: '0.8rem', border: '1px solid rgba(255, 255, 255, 0.5)', '&:hover': { border: '1px solid white' }, minHeight: '40px', display: 'flex', alignItems: 'center', backgroundColor: location.pathname === '/glidepath' ? 'rgba(255, 255, 255, 0.2)' : 'transparent', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)' }}>Glidepath</Button>
              )}
              {getPagePermissions('payments').canView && (
                <Button component={Link} to="/payments" color="inherit" sx={{ textTransform: 'none', fontSize: '0.8rem', border: '1px solid rgba(255, 255, 255, 0.5)', '&:hover': { border: '1px solid white' }, minHeight: '40px', display: 'flex', alignItems: 'center', backgroundColor: location.pathname === '/payments' ? 'rgba(255, 255, 255, 0.2)' : 'transparent', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)' }}>Payments</Button>
              )}
            </Box>

            {/* User info and Month/Year Filter */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', ml: 8 }}>
              <FormControl sx={{ minWidth: 90 }} size="small">
                <Select
                  value={getMonth(selectedDate)}
                  onChange={handleMonthChange}
                  displayEmpty
                  sx={{ color: 'white', fontSize: '0.8rem', height: '40px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'white' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'white' }, '.MuiSvgIcon-root': { color: 'white' } }}
                >
                  {months.map((month, index) => (
                    <MenuItem key={index} value={index}>
                      {month}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl sx={{ minWidth: 75 }} size="small">
                <Select
                  value={getYear(selectedDate)}
                  onChange={handleYearChange}
                  displayEmpty
                  sx={{ color: 'white', fontSize: '0.8rem', height: '40px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'white' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'white' }, '.MuiSvgIcon-root': { color: 'white' } }}
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
              <Box sx={{ 
                display: 'flex', 
                gap: 0.5, 
                alignItems: 'center', 
                border: '1px solid rgba(255, 255, 255, 0.5)', 
                borderRadius: '4px', 
                px: 1, 
                minHeight: '40px',
                height: '40px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
              }}>
                <Typography sx={{ color: 'white', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                  {userDisplayName} ({userRole || 'No Role'})
                </Typography>
                {canAccessSettings() && (
                  <Tooltip title="Settings">
                    <IconButton 
                      component={Link} 
                      to="/settings" 
                      sx={{ color: 'white', padding: '4px' }}
                      size="small"
                    >
                      <SettingsIcon sx={{ fontSize: '1rem' }} />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Logout">
                  <IconButton 
                    onClick={logout} 
                    sx={{ color: 'white', padding: '4px' }}
                    size="small"
                  >
                    <LogoutIcon sx={{ fontSize: '1rem' }} />
                  </IconButton>
                </Tooltip>
              </Box>
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
