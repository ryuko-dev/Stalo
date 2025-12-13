import { useState } from 'react';
import { Box, AppBar, Toolbar, Typography, Container, Select, FormControl, InputLabel, MenuItem, Button } from '@mui/material';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getYear, getMonth } from 'date-fns';
import { AuthProvider } from './contexts/AuthContext';
import Home from './pages/Home';
import Projects from './pages/Projects';
import GanttChart from './pages/GanttChart';
import Positions from './pages/Positions';
import Resources from './pages/Resources';
import PayrollAllocation from './pages/PayrollAllocation';
import ScheduledRecords from './pages/ScheduledRecords';
import Report from './pages/Report';
import Settings from './pages/Settings';
// Removed ProjectDetail and AllocationManager — pages deleted by user

const queryClient = new QueryClient();

function App() {
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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <AppBar position="static">
              <Toolbar>
                <Typography variant="h6" component={Link} to="/" sx={{ textDecoration: 'none', color: 'inherit' }}>
                  Stalo
                </Typography>
                
                {/* Navigation menu */}
                <Box sx={{ flexGrow: 1, display: 'flex', gap: 1, alignItems: 'center', ml: 2 }}>
                  <Button component={Link} to="/" color="inherit" sx={{ textTransform: 'none' }}>Home</Button>
                  <Button component={Link} to="/projects" color="inherit" sx={{ textTransform: 'none' }}>Projects</Button>
                  <Button component={Link} to="/positions" color="inherit" sx={{ textTransform: 'none' }}>Positions</Button>
                  <Button component={Link} to="/resources" color="inherit" sx={{ textTransform: 'none' }}>Resources</Button>
                  <Button component={Link} to="/payroll-allocation" color="inherit" sx={{ textTransform: 'none' }}>Payroll Allocation</Button>
                  <Button component={Link} to="/scheduled-records" color="inherit" sx={{ textTransform: 'none' }}>Scheduled Records</Button>
                  <Button component={Link} to="/report" color="inherit" sx={{ textTransform: 'none' }}>Report</Button>
                  <Button component={Link} to="/settings" color="inherit" sx={{ textTransform: 'none' }}>Settings</Button>
                </Box>

                {/* Month and Year Filter */}
                <Box sx={{ display: 'flex', gap: 2 }}>
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
                </Box>
              </Toolbar>
            </AppBar>
            
            <Container maxWidth="xl" sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
              <Routes>
                <Route path="/" element={<Home selectedDate={selectedDate} />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/gantt" element={<GanttChart selectedDate={selectedDate} />} />
                <Route path="/positions" element={<Positions />} />
                <Route path="/resources" element={<Resources />} />
                <Route path="/payroll-allocation" element={<PayrollAllocation selectedDate={selectedDate} />} />
                <Route path="/scheduled-records" element={<ScheduledRecords />} />
                <Route path="/report" element={<Report />} />
                <Route path="/settings" element={<Settings />} />
                {/* Project detail and allocation manager were removed — keep routes minimal */}
              </Routes>
            </Container>
          </Box>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
