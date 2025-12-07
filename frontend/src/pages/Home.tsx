import React, { useState } from 'react';
import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent, TextField, Button, Typography, FormControl, Select, MenuItem, InputAdornment, Chip } from '@mui/material';
import { FilterList as FilterIcon } from '@mui/icons-material';
import { addMonths, format, isAfter, isBefore, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getResources, getPositions, createAllocation, getAllocations, deleteAllocation } from '../services/staloService';
import type { Resource } from '../types';
import type { Position } from '../types';
import type { Allocation } from '../types';
import type { AllocationFormData } from '../types';

interface HomeProps {
  selectedDate: Date;
}

interface MonthlyAllocationDialog {
  open: boolean;
  monthIndex: number;
  monthYear: string;
}

export default function Home({ selectedDate }: HomeProps) {
  const queryClient = useQueryClient();
  const months = Array.from({ length: 12 }, (_, i) => addMonths(selectedDate, i));

  // Display mode state: 'percentage' or 'days'
  const [displayMode, setDisplayMode] = useState<'percentage' | 'days'>('percentage');

  // Conversion function: percentage to days (100% = 20 days)
  const percentageToDays = (percentage: number): number => {
    return Math.round((percentage / 100) * 20);
  };

  // Format value based on display mode and allocation mode
  const formatValue = (loe: number, allocationMode: string): string => {
    // Normalize allocation mode - handle various possible values
    const normalizedMode = allocationMode?.toLowerCase()?.trim();
    const isDaysMode = normalizedMode === 'days' || normalizedMode === 'day';
    
    if (isDaysMode) {
      // If allocation mode is days, LoE is already in days
      if (displayMode === 'days') {
        return `${loe}d`;
      } else {
        // Convert days to percentage (20 days = 100%)
        const percentage = Math.round((loe / 20) * 100);
        return `${percentage}%`;
      }
    } else {
      // If allocation mode is percentage, LoE is in percentage
      if (displayMode === 'days') {
        return `${percentageToDays(loe)}d`;
      } else {
        return `${loe}%`;
      }
    }
  };

  // Convert LoE to display value based on allocation mode
  const convertToDisplayValue = (loe: number, allocationMode: string): number => {
    // Normalize allocation mode - handle various possible values
    const normalizedMode = allocationMode?.toLowerCase()?.trim();
    const isDaysMode = normalizedMode === 'days' || normalizedMode === 'day';
    
    if (isDaysMode) {
      if (displayMode === 'days') {
        return loe; // Already in days
      } else {
        return Math.round((loe / 20) * 100); // Convert days to percentage
      }
    } else {
      if (displayMode === 'days') {
        return percentageToDays(loe); // Convert percentage to days
      } else {
        return loe; // Already in percentage
      }
    }
  };

  // Get color coding based on allocation mode and display mode
  const getBackgroundColor = (loe: number, allocationMode: string): string => {
    const displayValue = convertToDisplayValue(loe, allocationMode);
    
    if (displayMode === 'days') {
      // Days mode thresholds (18-22 days = optimal, 20 days = 100% equivalent)
      if (displayValue >= 18 && displayValue <= 22) {
        return '#4caf50'; // green
      } else if (displayValue < 18) {
        return '#ffeb3b'; // pale yellow
      } else {
        return '#ffcdd2'; // pale red
      }
    } else {
      // Percentage mode thresholds (90-110% = optimal)
      if (displayValue >= 90 && displayValue <= 110) {
        return '#4caf50'; // green
      } else if (displayValue < 90) {
        return '#ffeb3b'; // pale yellow
      } else {
        return '#ffcdd2'; // pale red
      }
    }
  };

  const [allocationDialog, setAllocationDialog] = useState<{
    open: boolean;
    resourceId: string;
    monthIndex: number;
    monthYear: string;
  }>({
    open: false,
    resourceId: '',
    monthIndex: 0,
    monthYear: '',
  });

  const [monthlyAllocationDialog, setMonthlyAllocationDialog] = useState<MonthlyAllocationDialog>({
    open: false,
    monthIndex: 0,
    monthYear: '',
  });

  const [allocationData, setAllocationData] = useState<AllocationFormData>({
    ProjectName: '',
    ResourceName: '',
    PositionName: '',
    MonthYear: '',
    AllocationMode: '',
    LoE: 0,
  });

  const { data: resourcesData, isLoading } = useQuery<Resource[], Error>({
    queryKey: ['resources'],
    queryFn: getResources,
    staleTime: 1000 * 60 * 5
  });

  const { data: positionsData } = useQuery<Position[], Error>({
    queryKey: ['positions'],
    queryFn: getPositions,
    staleTime: 1000 * 60 * 5
  });

  const { data: allocationsData } = useQuery<Allocation[], Error>({
    queryKey: ['allocations'],
    queryFn: getAllocations,
    staleTime: 1000 * 60 * 5
  });

  const createAllocationMutation = useMutation<Allocation, Error, AllocationFormData>({
    mutationFn: createAllocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      setAllocationDialog({ open: false, resourceId: '', monthIndex: 0, monthYear: '' });
      setAllocationData({
        ProjectName: '',
        ResourceName: '',
        PositionName: '',
        MonthYear: '',
        AllocationMode: '',
        LoE: 0,
      });
    },
  });

  const deleteAllocationMutation = useMutation<void, Error, string>({
    mutationFn: deleteAllocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      setAllocationDialog({ open: false, resourceId: '', monthIndex: 0, monthYear: '' });
      setAllocationData({
        ProjectName: '',
        ResourceName: '',
        PositionName: '',
        MonthYear: '',
        AllocationMode: '',
        LoE: 0,
      });
    },
  });

  const resources = resourcesData ?? [];
  const positions = positionsData ?? [];
  const allocations = allocationsData ?? [];

  // Handle month click for monthly allocation view
  const handleMonthClick = (monthIndex: number) => {
    const month = months[monthIndex];
    const monthYear = format(month, 'MMMM yyyy');
    
    setMonthlyAllocationDialog({
      open: true,
      monthIndex,
      monthYear,
    });
  };

  // Handle cell click
  const handleCellClick = (resourceId: string, monthIndex: number) => {
    const month = months[monthIndex];
    const monthYear = format(month, 'MMMM yyyy');
    
    // Always reset allocation data first
    const resetData = {
      ProjectName: '',
      ResourceName: resources.find(r => r.ID === resourceId)?.Name || '',
      PositionName: '',
      MonthYear: format(month, 'yyyy-MM-dd'),
      AllocationMode: '',
      LoE: 0,
    };
    
    // Use reset data for creating new allocation (even if existing ones exist)
    setAllocationData(resetData);
    
    setAllocationDialog({
      open: true,
      resourceId,
      monthIndex,
      monthYear,
    });
  };

  // Handle position selection
  const handlePositionSelect = (position: Position) => {
    setAllocationData({
      ProjectName: position.ProjectName || '',
      ResourceName: allocationData.ResourceName,
      PositionName: position.PositionName,
      MonthYear: position.MonthYear, // Use the position's actual MonthYear
      AllocationMode: position.AllocationMode,
      LoE: position.LoE,
    });
  };

  // Handle allocation creation
  const handleCreateAllocation = () => {
    const selectedPosition = positions.find(p => 
      p.PositionName === allocationData.PositionName && 
      p.Allocated === 'No'
    );
    
    if (!selectedPosition) {
      alert('Please select a valid position');
      return;
    }

    createAllocationMutation.mutate(allocationData);
  };

  // Filter resources based on date range overlap with displayed months
  const filteredResources = resources.filter(resource => {
    if (!resource.StartDate) return false;
    
    const resourceStart = new Date(resource.StartDate);
    const resourceEnd = resource.EndDate ? new Date(resource.EndDate) : null;
    const tableStart = startOfMonth(months[0]); // First month in table
    const tableEnd = endOfMonth(months[months.length - 1]); // Last month in table

    // Check if resource period overlaps with table period
    // If no end date, check if resource starts before or during table period
    return (
      isWithinInterval(resourceStart, { start: tableStart, end: tableEnd }) ||
      (resourceEnd && isWithinInterval(resourceEnd, { start: tableStart, end: tableEnd })) ||
      (isBefore(resourceStart, tableStart) && (!resourceEnd || isAfter(resourceEnd || new Date('2099-12-31'), tableEnd)))
    );
  });

  // Group filtered resources by department
  const resourcesByDepartment = filteredResources.reduce((acc, resource) => {
    const department = resource.Department || 'Unknown Department';
    if (!acc[department]) {
      acc[department] = [];
    }
    acc[department].push(resource);
    return acc;
  }, {} as Record<string, typeof filteredResources>);

  // Filter unallocated positions and group by month
  const unallocatedPositionsByMonth = months.map(month => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    
    return positions.filter(position => {
      if (!position.MonthYear || position.Allocated !== 'No') return false;
      
      const positionMonth = startOfMonth(new Date(position.MonthYear));
      return isWithinInterval(positionMonth, { start: monthStart, end: monthEnd });
    });
  });

  return (
    <Box sx={{ p: 4 }}>
      {/* Filter Controls */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" component="h2">
          Resource Allocation Table
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={displayMode}
              onChange={(e) => setDisplayMode(e.target.value as 'percentage' | 'days')}
              startAdornment={
                <InputAdornment position="start">
                  <FilterIcon />
                </InputAdornment>
              }
            >
              <MenuItem value="percentage">Show as %</MenuItem>
              <MenuItem value="days">Show as Days</MenuItem>
            </Select>
          </FormControl>
          <Chip 
            label={`${displayMode === 'percentage' ? 'Percentage' : 'Days'} View`} 
            color="primary" 
            variant="outlined" 
            size="small"
          />
        </Box>
      </Box>

      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '200px', minWidth: '200px' }}><strong>Name</strong></TableCell>
              {months.map((m, idx) => (
                <TableCell 
                  key={idx} 
                  align="center" 
                  sx={{ 
                    width: '100px', 
                    minWidth: '100px',
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: 'action.hover' },
                    textDecoration: 'underline'
                  }}
                  onClick={() => handleMonthClick(idx)}
                >
                  <strong>{format(m, 'MMM yyyy')}</strong>
                </TableCell>
              ))}
            </TableRow>
            
            {/* Unallocated positions row */}
            <TableRow>
              <TableCell component="th" scope="row" sx={{ width: '200px', minWidth: '200px' }}><strong>Unallocated</strong></TableCell>
              {months.map((_, i) => (
                <TableCell key={i} align="center" sx={{ p: 0.25, width: '100px', minWidth: '100px' }}>
                  {unallocatedPositionsByMonth[i].length > 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2, maxHeight: '100px', overflowY: 'auto' }}>
                      {unallocatedPositionsByMonth[i].map((position) => (
                        <Box 
                          key={position.ID} 
                          sx={{ 
                            backgroundColor: '#e3f2fd',
                            p: 0.3,
                            borderRadius: 0.5,
                            fontSize: '0.65rem',
                            fontWeight: 'bold',
                            lineHeight: 1.1,
                            whiteSpace: 'normal',
                            wordBreak: 'break-word'
                          }}
                        >
                          {position.ProjectName} - {position.PositionName} - {formatValue(position.LoE, position.AllocationMode || '%')}
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    '-'
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(resourcesByDepartment).map(([department, departmentResources]) => (
              <React.Fragment key={department}>
                {/* Department header row */}
                <TableRow>
                  <TableCell 
                    colSpan={13} 
                    sx={{ 
                      backgroundColor: 'grey.100', 
                      fontWeight: 'bold',
                      fontSize: '0.9rem',
                      p: 1
                    }}
                  >
                    {department}
                  </TableCell>
                </TableRow>
                
                {/* Resources in this department */}
                {departmentResources.map((resource) => (
                  <TableRow key={resource.ID} hover>
                    <TableCell component="th" scope="row" sx={{ pl: 3, width: '200px', minWidth: '200px', fontSize: '0.8rem' }}>
                      {resource.Name}
                    </TableCell>
                    {months.map((month, i) => {
                      const monthStart = startOfMonth(month);
                      const monthEnd = endOfMonth(month);
                      const resourceStart = new Date(resource.StartDate);
                      const resourceEnd = resource.EndDate ? new Date(resource.EndDate) : null;
                      
                      // Show if resource is active during this month
                      // If no end date, show for all months after start date
                      const isActive = isWithinInterval(monthStart, { start: resourceStart, end: resourceEnd || new Date('2099-12-31') }) ||
                                      isWithinInterval(monthEnd, { start: resourceStart, end: resourceEnd || new Date('2099-12-31') }) ||
                                      (isBefore(resourceStart, monthStart) && (!resourceEnd || isAfter(resourceEnd || new Date('2099-12-31'), monthEnd)));
                      
                      return (
                        <TableCell 
                          key={i} 
                          align="center"
                          onClick={() => isActive && handleCellClick(resource.ID, i)}
                          sx={{ 
                            cursor: isActive ? 'pointer' : 'default',
                            backgroundColor: isActive ? 'action.hover' : 'inherit',
                            '&:hover': isActive ? { backgroundColor: 'action.selected' } : {},
                            p: 0.15, // Further reduce padding
                            width: '100px',
                            minWidth: '100px',
                            height: '16px', // Reduce height from 20px to 16px
                            position: 'relative',
                            overflow: 'hidden'
                          }}
                        >
                          {(() => {
                            // Check if there are allocations for this resource and month
                            const month = months[i];
                            const monthStart = startOfMonth(month);
                            const monthEnd = endOfMonth(month);
                            
                            const cellAllocations = allocations.filter(a => 
                              a.ResourceID === resource.ID &&
                              (() => {
                                const allocationDate = new Date(a.MonthYear);
                                return isWithinInterval(allocationDate, { start: monthStart, end: monthEnd });
                              })()
                            );
                            
                            if (cellAllocations.length > 0) {
                              // Calculate total in the selected display mode (always convert everything)
                              let totalDisplayValue = 0;
                              
                              // Always convert all allocations to the selected display mode
                              cellAllocations.forEach(allocation => {
                                const position = positions.find(p => p.ID === allocation.PositionID);
                                const normalizedMode = position?.AllocationMode?.toLowerCase()?.trim();
                                const isDaysMode = normalizedMode === 'days' || normalizedMode === 'day';
                                
                                if (displayMode === 'days') {
                                  // Convert everything to days
                                  if (isDaysMode) {
                                    totalDisplayValue += allocation.LoE; // Already in days
                                  } else {
                                    totalDisplayValue += percentageToDays(allocation.LoE); // Convert % to days
                                  }
                                } else {
                                  // Convert everything to percentage
                                  if (isDaysMode) {
                                    totalDisplayValue += Math.round((allocation.LoE / 20) * 100); // Convert days to %
                                  } else {
                                    totalDisplayValue += allocation.LoE; // Already in %
                                  }
                                }
                              });
                              
                              const backgroundColor = getBackgroundColor(totalDisplayValue, displayMode === 'days' ? 'days' : '%');
                              
                              return (
                                <Box 
                                  sx={{ 
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    backgroundColor: 'rgba(0,0,0,0.1)',
                                    borderRadius: 0.5,
                                    overflow: 'hidden',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  <Box
                                    sx={{
                                      position: 'absolute',
                                      top: 0,
                                      left: 0,
                                      height: '100%',
                                      width: `${displayMode === 'days' 
    ? Math.min(100, Math.max(0, (totalDisplayValue / 20) * 100)) 
    : Math.min(100, Math.max(0, totalDisplayValue))}%`,
                                      backgroundColor,
                                      transition: 'width 0.3s ease',
                                      zIndex: 0
                                    }}
                                  />
                                  <Typography 
                                    variant="caption" 
                                    sx={{ 
                                      position: 'relative',
                                      fontSize: '0.5rem', // Increase from 0.45rem to 0.5rem
                                      fontWeight: 'bold',
                                      color: totalDisplayValue > (displayMode === 'days' ? 10 : 50) ? 'white' : 'text.primary',
                                      textShadow: totalDisplayValue > (displayMode === 'days' ? 10 : 50) ? '1px 1px 1px rgba(0,0,0,0.8)' : 'none',
                                      zIndex: 1,
                                      lineHeight: 1
                                    }}
                                  >
                                    {displayMode === 'days' ? `${totalDisplayValue}d` : `${totalDisplayValue}%`}
                                  </Typography>
                                </Box>
                              );
                            } else if (isActive) {
                              return (
                                <Box 
                                  sx={{ 
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    backgroundColor: 'rgba(0,0,0,0.05)',
                                    borderRadius: 0.5,
                                    overflow: 'hidden',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  <Typography 
                                    variant="caption" 
                                    sx={{ 
                                      position: 'relative',
                                      fontSize: '0.5rem', // Match the allocation cell font size
                                      color: 'text.secondary',
                                      zIndex: 1,
                                      lineHeight: 1
                                    }}
                                  >
                                    {displayMode === 'days' ? '0d' : '0%'}
                                  </Typography>
                                </Box>
                              );
                            } else {
                              return '-';
                            }
                          })()}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </React.Fragment>
            ))}

            {Object.keys(resourcesByDepartment).length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={13} align="center">No resources found for the displayed period</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Allocation Dialog */}
      <Dialog open={allocationDialog.open} onClose={() => setAllocationDialog({ ...allocationDialog, open: false })} maxWidth="sm" fullWidth sx={{ '& .MuiDialog-paper': { p: 2 } }}>
        <DialogTitle>Create Allocation - {allocationDialog.monthYear}</DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <TextField
              label="Project Name"
              value={allocationData.ProjectName}
              fullWidth
              disabled
              size="small"
            />
            <TextField
              label="Resource Name"
              value={allocationData.ResourceName}
              fullWidth
              disabled
              size="small"
            />
            <TextField
              label="Position Name"
              value={allocationData.PositionName}
              fullWidth
              disabled
              size="small"
            />
            <TextField
              label="Month Year"
              value={allocationDialog.monthYear}
              fullWidth
              disabled
              size="small"
            />
            <TextField
              label="Allocation Mode"
              value={allocationData.AllocationMode}
              fullWidth
              disabled
              size="small"
            />
            <TextField
              label="LoE"
              value={(() => {
                const position = positions.find(p => p.PositionName === allocationData.PositionName);
                const normalizedMode = position?.AllocationMode?.toLowerCase()?.trim();
                const isDaysMode = normalizedMode === 'days' || normalizedMode === 'day';
                
                if (isDaysMode) {
                  return `${allocationData.LoE} days${displayMode === 'percentage' ? ` (${Math.round((allocationData.LoE / 20) * 100)}%)` : ''}`;
                } else {
                  return `${allocationData.LoE}%${displayMode === 'days' ? ` (${percentageToDays(allocationData.LoE)} days)` : ''}`;
                }
              })()}
              fullWidth
              disabled
              size="small"
            />

            {/* Existing Allocations for the cell */}
            {(() => {
              const month = months[allocationDialog.monthIndex];
              const monthStart = startOfMonth(month);
              const monthEnd = endOfMonth(month);
              const existingAllocations = allocations.filter(a => 
                a.ResourceID === allocationDialog.resourceId &&
                (() => {
                  const allocationDate = new Date(a.MonthYear);
                  return isWithinInterval(allocationDate, { start: monthStart, end: monthEnd });
                })()
              );

              if (existingAllocations.length > 0) {
                return (
                  <>
                    <Typography variant="h6" sx={{ mt: 1, mb: 1 }}>
                      Existing Allocations for {allocationDialog.monthYear}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {existingAllocations.map((allocation) => (
                        <Box 
                          key={allocation.ID} 
                          sx={{ 
                            p: 1.5, 
                            border: 1, 
                            borderColor: 'divider', 
                            borderRadius: 1,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                              {allocation.PositionName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              LoE: {(() => {
                                const position = positions.find(p => p.ID === allocation.PositionID);
                                const normalizedMode = position?.AllocationMode?.toLowerCase()?.trim();
                                const isDaysMode = normalizedMode === 'days' || normalizedMode === 'day';
                                return formatValue(allocation.LoE, isDaysMode ? 'days' : '%');
                              })()} • {allocation.AllocationMode}
                            </Typography>
                          </Box>
                          <Button 
                            size="small" 
                            variant="outlined" 
                            color="error"
                            onClick={() => deleteAllocationMutation.mutate(allocation.ID)}
                          >
                            Remove
                          </Button>
                        </Box>
                      ))}
                    </Box>
                  </>
                );
              }
              return null;
            })()}

            {/* Unallocated Positions for the month */}
            {(() => {
              // Check if the resource is active for this month
              const resource = resources.find(r => r.ID === allocationDialog.resourceId);
              const month = months[allocationDialog.monthIndex];
              const monthStart = startOfMonth(month);
              const monthEnd = endOfMonth(month);
              const resourceStart = new Date(resource?.StartDate || '');
              const resourceEnd = resource?.EndDate ? new Date(resource.EndDate) : null;
              
              const isActive = resource && isWithinInterval(monthStart, { start: resourceStart, end: resourceEnd || new Date('2099-12-31') }) ||
                              isWithinInterval(monthEnd, { start: resourceStart, end: resourceEnd || new Date('2099-12-31') }) ||
                              (isBefore(resourceStart, monthStart) && (!resourceEnd || isAfter(resourceEnd || new Date('2099-12-31'), monthEnd)));

              // Only show unallocated positions if resource is active
              if (!isActive) {
                return (
                  <Typography color="text.secondary">
                    Resource is not active for {allocationDialog.monthYear}
                  </Typography>
                );
              }

              return (
                <>
                  <Typography variant="h6" sx={{ mt: 1, mb: 1 }}>
                    Unallocated Positions for {allocationDialog.monthYear}
                  </Typography>
                  {unallocatedPositionsByMonth[allocationDialog.monthIndex]?.length > 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {unallocatedPositionsByMonth[allocationDialog.monthIndex].map((position) => (
                        <Box 
                          key={position.ID} 
                          sx={{ 
                            p: 1.5, 
                            border: 1, 
                            borderColor: 'divider', 
                            borderRadius: 1,
                            cursor: 'pointer',
                            '&:hover': { backgroundColor: 'action.hover' },
                            transition: 'background-color 0.2s'
                          }}
                          onClick={() => handlePositionSelect(position)}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                            {position.PositionName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {position.ProjectName} • {position.AllocationMode} • LoE: {(() => {
                              const normalizedMode = position?.AllocationMode?.toLowerCase()?.trim();
                              const isDaysMode = normalizedMode === 'days' || normalizedMode === 'day';
                              return formatValue(position.LoE, isDaysMode ? 'days' : '%');
                            })()}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography color="text.secondary">No unallocated positions available for this month</Typography>
                  )}
                </>
              );
            })()}

            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button 
                variant="contained" 
                onClick={handleCreateAllocation}
                disabled={!allocationData.PositionName}
              >
                Apply Allocation
              </Button>
              <Button 
                variant="outlined" 
                onClick={() => setAllocationDialog({ ...allocationDialog, open: false })}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Monthly Allocation Dialog */}
      <Dialog 
        open={monthlyAllocationDialog.open} 
        onClose={() => setMonthlyAllocationDialog({ ...monthlyAllocationDialog, open: false })} 
        maxWidth="xl" 
        fullWidth
        sx={{ '& .MuiDialog-paper': { p: 2 } }}
      >
        <DialogTitle>Monthly Allocation View - {monthlyAllocationDialog.monthYear}</DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          <Box sx={{ maxHeight: '70vh', overflow: 'auto' }}>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: '150px', minWidth: '150px' }}><strong>Resource</strong></TableCell>
                    {(() => {
                      // Get unique projects for this month
                      const month = months[monthlyAllocationDialog.monthIndex];
                      const monthStart = startOfMonth(month);
                      const monthEnd = endOfMonth(month);
                      
                      const monthProjects = [...new Set(
                        allocations
                          .filter(a => {
                            const allocationDate = new Date(a.MonthYear);
                            return isWithinInterval(allocationDate, { start: monthStart, end: monthEnd });
                          })
                          .map(a => {
                            // Find the position to get the project name
                            const position = positions.find(p => p.ID === a.PositionID);
                            return position?.ProjectName || 'Unknown Project';
                          })
                      )];
                      
                      return monthProjects.map((project, idx) => (
                        <TableCell key={idx} align="center" sx={{ width: '120px', minWidth: '120px' }}>
                          <strong>{project}</strong>
                        </TableCell>
                      ));
                    })()}
                    <TableCell align="center" sx={{ width: '100px', minWidth: '100px' }}><strong>Total</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(resourcesByDepartment).map(([department, departmentResources]) => (
                    <React.Fragment key={department}>
                      {/* Department header row */}
                      <TableRow>
                        <TableCell 
                          colSpan={20} 
                          sx={{ 
                            backgroundColor: 'grey.100', 
                            fontWeight: 'bold',
                            fontSize: '0.9rem',
                            p: 1
                          }}
                        >
                          {department}
                        </TableCell>
                      </TableRow>
                      
                      {/* Resources in this department */}
                      {departmentResources.map((resource) => {
                        const month = months[monthlyAllocationDialog.monthIndex];
                        const monthStart = startOfMonth(month);
                        const monthEnd = endOfMonth(month);
                        
                        // Get allocations for this resource and month
                        const resourceAllocations = allocations.filter(a => 
                          a.ResourceID === resource.ID &&
                          (() => {
                            const allocationDate = new Date(a.MonthYear);
                            return isWithinInterval(allocationDate, { start: monthStart, end: monthEnd });
                          })()
                        );
                        
                        // Get unique projects for this month
                        const monthProjects = [...new Set(
                          allocations
                            .filter(a => {
                              const allocationDate = new Date(a.MonthYear);
                              return isWithinInterval(allocationDate, { start: monthStart, end: monthEnd });
                            })
                            .map(a => {
                              // Find the position to get the project name
                              const position = positions.find(p => p.ID === a.PositionID);
                              return position?.ProjectName || 'Unknown Project';
                            })
                        )];
                        
                        const totalLoE = resourceAllocations.reduce((sum, a) => sum + a.LoE, 0);
                        
                        return (
                          <TableRow key={resource.ID} hover>
                            <TableCell component="th" scope="row" sx={{ pl: 3 }}>
                              {resource.Name}
                            </TableCell>
                            {monthProjects.map((project) => {
                              // Find allocation for this resource and project
                              const allocation = resourceAllocations.find(a => {
                                const position = positions.find(p => p.ID === a.PositionID);
                                return position?.ProjectName === project;
                              });
                              return (
                                <TableCell key={project} align="center" sx={{ p: 0.5 }}>
                                  {allocation ? (
                                    <Box sx={{ 
                                      backgroundColor: '#e8f5e8', 
                                      p: 0.5, 
                                      borderRadius: 0.5,
                                      fontSize: '0.7rem',
                                      fontWeight: 'bold'
                                    }}>
                                      {(() => {
                                // Convert allocation to the selected display mode
                                const position = positions.find(p => p.ID === allocation.PositionID);
                                const normalizedMode = position?.AllocationMode?.toLowerCase()?.trim();
                                const isDaysMode = normalizedMode === 'days' || normalizedMode === 'day';
                                
                                let displayValue;
                                if (displayMode === 'days') {
                                  // Convert everything to days
                                  if (isDaysMode) {
                                    displayValue = allocation.LoE; // Already in days
                                  } else {
                                    displayValue = percentageToDays(allocation.LoE); // Convert % to days
                                  }
                                } else {
                                  // Convert everything to percentage
                                  if (isDaysMode) {
                                    displayValue = Math.round((allocation.LoE / 20) * 100); // Convert days to %
                                  } else {
                                    displayValue = allocation.LoE; // Already in %
                                  }
                                }
                                
                                return displayMode === 'days' ? `${displayValue}d` : `${displayValue}%`;
                              })()}
                                    </Box>
                                  ) : (
                                    '-'
                                  )}
                                </TableCell>
                              );
                            })}
                            <TableCell align="center" sx={{ p: 0.5 }}>
                              {totalLoE > 0 ? (
                                <Box sx={{ 
                                  backgroundColor: displayMode === 'days' 
                                    ? (percentageToDays(totalLoE) >= 18 && percentageToDays(totalLoE) <= 22 ? '#e8f5e8' : percentageToDays(totalLoE) > 22 ? '#ffebee' : '#fff3e0')
                                    : (totalLoE >= 90 && totalLoE <= 110 ? '#e8f5e8' : totalLoE > 110 ? '#ffebee' : '#fff3e0'),
                                  p: 0.5, 
                                  borderRadius: 0.5,
                                  fontSize: '0.7rem',
                                  fontWeight: 'bold'
                                }}>
                                  {(() => {
                                // Convert total to the selected display mode
                                let totalDisplayValue;
                                if (displayMode === 'days') {
                                  // Convert total to days
                                  totalDisplayValue = resourceAllocations.reduce((sum, a) => {
                                    const position = positions.find(p => p.ID === a.PositionID);
                                    const normalizedMode = position?.AllocationMode?.toLowerCase()?.trim();
                                    const isDaysMode = normalizedMode === 'days' || normalizedMode === 'day';
                                    
                                    if (isDaysMode) {
                                      return sum + a.LoE; // Already in days
                                    } else {
                                      return sum + percentageToDays(a.LoE); // Convert % to days
                                    }
                                  }, 0);
                                } else {
                                  // Convert total to percentage
                                  totalDisplayValue = resourceAllocations.reduce((sum, a) => {
                                    const position = positions.find(p => p.ID === a.PositionID);
                                    const normalizedMode = position?.AllocationMode?.toLowerCase()?.trim();
                                    const isDaysMode = normalizedMode === 'days' || normalizedMode === 'day';
                                    
                                    if (isDaysMode) {
                                      return sum + Math.round((a.LoE / 20) * 100); // Convert days to %
                                    } else {
                                      return sum + a.LoE; // Already in %
                                    }
                                  }, 0);
                                }
                                
                                return displayMode === 'days' ? `${totalDisplayValue}d` : `${totalDisplayValue}%`;
                              })()}
                                </Box>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
