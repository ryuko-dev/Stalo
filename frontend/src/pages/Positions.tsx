import { useState, useMemo, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  TextField, 
  Select, 
  MenuItem, 
  FormControl, 
  Button, 
  IconButton,
  Card,
  CardContent,
  Chip,
  Alert,
  Snackbar,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { 
  Delete as DeleteIcon, 
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Edit as EditIcon,
  Download as DownloadIcon,
  Upload as UploadIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPositionsCombinedData, createPosition, updatePosition, deletePosition, createAllocation, deleteAllocation, validatePositionAllocations } from '../services/staloService';
import type { PositionsCombinedData } from '../services/staloService';
import type { Position } from '../types';
import type { Resource } from '../types';
import type { Allocation } from '../types';
import { format, isWithinInterval, isBefore, isAfter, startOfMonth, endOfMonth } from 'date-fns';

export default function Positions() {
  const queryClient = useQueryClient();
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'allocated' | 'unallocated'>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  
  // Date range filter - defaults to current month
  const today = new Date();
  const [startDate, setStartDate] = useState<Date>(startOfMonth(today));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(today));

  const showNotification = (message: string, severity: 'success' | 'error' = 'success') => {
    setNotification({ open: true, message, severity });
  };

  // Format dates for API query - memoized to avoid recalculation
  const dateParams = useMemo(() => ({
    startMonth: format(startDate, 'yyyy-MM'),
    endMonth: format(endDate, 'yyyy-MM')
  }), [startDate, endDate]);

  // Single combined query for all data with server-side date filtering
  // Query key includes date params so it refetches when date range changes
  const { data: combinedData } = useQuery<PositionsCombinedData, Error>({ 
    queryKey: ['positionsCombined', dateParams.startMonth, dateParams.endMonth], 
    queryFn: () => getPositionsCombinedData(dateParams), 
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });

  // Extract data from combined response
  const positionsData = combinedData?.positions;
  const projectsData = combinedData?.projects;
  const resourcesData = combinedData?.resources;
  const allocationsData = combinedData?.allocations;

  const createMutation = useMutation<Position, Error, Partial<Position>>({
    mutationFn: (payload) => createPosition(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positionsCombined'] });
      showNotification('Position created successfully!', 'success');
    },
    onError: (error) => {
      showNotification(`Error creating position: ${error.message}`, 'error');
    }
  });

  const updateMutation = useMutation<Position, Error, { id: string; payload: Partial<Position> }>({
    mutationFn: ({ id, payload }) => updatePosition(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positionsCombined'] });
      showNotification('Position updated successfully!', 'success');
    },
    onError: (error) => {
      showNotification(`Error updating position: ${error.message}`, 'error');
    }
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (id) => deletePosition(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positionsCombined'] });
      showNotification('Position deleted successfully!', 'success');
    },
    onError: (error) => {
      showNotification(`Error deleting position: ${error.message}`, 'error');
    }
  });

  const allocateMutation = useMutation<any, Error, { positionId: string; resourceId: string; existingAllocationId?: string }>({
    mutationFn: async ({ positionId, resourceId, existingAllocationId }) => {
      // First, remove any existing allocation for this position
      if (existingAllocationId) {
        await deleteAllocation(existingAllocationId);
      }
      
      // Find the position and resource
      const position = positions.find(p => p.ID === positionId);
      const resource = resources.find(r => r.ID === resourceId);
      
      if (!position || !resource) {
        throw new Error('Position or resource not found');
      }
      
      // Convert LoE to percentage if position is in days mode
      let percentageLoE = position.LoE || 0;
      const normalizedMode = position?.AllocationMode?.toLowerCase()?.trim();
      const isDaysMode = normalizedMode === 'days' || normalizedMode === 'day';
      
      // If position is in days mode, convert to percentage (20 days = 100%)
      if (isDaysMode) {
        percentageLoE = Math.round((position.LoE / 20) * 100);
      }
      
      // Create allocation with converted percentage value and PositionID
      const allocationData = {
        PositionID: position.ID, // Always include PositionID for precise lookup
        ProjectName: position.ProjectName || '',
        PositionName: position.PositionName,
        ResourceName: resource.Name,
        MonthYear: position.MonthYear,
        AllocationMode: '%', // Always store as percentage mode
        LoE: percentageLoE, // Store as percentage
      };
      
      const result = await createAllocation(allocationData);
      
      // Update the position's Allocated status to 'Yes'
      await updatePosition(positionId, { Allocated: 'Yes' });
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positionsCombined'] });
      showNotification('Position allocated successfully!', 'success');
    },
    onError: (error) => {
      showNotification(`Error allocating position: ${error.message}`, 'error');
    }
  });

  const deallocateMutation = useMutation<any, Error, { positionId: string; allocationId: string }>({
    mutationFn: async ({ allocationId, positionId }) => {
      // Delete the allocation
      await deleteAllocation(allocationId);
      
      // Update the position's Allocated status to 'No'
      if (positionId) {
        await updatePosition(positionId, { Allocated: 'No' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positionsCombined'] });
      showNotification('Position deallocated successfully!', 'success');
    },
    onError: (error) => {
      showNotification(`Error deallocating position: ${error.message}`, 'error');
    }
  });

  const [newPosition, setNewPosition] = useState<Partial<Position>>({
    Project: '',
    TaskID: '',
    PositionName: '',
    MonthYear: '',
    AllocationMode: '',
    LoE: 0,
    Allocated: 'No',
  });

  const positions = positionsData ?? [];
  const projects = projectsData ?? [];
  const resources = resourcesData ?? [];
  const allocations = allocationsData ?? [];

  // OPTIMIZATION: Memoized allocation lookup maps for O(1) access instead of O(n)
  const allocationsByPositionId = useMemo(() => {
    const map = new Map<string, Allocation>();
    allocations.forEach(a => map.set(a.PositionID, a));
    return map;
  }, [allocations]);

  const allocatedPositionIds = useMemo(() => {
    return new Set(allocations.map(a => a.PositionID));
  }, [allocations]);

  // OPTIMIZATION: Pre-compute valid resources by month to avoid repeated date calculations
  const validResourcesByMonth = useMemo(() => {
    const map = new Map<string, Resource[]>();
    const uniqueMonths = new Set(positions.map(p => p.MonthYear).filter(Boolean));
    
    uniqueMonths.forEach(monthStr => {
      const positionMonth = new Date(monthStr!);
      const positionMonthStart = new Date(positionMonth.getFullYear(), positionMonth.getMonth(), 1);
      const positionMonthEnd = new Date(positionMonth.getFullYear(), positionMonth.getMonth() + 1, 0);
      
      const validResources = resources.filter(resource => {
        const resourceStart = new Date(resource.StartDate);
        const resourceEnd = resource.EndDate ? new Date(resource.EndDate) : null;
        
        return (
          isWithinInterval(positionMonthStart, { start: resourceStart, end: resourceEnd || new Date('2099-12-31') }) ||
          isWithinInterval(positionMonthEnd, { start: resourceStart, end: resourceEnd || new Date('2099-12-31') }) ||
          (isBefore(resourceStart, positionMonthStart) && (!resourceEnd || isAfter(resourceEnd, positionMonthEnd)))
        );
      });
      
      map.set(monthStr!, validResources);
    });
    
    return map;
  }, [positions, resources]);

  // OPTIMIZATION: Resources lookup map for O(1) access
  const resourcesById = useMemo(() => {
    const map = new Map<string, Resource>();
    resources.forEach(r => map.set(r.ID, r));
    return map;
  }, [resources]);

  // Validation state - only runs when manually triggered or on first load
  const [hasValidated, setHasValidated] = useState(false);

  // Validate position allocations - runs once on initial load
  useEffect(() => {
    const runValidation = async () => {
      if (hasValidated) return; // Skip if already validated this session
      
      try {
        console.log('Running position allocation validation...');
        const result = await validatePositionAllocations();
        
        if (result.changesCount > 0) {
          console.log('Position allocation validation made changes:', result);
          queryClient.invalidateQueries({ queryKey: ['positionsCombined'] });
        } else {
          console.log('Position allocation validation: no changes needed');
        }
        setHasValidated(true);
      } catch (error) {
        console.error('Position allocation validation failed:', error);
      }
    };

    // Run validation only once when positions data is first loaded
    if (positionsData && positionsData.length >= 0 && !hasValidated) {
      runValidation();
    }
  }, [positionsData, hasValidated, queryClient]);

  // OPTIMIZATION: Lowercase search term once, not per position
  const searchTermLower = useMemo(() => searchTerm.toLowerCase(), [searchTerm]);

  // OPTIMIZATION: Pre-compute date range boundaries once
  const dateRangeBounds = useMemo(() => ({
    start: startDate,
    end: endDate
  }), [startDate, endDate]);

  // Filter positions based on search and status - uses optimized lookups
  const filteredPositions = useMemo(() => {
    return positions
      .filter(position => {
        const matchesSearch = position.PositionName.toLowerCase().includes(searchTermLower) ||
                             position.TaskID.toLowerCase().includes(searchTermLower) ||
                             (position.ProjectName?.toLowerCase().includes(searchTermLower));
        
        const matchesProject = filterProject === 'all' || position.Project === filterProject;
        
        // Check if position's month is within the selected range
        const matchesMonthRange = !position.MonthYear || isWithinInterval(
          new Date(position.MonthYear),
          dateRangeBounds
        );
        
        // OPTIMIZATION: O(1) lookup instead of O(n) allocations.some()
        const hasAllocation = allocatedPositionIds.has(position.ID);
        
        switch (filterStatus) {
          case 'allocated':
            return matchesSearch && matchesProject && matchesMonthRange && hasAllocation;
          case 'unallocated':
            return matchesSearch && matchesProject && matchesMonthRange && !hasAllocation;
          default:
            return matchesSearch && matchesProject && matchesMonthRange;
        }
      })
      .sort((a, b) => {
        // Sort by MonthYear, latest first
        const dateA = a.MonthYear ? new Date(a.MonthYear).getTime() : 0;
        const dateB = b.MonthYear ? new Date(b.MonthYear).getTime() : 0;
        return dateB - dateA; // Descending order (latest first)
      });
  }, [positions, searchTermLower, filterStatus, filterProject, allocatedPositionIds, dateRangeBounds]);

  const handleCreate = () => {
    if (!newPosition.Project || !newPosition.TaskID || !newPosition.PositionName || !newPosition.MonthYear) {
      showNotification('Please fill in all required fields!', 'error');
      return;
    }
    createMutation.mutate(newPosition);
    setNewPosition({
      Project: '',
      TaskID: '',
      PositionName: '',
      MonthYear: '',
      AllocationMode: '',
      LoE: 0,
      Allocated: 'No',
    });
  };

  const handleProjectChange = (projectId: string) => {
    const selectedProject = projects.find(p => p.ID === projectId);
    const allocationMode = selectedProject?.AllocationMode || '';
    setNewPosition({ ...newPosition, Project: projectId, AllocationMode: allocationMode });
  };

  const handleMonthChange = (date: Date | null) => {
    if (date) {
      // Use the exact date selected, don't adjust to first day of month
      const isoString = date.toISOString().split('T')[0];
      setNewPosition({ ...newPosition, MonthYear: isoString });
    }
  };

  // Generate month columns for the table view
  const getMonthColumns = () => {
    const months: string[] = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    // Generate months for current year and next year
    for (let year = currentYear; year <= currentYear + 1; year++) {
      for (let month = 0; month < 12; month++) {
        const date = new Date(year, month, 1);
        months.push(format(date, 'MMM yyyy'));
      }
    }
    return months;
  };

  // Download positions as CSV in table format
  const downloadPositionsTable = () => {
    const monthColumns = getMonthColumns();
    const uniquePositions = Array.from(new Set(positions.map(p => `${p.ProjectName || p.Project}|${p.TaskID}|${p.PositionName}|${p.Allocated}`)))
      .map(key => {
        const [project, taskId, positionName, allocated] = key.split('|');
        return { project, taskId, positionName, allocated };
      });

    // Create CSV content
    let csvContent = 'Project,Task ID,Position Name,Allocated';
    monthColumns.forEach(month => {
      csvContent += `,${month}`;
    });
    csvContent += '\n';

    uniquePositions.forEach(({ project, taskId, positionName, allocated }) => {
      let row = `"${project}","${taskId}","${positionName}","${allocated}"`;
      
      monthColumns.forEach(month => {
        const position = positions.find(p => 
          (p.ProjectName || p.Project) === project &&
          p.TaskID === taskId &&
          p.PositionName === positionName &&
          p.Allocated === allocated &&
          p.MonthYear && format(new Date(p.MonthYear), 'MMM yyyy') === month
        );
        row += `,${position ? position.LoE || 0 : 0}`;
      });
      
      csvContent += row + '\n';
    });

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `positions_table_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showNotification('Positions table downloaded successfully!', 'success');
  };

  // Handle file upload for positions
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      
      if (lines.length < 2) {
        showNotification('Invalid file format', 'error');
        return;
      }

      const monthColumns = lines[0].split(',').slice(4); // Skip first 4 columns
      const monthMap = new Map<string, string>();
      
      monthColumns.forEach((month, index) => {
        monthMap.set(month.trim(), String(index));
      });

      const newPositions: Partial<Position>[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
        if (!values || values.length < 4) continue;
        
        const project = values[0].replace(/"/g, '').trim();
        const taskId = values[1].replace(/"/g, '').trim();
        const positionName = values[2].replace(/"/g, '').trim();
        const allocated = values[3].replace(/"/g, '').trim();
        
        // Find project ID
        const projectObj = projects.find(p => p.Name === project);
        if (!projectObj) continue;
        
        // Process LoE values for each month
        for (let j = 4; j < values.length && j - 4 < monthColumns.length; j++) {
          const loeValue = parseFloat(values[j].replace(/"/g, '').trim()) || 0;
          
          if (loeValue > 0) {
            const monthColumn = monthColumns[j - 4];
            // Convert month name back to date
            const date = new Date(monthColumn + ' 1');
            const isoString = date.toISOString().split('T')[0];
            
            newPositions.push({
              Project: projectObj.ID,
              TaskID: taskId,
              PositionName: positionName,
              MonthYear: isoString,
              AllocationMode: projectObj.AllocationMode || '%',
              LoE: loeValue,
              Allocated: allocated
            });
          }
        }
      }

      // Create positions in batch
      if (newPositions.length > 0) {
        Promise.all(newPositions.map(np => createMutation.mutateAsync(np)))
          .then(() => {
            showNotification(`Successfully uploaded ${newPositions.length} positions!`, 'success');
          })
          .catch((error) => {
            showNotification(`Error uploading positions: ${error.message}`, 'error');
          });
      } else {
        showNotification('No valid positions found in file', 'error');
      }
    };
    
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 2, backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
        {/* Compact Header */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold', color: '#333' }}>
            Positions
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              onClick={downloadPositionsTable}
              disabled={positions.length === 0}
            >
              Download Table
            </Button>
            <Button
              variant="outlined"
              size="small"
              component="label"
              startIcon={<UploadIcon />}
            >
              Upload Table
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </Button>
            <Chip 
              label={`${filteredPositions.length}/${positions.length}`} 
              color="primary" 
              variant="outlined" 
              size="small"
            />
          </Box>
        </Box>

        {/* Compact Add Position Form */}
        <Card sx={{ mb: 2, boxShadow: 1 }}>
          <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 1, display: 'block', color: '#666' }}>
              ADD NEW POSITION
            </Typography>
            
            {/* Header Row */}
            <Box sx={{ display: 'flex', gap: 1, mb: 0.5, alignItems: 'center' }}>
              <Box sx={{ flex: '0 1 150px', minWidth: '150px' }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>PROJECT *</Typography>
              </Box>
              <Box sx={{ flex: '0 1 100px', minWidth: '100px' }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>TASK ID *</Typography>
              </Box>
              <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>POSITION *</Typography>
              </Box>
              <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>MONTH *</Typography>
              </Box>
              <Box sx={{ flex: '0 1 80px', minWidth: '80px' }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>MODE</Typography>
              </Box>
              <Box sx={{ flex: '0 1 70px', minWidth: '70px' }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>LoE</Typography>
              </Box>
              <Box sx={{ flex: '0 1 80px', minWidth: '80px' }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>ALLOCATED</Typography>
              </Box>
              <Box sx={{ flex: '0 1 60px', minWidth: '60px' }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>ACTION</Typography>
              </Box>
            </Box>
            
            {/* Input Row */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <Box sx={{ flex: '0 1 150px', minWidth: '150px' }}>
                <FormControl fullWidth size="small">
                  <Select
                    value={newPosition.Project || ''}
                    displayEmpty
                    onChange={(e) => handleProjectChange(e.target.value)}
                    renderValue={(value) => {
                      if (!value) return <em style={{ fontSize: '0.75rem' }}>Select project</em>;
                      const project = projects.find(p => p.ID === value);
                      return <span style={{ fontSize: '0.75rem' }}>{project?.Name || value}</span>;
                    }}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    <MenuItem value=""><em style={{ fontSize: '0.75rem' }}>Select project</em></MenuItem>
                    {projects.map((project) => (
                      <MenuItem key={project.ID} value={project.ID} sx={{ fontSize: '0.75rem' }}>
                        {project.Name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ flex: '0 1 100px', minWidth: '100px' }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Task ID"
                  value={newPosition.TaskID || ''}
                  onChange={(e) => setNewPosition({ ...newPosition, TaskID: e.target.value })}
                  sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
                />
              </Box>
              <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Position name"
                  value={newPosition.PositionName || ''}
                  onChange={(e) => setNewPosition({ ...newPosition, PositionName: e.target.value })}
                  sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
                />
              </Box>
              <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
                <DatePicker
                  value={newPosition.MonthYear ? new Date(newPosition.MonthYear) : null}
                  onChange={(date) => handleMonthChange(date)}
                  views={['year', 'month']}
                  slotProps={{
                    textField: {
                      size: 'small',
                      placeholder: 'Month',
                      sx: { '& .MuiInputBase-input': { fontSize: '0.75rem' } }
                    }
                  }}
                />
              </Box>
              <Box sx={{ flex: '0 1 80px', minWidth: '80px' }}>
                <TextField
                  fullWidth
                  size="small"
                  value={newPosition.AllocationMode || ''}
                  disabled
                  placeholder="Auto"
                  sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
                />
              </Box>
              <Box sx={{ flex: '0 1 70px', minWidth: '70px' }}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  placeholder="0"
                  value={newPosition.LoE || ''}
                  onChange={(e) => setNewPosition({ ...newPosition, LoE: parseFloat(e.target.value) || 0 })}
                  sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
                />
              </Box>
              <Box sx={{ flex: '0 1 80px', minWidth: '80px' }}>
                <FormControl fullWidth size="small">
                  <Select
                    value={newPosition.Allocated || 'No'}
                    onChange={(e) => setNewPosition({ ...newPosition, Allocated: e.target.value })}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    <MenuItem value="Yes" sx={{ fontSize: '0.75rem' }}>Yes</MenuItem>
                    <MenuItem value="No" sx={{ fontSize: '0.75rem' }}>No</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ flex: '0 1 60px', minWidth: '60px' }}>
                <Button 
                  variant="contained" 
                  fullWidth
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  startIcon={<AddIcon />}
                  size="small"
                  sx={{ fontSize: '0.75rem', minHeight: '32px' }}
                >
                  Add
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Compact Positions Table */}
        <Card sx={{ boxShadow: 1 }}>
          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
            {/* Filters */}
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', backgroundColor: '#fafafa' }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search positions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>
                <Box sx={{ flex: '0 1 150px', minWidth: '150px' }}>
                  <FormControl fullWidth size="small">
                    <Select
                      value={filterProject}
                      onChange={(e) => setFilterProject(e.target.value)}
                      startAdornment={
                        <InputAdornment position="start">
                          <FilterIcon />
                        </InputAdornment>
                      }
                    >
                      <MenuItem value="all">All Projects</MenuItem>
                      {projects.map((project) => (
                        <MenuItem key={project.ID} value={project.ID}>{project.Name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ flex: '0 1 150px', minWidth: '150px' }}>
                  <FormControl fullWidth size="small">
                    <Select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as 'all' | 'allocated' | 'unallocated')}
                    >
                      <MenuItem value="all">All Positions</MenuItem>
                      <MenuItem value="allocated">Allocated</MenuItem>
                      <MenuItem value="unallocated">Unallocated</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ flex: '0 1 150px', minWidth: '150px' }}>
                  <DatePicker
                    label="From Date"
                    value={startDate}
                    onChange={(date) => date && setStartDate(date)}
                    views={['year', 'month']}
                    slotProps={{
                      textField: {
                        size: 'small',
                        sx: { fontSize: '0.75rem' }
                      }
                    }}
                  />
                </Box>
                <Box sx={{ flex: '0 1 150px', minWidth: '150px' }}>
                  <DatePicker
                    label="To Date"
                    value={endDate}
                    onChange={(date) => date && setEndDate(date)}
                    views={['year', 'month']}
                    slotProps={{
                      textField: {
                        size: 'small',
                        sx: { fontSize: '0.75rem' }
                      }
                    }}
                  />
                </Box>
                <Box sx={{ flex: '0 1 auto' }}>
                  <Typography variant="body2" color="text.secondary">
                    {filteredPositions.length} of {positions.length} positions
                  </Typography>
                </Box>
              </Box>
            </Box>

            <TableContainer sx={{ maxHeight: '60vh' }}>
              <Table size="small" stickyHeader sx={{ '& .MuiTableCell-root': { py: 0.5 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5 }}>Project</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5 }}>Task ID</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5 }}>Position</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5 }}>Month</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5 }}>Mode</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5 }}>LoE</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5 }}>Allocated</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5 }}>Resource</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5, textAlign: 'center' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredPositions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          {positions.length === 0 ? 'No positions found. Create your first position above!' : 'No positions match your filters.'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPositions.map((position) => (
                      <TableRow key={position.ID} hover sx={{ '&:hover': { backgroundColor: '#f8f9fa' } }}>
                        <TableCell sx={{ p: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                            {position.ProjectName || position.Project}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ p: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                            {position.TaskID}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ p: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                            {position.PositionName}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ p: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                            {position.MonthYear ? format(new Date(position.MonthYear), 'MMM yyyy') : 'No month'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ p: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                            {position.AllocationMode || 'Auto'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ p: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                            {position.LoE || 0}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ p: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                            {/* OPTIMIZATION: O(1) lookup instead of O(n) */}
                            {allocatedPositionIds.has(position.ID) ? 'Yes' : 'No'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ p: 0.5 }}>
                          <FormControl fullWidth size="small">
                            <Select
                              value={allocationsByPositionId.get(position.ID)?.ResourceID || ""}
                              displayEmpty
                              onChange={(e) => {
                                const currentAllocation = allocationsByPositionId.get(position.ID);
                                
                                if (e.target.value === "") {
                                  // Deallocate if empty value selected
                                  if (currentAllocation) {
                                    deallocateMutation.mutate({
                                      positionId: position.ID,
                                      allocationId: currentAllocation.ID
                                    });
                                  }
                                } else {
                                  // Allocate to new resource (will automatically remove existing allocation)
                                  allocateMutation.mutate({
                                    positionId: position.ID,
                                    resourceId: e.target.value,
                                    existingAllocationId: currentAllocation?.ID
                                  });
                                }
                              }}
                              renderValue={(value) => {
                                if (!value) {
                                  return <span style={{ fontSize: '0.75rem' }}>Select resource</span>;
                                }
                                // OPTIMIZATION: O(1) lookup instead of O(n)
                                const resource = resourcesById.get(value);
                                return <span style={{ fontSize: '0.75rem' }}>{resource?.Name || value}</span>;
                              }}
                              sx={{ fontSize: '0.75rem' }}
                            >
                              <MenuItem value="">
                                <em style={{ fontSize: '0.75rem' }}>Clear allocation</em>
                              </MenuItem>
                              {/* OPTIMIZATION: Pre-computed valid resources by month */}
                              {(position.MonthYear ? validResourcesByMonth.get(position.MonthYear) || [] : [])
                                .map((resource) => (
                                  <MenuItem key={resource.ID} value={resource.ID} sx={{ fontSize: '0.75rem' }}>
                                    {resource.Name}
                                  </MenuItem>
                                ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell sx={{ p: 0.5, textAlign: 'center' }}>
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                            <IconButton 
                              size="small" 
                              color="primary" 
                              onClick={() => setEditingPosition(position)}
                              disabled={updateMutation.isPending}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton 
                              size="small" 
                              color="error" 
                              onClick={() => deleteMutation.mutate(position.ID)}
                              disabled={deleteMutation.isPending}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Notification Snackbar */}
        <Snackbar
          open={notification.open}
          autoHideDuration={4000}
          onClose={() => setNotification({ ...notification, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert 
            onClose={() => setNotification({ ...notification, open: false })} 
            severity={notification.severity}
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>

        {/* Edit Position Dialog */}
        <Dialog 
          open={!!editingPosition} 
          onClose={() => setEditingPosition(null)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Edit Position</DialogTitle>
          <DialogContent>
            {editingPosition && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                <FormControl fullWidth>
                  <Select
                    value={editingPosition.Project || ''}
                    onChange={(e) => {
                      const selectedProject = projects.find(p => p.ID === e.target.value);
                      const allocationMode = selectedProject?.AllocationMode || '';
                      updateMutation.mutate({ 
                        id: editingPosition.ID, 
                        payload: { Project: String(e.target.value), AllocationMode: allocationMode } 
                      });
                    }}
                  >
                    <MenuItem value="">Select Project</MenuItem>
                    {projects.map((project) => (
                      <MenuItem key={project.ID} value={project.ID}>{project.Name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Task ID"
                  fullWidth
                  defaultValue={editingPosition.TaskID}
                  onBlur={(e) => {
                    if (e.target.value !== editingPosition.TaskID) {
                      updateMutation.mutate({ id: editingPosition.ID, payload: { TaskID: e.target.value } });
                    }
                  }}
                />
                <TextField
                  label="Position Name"
                  fullWidth
                  defaultValue={editingPosition.PositionName}
                  onBlur={(e) => {
                    if (e.target.value !== editingPosition.PositionName) {
                      updateMutation.mutate({ id: editingPosition.ID, payload: { PositionName: e.target.value } });
                    }
                  }}
                />
                <DatePicker
                  label="Month"
                  value={editingPosition.MonthYear ? new Date(editingPosition.MonthYear) : null}
                  onChange={(date) => {
                    if (date) {
                      // Use the exact date selected
                      const isoString = date.toISOString().split('T')[0];
                      updateMutation.mutate({ id: editingPosition.ID, payload: { MonthYear: isoString } });
                    }
                  }}
                  views={['year', 'month']}
                />
                <TextField
                  label="LoE"
                  type="number"
                  fullWidth
                  defaultValue={editingPosition.LoE || 0}
                  onBlur={(e) => {
                    const newLoE = parseFloat(e.target.value) || 0;
                    if (newLoE !== (editingPosition.LoE || 0)) {
                      updateMutation.mutate({ id: editingPosition.ID, payload: { LoE: newLoE } });
                    }
                  }}
                />
                <FormControl fullWidth>
                  <Select
                    value={editingPosition.Allocated || 'No'}
                    onChange={(e) => {
                      updateMutation.mutate({ id: editingPosition.ID, payload: { Allocated: String(e.target.value) } });
                    }}
                  >
                    <MenuItem value="Yes">Yes</MenuItem>
                    <MenuItem value="No">No</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditingPosition(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
}
