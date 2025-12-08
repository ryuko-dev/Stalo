import React, { useState } from 'react';
import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent, TextField, Button, Typography, ToggleButton, ToggleButtonGroup } from '@mui/material';
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
  const months = Array.from({ length: 9 }, (_, i) => addMonths(selectedDate, i));

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
        return '#4caf50'; // professional green
      } else if (displayValue < 18) {
        return '#ffb300'; // golden yellow
      } else {
        return '#f44336'; // professional red
      }
    } else {
      // Percentage mode thresholds (90-110% = optimal)
      if (displayValue >= 90 && displayValue <= 110) {
        return '#4caf50'; // professional green
      } else if (displayValue < 90) {
        return '#ffb300'; // golden yellow
      } else {
        return '#f44336'; // professional red
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
    // Always convert LoE to percentage for database storage
    let percentageLoE = position.LoE;
    const normalizedMode = position?.AllocationMode?.toLowerCase()?.trim();
    const isDaysMode = normalizedMode === 'days' || normalizedMode === 'day';
    
    // If position is in days mode, convert to percentage (20 days = 100%)
    if (isDaysMode) {
      percentageLoE = Math.round((position.LoE / 20) * 100);
    }
    // If position is already in percentage mode, use as-is
    // No conversion needed

    setAllocationData({
      ProjectName: position.ProjectName || '',
      ResourceName: allocationData.ResourceName,
      PositionName: position.PositionName,
      MonthYear: position.MonthYear, // Use the position's actual MonthYear
      AllocationMode: '%', // Always save as percentage mode
      LoE: percentageLoE, // Always save as percentage value
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

    // Check if at least one month in the table falls within the resource's Start/End range (inclusive)
    for (const month of months) {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      // Check if this month is within the resource's active period
      const isMonthInRange = isWithinInterval(monthStart, { start: resourceStart, end: resourceEnd || new Date('2099-12-31') }) ||
                             isWithinInterval(monthEnd, { start: resourceStart, end: resourceEnd || new Date('2099-12-31') }) ||
                             (isBefore(resourceStart, monthStart) && (!resourceEnd || isAfter(resourceEnd || new Date('2099-12-31'), monthEnd)));
      
      if (isMonthInRange) {
        return true; // Resource should appear if at least one month is in range
      }
    }
    
    return false; // Don't show resource if no months are in range
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
    <Box sx={{ px: 0, py: 2 }}>
      {/* Filter Controls */}
      <Box sx={{ 
        mb: 2, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        backgroundColor: 'white',
        p: 2,
        borderRadius: 1,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(0, 0, 0, 0.12)'
      }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 600, color: '#1f2937' }}>
          Resource Allocation Table
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ToggleButtonGroup
            value={displayMode}
            exclusive
            onChange={(_: React.MouseEvent<HTMLElement>, value: 'percentage' | 'days' | null) => value && setDisplayMode(value)}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                px: 3,
                py: 1,
                fontSize: '0.875rem',
                fontWeight: 500,
                border: '1px solid rgba(0, 0, 0, 0.23)',
                '&:not(:first-of-type)': {
                  borderRadius: '0 4px 4px 0',
                },
                '&:first-of-type': {
                  borderRadius: '4px 0 0 4px',
                },
                '&.Mui-selected': {
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: '#2563eb',
                  },
                },
                '&:not(.Mui-selected)': {
                  backgroundColor: 'white',
                  color: '#374151',
                  '&:hover': {
                    backgroundColor: '#f3f4f6',
                  },
                },
              },
            }}
          >
            <ToggleButton value="percentage">
              %
            </ToggleButton>
            <ToggleButton value="days">
              Days
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      <TableContainer component={Paper} sx={{ 
        mt: 1, 
        maxWidth: 'none', 
        width: '100%', 
        ml: 0, 
        mr: 0, 
        pl: 0, 
        pr: 0,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        borderRadius: 1,
        border: '1px solid rgba(0, 0, 0, 0.12)'
      }}>
        <Table size="small" sx={{ width: '100%', tableLayout: 'fixed' }}>
          <TableHead sx={{ backgroundColor: '#f9fafb' }}>
            <TableRow>
              <TableCell sx={{ 
                width: '200px', 
                minWidth: '200px',
                backgroundColor: '#f3f4f6',
                fontWeight: 600,
                color: '#374151',
                border: '1px solid rgba(0, 0, 0, 0.12)',
                fontSize: '0.875rem'
              }}>
                Name
              </TableCell>
              {months.map((m, idx) => (
                <TableCell 
                  key={idx} 
                  align="center" 
                  sx={{ 
                    width: '120px', 
                    minWidth: '120px',
                    cursor: 'pointer',
                    backgroundColor: '#f3f4f6',
                    fontWeight: 600,
                    color: '#374151',
                    border: '1px solid rgba(0, 0, 0, 0.12)',
                    fontSize: '0.875rem',
                    '&:hover': { backgroundColor: '#e5e7eb' },
                    textDecoration: 'underline'
                  }}
                  onClick={() => handleMonthClick(idx)}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {format(m, 'MMM yyyy')}
                    </Typography>
                  </Box>
                </TableCell>
              ))}
            </TableRow>
            
            {/* Unallocated positions row */}
            <TableRow>
              <TableCell sx={{ 
                width: '200px', 
                minWidth: '200px',
                backgroundColor: '#f9fafb',
                fontWeight: 600,
                color: '#6b7280',
                border: '1px solid rgba(0, 0, 0, 0.12)',
                fontSize: '0.75rem'
              }}>
                Unallocated
              </TableCell>
              {months.map((_, i) => (
                <TableCell key={i} align="center" sx={{ 
                  p: 0.5, 
                  width: '120px', 
                  minWidth: '120px',
                  backgroundColor: '#f9fafb',
                  border: '1px solid rgba(0, 0, 0, 0.12)',
                  verticalAlign: 'top'
                }}>
                  {unallocatedPositionsByMonth[i].length > 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: '120px', overflowY: 'auto' }}>
                      {unallocatedPositionsByMonth[i].map((position) => (
                        <Box 
                          key={position.ID} 
                          sx={{ 
                            backgroundColor: '#dbeafe',
                            p: 0.5,
                            borderRadius: 0.5,
                            fontSize: '0.60rem',
                            fontWeight: 'normal',
                            lineHeight: 1.2,
                            whiteSpace: 'normal',
                            wordBreak: 'break-word',
                            border: '1px solid #93c5fd',
                            color: '#1e40af'
                          }}
                        >
                          {position.ProjectName} - {position.PositionName} - {formatValue(position.LoE, position.AllocationMode || '%')}
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                      -
                    </Typography>
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
                    colSpan={10} 
                    sx={{ 
                      backgroundColor: 'grey.100', 
                      fontWeight: 'bold',
                      fontSize: '0.75rem',
                      p: 0.5,
                      height: '24px'
                    }}
                  >
                    {department}
                  </TableCell>
                </TableRow>
                
                {/* Resources in this department */}
                {departmentResources.map((resource) => (
                  <TableRow key={resource.ID} hover>
                    <TableCell component="th" scope="row" sx={{ pl: 2, pr: 1, py: 0.25, width: '200px', minWidth: '200px', fontSize: '0.8rem' }}>
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
                            p: 0.5,
                            width: '100px',
                            minWidth: '100px',
                            height: '16px',
                            position: 'relative',
                            overflow: 'hidden',
                            border: '1px solid white'
                          }}
                        >
                          {(() => {
                            // Start Date and End Date checks
                            const resourceStart = new Date(resource.StartDate);
                            const resourceEnd = resource.EndDate ? new Date(resource.EndDate) : null;
                            
                            // Check if month is before resource's Start Date
                            const isBeforeStart = isBefore(monthEnd, resourceStart);
                            
                            // Check if month is after resource's End Date
                            const isAfterEnd = resourceEnd && isAfter(monthStart, resourceEnd);
                            
                            // Check if resource is active during this month
                            const isActive = !isBeforeStart && !isAfterEnd;
                            
                            // Display "Not Started" if month is before start date
                            if (isBeforeStart) {
                              return (
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                  <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
                                    Not Started
                                  </Typography>
                                </Box>
                              );
                            }
                            
                            // Display "Ended" if month is after end date
                            if (isAfterEnd) {
                              return (
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                  <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
                                    Ended
                                  </Typography>
                                </Box>
                              );
                            }
                            
                            // Check if there are allocations for this resource and month
                            const cellAllocations = allocations.filter(a => 
                              a.ResourceID === resource.ID &&
                              (() => {
                                const allocationDate = new Date(a.MonthYear);
                                return isWithinInterval(allocationDate, { start: monthStart, end: monthEnd });
                              })()
                            );
                            
                            if (cellAllocations.length > 0) {
                              // Calculate total allocation - everything is stored as percentage
                              let totalPercentage = 0;
                              
                              // Sum all allocations (all stored as percentage)
                              cellAllocations.forEach(allocation => {
                                totalPercentage += allocation.LoE; // All allocations are now stored as %
                              });
                              
                              // Calculate display value based on display mode
                              let displayValue = totalPercentage;
                              if (displayMode === 'days') {
                                displayValue = totalPercentage * 20 / 100; // Convert % to days
                              }
                              
                              const backgroundColor = getBackgroundColor(displayValue, displayMode === 'days' ? 'days' : '%');
                              
                              return (
                                <Box 
                                  sx={{ 
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    backgroundColor: 'rgba(0,0,0,0.1)',
                                    borderRadius: 1,
                                    overflow: 'hidden',
                                    display: 'flex',
                                    alignItems: 'center'
                                  }}
                                >
                                  <Box
                                    sx={{
                                      position: 'absolute',
                                      top: 0,
                                      left: 0,
                                      height: '100%',
                                      width: `${Math.min(100, Math.max(0, totalPercentage))}%`,
                                      backgroundColor,
                                      transition: 'width 0.3s ease',
                                      zIndex: 0,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      borderRadius: 1
                                    }}
                                  >
                                    <Typography 
                                      variant="caption" 
                                      sx={{ 
                                        fontSize: '0.5rem',
                                        fontWeight: 'bold',
                                        color: 'black',
                                        lineHeight: 1,
                                        position: 'relative',
                                        zIndex: 1
                                      }}
                                    >
                                      {displayMode === 'days' ? `${displayValue}d` : `${displayValue}%`}
                                    </Typography>
                                  </Box>
                                </Box>
                              );
                            } else if (isActive) {
                              return (
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                  <Typography variant="caption" sx={{ fontSize: '0.5rem', color: 'text.secondary' }}>
                                    {displayMode === 'days' ? '0d' : '0%'}
                                  </Typography>
                                </Box>
                              );
                            }
                            
                            return null;
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
                <TableCell colSpan={10} align="center">No resources found for the displayed period</TableCell>
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
                // Always display as percentage since we store as percentage
                return `${allocationData.LoE}%${displayMode === 'days' ? ` (${percentageToDays(allocationData.LoE)} days)` : ''}`;
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
                      {existingAllocations.map((allocation) => {
                        // Use project and position names directly from allocation (joined from backend)
                        const projectName = allocation.ProjectName || 'Unknown Project';
                        const positionName = allocation.PositionName || 'Unknown Position';
                        
                        // Calculate display value (everything stored as percentage)
                        let displayValue = allocation.LoE;
                        if (displayMode === 'days') {
                          displayValue = allocation.LoE * 20 / 100; // Convert % to days
                        }
                        
                        // Get background color
                        const backgroundColor = getBackgroundColor(displayValue, displayMode === 'days' ? 'days' : '%');
                        
                        return (
                          <Box 
                            key={allocation.ID} 
                            sx={{ 
                              p: 0.5, 
                              border: 1, 
                              borderColor: 'divider', 
                              borderRadius: 0.5,
                              backgroundColor: 'grey.50'
                            }}
                          >
                            {/* Compact Allocation Bar with Project and Position Name */}
                            <Box 
                              sx={{ 
                                position: 'relative',
                                height: '16px',
                                backgroundColor: 'rgba(0,0,0,0.1)',
                                borderRadius: 0.5,
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mb: 0.25
                              }}
                            >
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  height: '100%',
                                  width: `${Math.min(100, Math.max(0, allocation.LoE))}%`,
                                  backgroundColor,
                                  transition: 'width 0.3s ease',
                                  zIndex: 0
                                }}
                              />
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  fontSize: '0.5rem',
                                  fontWeight: 'bold',
                                  color: 'text.primary',
                                  lineHeight: 1,
                                  position: 'relative',
                                  zIndex: 1,
                                  textAlign: 'center',
                                  px: 0.5
                                }}
                              >
                                {projectName} • {positionName} • {displayMode === 'days' ? `${displayValue}d` : `${displayValue}%`}
                              </Typography>
                            </Box>
                            
                            {/* Remove Button Only */}
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                              <Button 
                                size="small" 
                                variant="outlined" 
                                color="error"
                                onClick={() => deleteAllocationMutation.mutate(allocation.ID)}
                                sx={{ fontSize: '0.6rem', minHeight: '18px', px: 1, py: 0.25 }}
                              >
                                Remove
                              </Button>
                            </Box>
                          </Box>
                        );
                      })}
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
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Monthly Allocation View - {monthlyAllocationDialog.monthYear}</span>
          <ToggleButtonGroup
            value={displayMode}
            exclusive
            onChange={(_: React.MouseEvent<HTMLElement>, value: 'percentage' | 'days' | null) => value && setDisplayMode(value)}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                px: 2,
                py: 0.5,
                fontSize: '0.875rem',
                fontWeight: 500,
                border: '1px solid rgba(0, 0, 0, 0.23)',
                '&:not(:first-of-type)': {
                  borderRadius: '0 4px 4px 0',
                },
                '&:first-of-type': {
                  borderRadius: '4px 0 0 4px',
                },
                '&.Mui-selected': {
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: '#2563eb',
                  },
                },
                '&:not(.Mui-selected)': {
                  backgroundColor: 'white',
                  color: '#374151',
                  '&:hover': {
                    backgroundColor: '#f3f4f6',
                  },
                },
              },
            }}
          >
            <ToggleButton value="percentage">
              %
            </ToggleButton>
            <ToggleButton value="days">
              Days
            </ToggleButton>
          </ToggleButtonGroup>
        </DialogTitle>
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
                              // Use project name directly from allocation (joined from backend)
                              return a.ProjectName || 'Unknown Project';
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
                                return a.ProjectName === project;
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
                                // All allocations are stored as percentages in the database
                                // Convert to display mode
                                let displayValue;
                                if (displayMode === 'days') {
                                  displayValue = percentageToDays(allocation.LoE); // Convert % to days
                                } else {
                                  displayValue = allocation.LoE; // Already in %
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
                                // All allocations are stored as percentages in the database
                                // Convert total to the selected display mode
                                let totalDisplayValue;
                                if (displayMode === 'days') {
                                  // Convert total percentage to days
                                  totalDisplayValue = resourceAllocations.reduce((sum, a) => {
                                    return sum + percentageToDays(a.LoE); // Convert % to days
                                  }, 0);
                                } else {
                                  // Sum percentages
                                  totalDisplayValue = resourceAllocations.reduce((sum, a) => {
                                    return sum + a.LoE; // Already in %
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
