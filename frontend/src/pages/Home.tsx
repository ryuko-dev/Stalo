import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent, TextField, Button, Typography, ToggleButton, ToggleButtonGroup, Tooltip, IconButton, FormControl, InputLabel, Select, MenuItem, LinearProgress } from '@mui/material';
import { Download, FilterList, Close, Timeline } from '@mui/icons-material';
import { addMonths, format, isAfter, isBefore, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getResources, getPositions, getProjects, createAllocation, getAllocations, deleteAllocation, createDragAllocation, validatePositions } from '../services/staloService';
import { usePermissions } from '../contexts/PermissionsContext';
import type { Project } from '../types';
import type { Resource } from '../types';
import type { Position } from '../types';
import type { Allocation } from '../types';
import type { AllocationFormData } from '../types';
import type { DragAllocationData } from '../types';
import { saveAs } from 'file-saver';
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCenter,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';

interface HomeProps {
  selectedDate: Date;
}

interface MonthlyAllocationDialog {
  open: boolean;
  monthIndex: number;
  monthYear: string;
}

export default function Home({ selectedDate }: HomeProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isViewer, isBudgetManager } = usePermissions();
  
  // Check if user can edit (not a viewer or budget manager)
  const canEdit = !isViewer && !isBudgetManager;
  
  // Quarter filter state (default: 1Q = 3 months)
  const [quarterFilter, setQuarterFilter] = useState<'1Q' | '2Q' | '3Q'>('1Q');
  
  // Calculate number of months based on quarter
  const getMonthsCount = (quarter: '1Q' | '2Q' | '3Q'): number => {
    switch (quarter) {
      case '1Q': return 3;
      case '2Q': return 6;
      case '3Q': return 9;
      default: return 6;
    }
  };
  
  const months = Array.from({ length: getMonthsCount(quarterFilter) }, (_, i) => addMonths(selectedDate, i));

  // Calculate dynamic month column width as percentage to fill available space
  // The available space is divided equally among all month columns
  const getMonthColumnWidth = (): string => {
    const monthCount = getMonthsCount(quarterFilter);
    // Calculate percentage width: 100% divided by number of months
    const widthPercent = (100 / monthCount).toFixed(2);
    return `${widthPercent}%`;
  };

  // Display mode state: 'percentage' or 'days'
  const [displayMode, setDisplayMode] = useState<'percentage' | 'days'>('percentage');

  // Project filter state
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');

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
      // Days mode thresholds (17-24 days = optimal, 20 days = 100% equivalent)
      // <85% = <17 days, 85-120% = 17-24 days, >120% = >24 days
      if (displayValue >= 17 && displayValue <= 24) {
        return '#a5d6a7'; // pale green (85-120%)
      } else if (displayValue < 17) {
        return '#fff59d'; // pale yellow (<85%)
      } else {
        return '#ef9a9a'; // pale red (>120%)
      }
    } else {
      // Percentage mode thresholds (85-120% = optimal)
      if (displayValue >= 85 && displayValue <= 120) {
        return '#a5d6a7'; // pale green
      } else if (displayValue < 85) {
        return '#fff59d'; // pale yellow
      } else {
        return '#ef9a9a'; // pale red
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

  // Drag and drop state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedPosition, setDraggedPosition] = useState<Position | null>(null);
  
  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    // Prevent drag for viewers and budget managers
    if (!canEdit) {
      return;
    }
    
    const { active } = event;
    console.log('Drag start event:', { activeId: active.id });
    setActiveId(active.id as string);
    
    // Find the dragged position
    const position = positions.find(p => p.ID === active.id);
    console.log('Found position:', position);
    setDraggedPosition(position || null);
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    // Prevent drag for viewers and budget managers
    if (!canEdit) {
      setActiveId(null);
      setDraggedPosition(null);
      return;
    }
    
    const { over } = event;
    console.log('Drag end event:', { over, draggedPosition });
    
    if (!over) {
      console.log('No drop target - clearing drag state');
      setActiveId(null);
      setDraggedPosition(null);
      return;
    }

    // Check if dropping on a resource cell
    const dropId = over.id as string;
    console.log('Drop ID:', dropId);
    
    if (dropId.startsWith('cell-')) {
      const parts = dropId.split('-');
      console.log('Drop ID parts:', parts);
      
      // The format is: cell-{resourceId-with-hyphens}-{monthIndex}
      // We need to take everything after the first 'cell-' part, then the last part is monthIndex
      const monthIndex = parseInt(parts[parts.length - 1]);
      const resourceId = parts.slice(1, parts.length - 1).join('-');
      
      console.log('Parsed:', { resourceId, monthIndex });
      
      if (isNaN(monthIndex) || monthIndex < 0 || monthIndex >= months.length) {
        console.error('Invalid month index:', monthIndex);
        setActiveId(null);
        setDraggedPosition(null);
        return;
      }
      
      const month = months[monthIndex];
      console.log('Dropping on cell:', { resourceId, monthIndex, month, draggedPosition });
      
      if (draggedPosition) {
        // Check if the dragged position's month matches the target cell's month
        const draggedPositionMonth = startOfMonth(new Date(draggedPosition.MonthYear));
        const targetCellMonth = startOfMonth(month);
        
        if (draggedPositionMonth.getTime() !== targetCellMonth.getTime()) {
          console.log('Cannot allocate: Position month does not match target cell month');
          console.log('Position month:', format(draggedPositionMonth, 'MMM yyyy'));
          console.log('Target month:', format(targetCellMonth, 'MMM yyyy'));
          setActiveId(null);
          setDraggedPosition(null);
          return;
        }
        
        // Convert LoE to percentage if it's in days mode
        let percentageLoE = draggedPosition.LoE;
        const normalizedMode = draggedPosition?.AllocationMode?.toLowerCase()?.trim();
        const isDaysMode = normalizedMode === 'days' || normalizedMode === 'day';
        
        // If position is in days mode, convert to percentage (20 days = 100%)
        if (isDaysMode) {
          percentageLoE = Math.round((draggedPosition.LoE / 20) * 100);
        }
        
        // Create allocation from dragged position using position ID
        const allocationData: DragAllocationData = {
          PositionID: draggedPosition.ID, // Send the specific position ID
          ResourceName: resources.find(r => r.ID === resourceId)?.Name || '',
          MonthYear: format(month, 'yyyy-MM-dd'), // Use target cell's month
          AllocationMode: '%', // Always store as percentage
          LoE: percentageLoE, // Use converted percentage
        };
        
        console.log('Creating allocation:', allocationData);
        console.log('Original position LoE:', draggedPosition.LoE, 'Mode:', draggedPosition.AllocationMode, 'Converted to:', percentageLoE);
        createDragAllocationMutation.mutate(allocationData);
      }
    } else {
      console.log('Dropping on non-cell target:', dropId);
    }
    
    setActiveId(null);
    setDraggedPosition(null);
  };

  // Draggable Position Component
  const DraggablePosition = ({ position }: { position: Position }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      isDragging,
    } = useDraggable({
      id: position.ID,
      disabled: !canEdit, // Disable drag for viewers and budget managers
    });

    const style = {
      transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <Box 
        ref={setNodeRef}
        style={style}
        {...(canEdit ? listeners : {})}
        {...(canEdit ? attributes : {})}
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
          color: '#1e40af',
          cursor: canEdit ? (isDragging ? 'grabbing' : 'grab') : 'default',
          opacity: canEdit ? 1 : 0.6,
          '&:hover': canEdit ? {
            backgroundColor: '#bfdbfe',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          } : {},
        }}
      >
        {position.ProjectName} - {position.PositionName} - {formatValue(position.LoE, position.AllocationMode || '%')}
      </Box>
    );
  };

  // Droppable Cell Component
  const DroppableCell = ({ resourceId, monthIndex, children, isActive, isValidDropTarget }: { 
    resourceId: string; 
    monthIndex: number; 
    children: React.ReactNode;
    isActive: boolean;
    isValidDropTarget?: boolean;
  }) => {
    const { isOver, setNodeRef } = useDroppable({
      id: `cell-${resourceId}-${monthIndex}`,
      disabled: !isActive || (isValidDropTarget === false) || !canEdit,
    });

    return (
      <TableCell 
        ref={setNodeRef}
        align="center"
        onClick={() => isActive && canEdit && handleCellClick(resourceId, monthIndex)}
        sx={{ 
          cursor: (isActive && canEdit) ? 'pointer' : 'default',
          backgroundColor: isActive ? (
            isValidDropTarget === false ? '#ffebee' : (isOver ? '#e3f2fd' : 'white')
          ) : 'white',
          '&:hover': (isActive && canEdit) ? { 
            backgroundColor: isValidDropTarget === false ? '#ffebee' : (isOver ? '#e3f2fd' : '#f5f5f5') 
          } : {},
          p: 0.5,
          width: getMonthColumnWidth(),
          height: '16px',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid #e0e0e0'
        }}
      >
        {children}
      </TableCell>
    );
  };

  const { data: resourcesData, isLoading } = useQuery<Resource[], Error>({
    queryKey: ['resources'],
    queryFn: getResources,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });

  const { data: positionsData } = useQuery<Position[], Error>({
    queryKey: ['positions'],
    queryFn: getPositions,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });

  const { data: allocationsData } = useQuery<Allocation[], Error>({
    queryKey: ['allocations'],
    queryFn: getAllocations,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });

  const { data: projectsData } = useQuery<Project[], Error>({
    queryKey: ['projects'],
    queryFn: getProjects,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
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
    onError: (error: any) => {
      console.error('Allocation creation failed:', error);
      alert('Failed to create allocation: ' + (error.response?.data?.error || error.message));
    }
  });

  const createDragAllocationMutation = useMutation<Allocation, Error, DragAllocationData>({
    mutationFn: createDragAllocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
    },
    onError: (error: any) => {
      console.error('Drag allocation failed:', error);
      alert('Failed to create allocation: ' + (error.response?.data?.error || error.message));
    }
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
  const allProjects = projectsData ?? [];

  // Filter projects to only show those within the displayed months range
  const projects = useMemo(() => {
    if (!allProjects.length || !months.length) return [];
    
    const displayStart = startOfMonth(months[0]);
    const displayEnd = endOfMonth(months[months.length - 1]);
    
    return allProjects.filter(project => {
      if (!project.StartDate) return false;
      
      const projectStart = new Date(project.StartDate);
      const projectEnd = project.EndDate ? new Date(project.EndDate) : new Date('2099-12-31');
      
      // Project is visible if its date range overlaps with the displayed months
      return (
        (projectStart <= displayEnd && projectEnd >= displayStart)
      );
    });
  }, [allProjects, months]);

  // Validate positions on page load/refresh to ensure data integrity
  // This runs once when the component mounts and when months change
  useEffect(() => {
    const runValidation = async () => {
      try {
        // Get the month-year values for all displayed months (format: YYYY-MM-DD)
        const monthYears = months.map(m => format(startOfMonth(m), 'yyyy-MM-dd'));
        
        console.log('Running position validation for months:', monthYears);
        const result = await validatePositions(monthYears);
        
        if (result.changesCount > 0) {
          console.log('Position validation made changes:', result);
          // Refresh data if changes were made
          queryClient.invalidateQueries({ queryKey: ['allocations'] });
          queryClient.invalidateQueries({ queryKey: ['positions'] });
        } else {
          console.log('Position validation: no changes needed');
        }
      } catch (error) {
        console.error('Position validation failed:', error);
      }
    };

    // Only run validation if we have positions data loaded
    if (positionsData && positionsData.length >= 0) {
      runValidation();
    }
  }, [selectedDate]); // Re-run when selected date changes (which changes the displayed months)

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
    // Block viewers and budget managers from creating allocations
    if (!canEdit) {
      return;
    }
    
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
  // Memoized to prevent recalculation on every render
  const filteredResources = useMemo(() => {
    return resources.filter(resource => {
      // Filter out resources with Track = false
      if (resource.Track === false) return false;
      
      if (!resource.StartDate) return false;
      
      const resourceStart = new Date(resource.StartDate);
      const resourceEnd = resource.EndDate ? new Date(resource.EndDate) : null;

      // Check if at least one month in the table falls within the resource's Start/End range (inclusive)
      let isDateInRange = false;
      for (const month of months) {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        
        // Check if this month is within the resource's active period
        const isMonthInRange = isWithinInterval(monthStart, { start: resourceStart, end: resourceEnd || new Date('2099-12-31') }) ||
                               isWithinInterval(monthEnd, { start: resourceStart, end: resourceEnd || new Date('2099-12-31') }) ||
                               (isBefore(resourceStart, monthStart) && (!resourceEnd || isAfter(resourceEnd || new Date('2099-12-31'), monthEnd)));
        
        if (isMonthInRange) {
          isDateInRange = true;
          break;
        }
      }
      
      if (!isDateInRange) return false;

      // If a project filter is selected, only show resources that have allocations for that project
      if (selectedProjectFilter !== 'all') {
        const hasAllocationForProject = allocations.some(
          a => a.ResourceID === resource.ID && a.ProjectID === selectedProjectFilter
        );
        return hasAllocationForProject;
      }
      
      return true;
    });
  }, [resources, months, selectedProjectFilter, allocations, quarterFilter]);

  // Group filtered resources by department - memoized
  const resourcesByDepartment = useMemo(() => {
    const grouped = filteredResources.reduce((acc, resource) => {
      const department = resource.Department || 'Unknown Department';
      if (!acc[department]) {
        acc[department] = [];
      }
      acc[department].push(resource);
      return acc;
    }, {} as Record<string, typeof filteredResources>);
    
    // Sort departments alphabetically and return as an array of [department, resources] tuples
    // Also sort resources within each department by name alphabetically
    return Object.entries(grouped)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([department, resources]) => [
        department,
        resources.sort((a, b) => a.Name.localeCompare(b.Name))
      ]) as [string, typeof filteredResources][];
  }, [filteredResources]);

  // Filter unallocated positions and group by month - memoized
  const unallocatedPositionsByMonth = useMemo(() => {
    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      return positions
        .filter(position => {
          if (!position.MonthYear || position.Allocated !== 'No') return false;
          
          const positionMonth = startOfMonth(new Date(position.MonthYear));
          const isInMonth = isWithinInterval(positionMonth, { start: monthStart, end: monthEnd });
          
          if (!isInMonth) return false;
          
          // If a project filter is selected, only show positions for that project
          if (selectedProjectFilter !== 'all') {
            return position.Project === selectedProjectFilter;
          }
          
          return true;
        })
        .sort((a, b) => a.PositionName.localeCompare(b.PositionName)); // Sort by position name
    });
  }, [months, positions, selectedProjectFilter, quarterFilter]);

  // Excel Export Function for Monthly Allocation Dialog
  const exportMonthlyAllocationToExcel = async () => {
    // Dynamically import XLSX only when needed
    const XLSX = await import('xlsx-js-style');
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Get the selected month
    const month = months[monthlyAllocationDialog.monthIndex];
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    
    // Get unique projects for this month
    const monthProjects = [...new Set(
      allocations
        .filter(a => {
          const allocationDate = new Date(a.MonthYear);
          return isWithinInterval(allocationDate, { start: monthStart, end: monthEnd });
        })
        .map(a => a.ProjectName || 'Unknown Project')
    )];
    
    // Prepare data for the monthly allocation sheet
    const allocationData: any[] = [];
    const rowTypes: ('header' | 'department' | 'resource')[] = [];
    
    // Add header row
    const headers = ['Resource Name', 'Department', ...monthProjects, 'Total'];
    allocationData.push(headers);
    rowTypes.push('header');
    
    // Add department and resource rows (resourcesByDepartment is now a sorted array)
    resourcesByDepartment.forEach(([department, deptResources]) => {
      // Add department header
      allocationData.push([department, '', ...Array(monthProjects.length + 1).fill('')]);
      rowTypes.push('department');
      
      // Add resources in this department
      deptResources.forEach(resource => {
        const resourceRow = [resource.Name, resource.Department || ''];
        
        // Get allocations for this resource and month
        const resourceAllocations = allocations.filter(a => 
          a.ResourceID === resource.ID &&
          (() => {
            const allocationDate = new Date(a.MonthYear);
            return isWithinInterval(allocationDate, { start: monthStart, end: monthEnd });
          })()
        );
        
        // Add allocation data for each project
        monthProjects.forEach(project => {
          const allocation = resourceAllocations.find(a => a.ProjectName === project);
          if (allocation) {
            let displayValue;
            if (displayMode === 'days') {
              displayValue = percentageToDays(allocation.LoE); // Convert % to days
            } else {
              displayValue = allocation.LoE; // Already in %
            }
            resourceRow.push(displayMode === 'days' ? `${displayValue}d` : `${displayValue}%`);
          } else {
            resourceRow.push('-');
          }
        });
        
        // Add total
        const totalLoE = resourceAllocations.reduce((sum, a) => sum + a.LoE, 0);
        if (totalLoE > 0) {
          let totalDisplayValue;
          if (displayMode === 'days') {
            totalDisplayValue = resourceAllocations.reduce((sum, a) => sum + percentageToDays(a.LoE), 0);
          } else {
            totalDisplayValue = totalLoE;
          }
          resourceRow.push(displayMode === 'days' ? `${totalDisplayValue}d` : `${totalDisplayValue}%`);
        } else {
          resourceRow.push('-');
        }
        
        allocationData.push(resourceRow);
        rowTypes.push('resource');
      });
    });
    
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(allocationData);
    
    // Define styles matching Report page
    const styleColors = {
      header: { fill: '005272', font: 'FFFFFF', bold: true },      // Blue header with white text
      department: { fill: 'ADD8E6', font: '000000', bold: true },  // Light blue for departments
      resource: { fill: 'FFFFFF', font: '000000', bold: false }    // White for resources
    };
    
    // Apply styles to all cells
    const colCount = 2 + monthProjects.length + 1; // Resource Name + Department + projects + Total
    allocationData.forEach((_, rowIdx) => {
      const rowType = rowTypes[rowIdx];
      const style = styleColors[rowType];
      
      for (let colIdx = 0; colIdx < colCount; colIdx++) {
        const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
        if (!ws[cellRef]) {
          ws[cellRef] = { v: '', t: 's' };
        }
        
        // Determine alignment
        let horizontalAlign = 'left';
        if (rowType === 'header' || colIdx >= 2) {
          horizontalAlign = 'center'; // Header and project columns centered
        }
        
        ws[cellRef].s = {
          fill: {
            patternType: 'solid',
            fgColor: { rgb: style.fill }
          },
          font: {
            name: 'Arial',
            sz: 8,
            bold: style.bold,
            color: { rgb: style.font }
          },
          border: {
            top: { style: 'thin', color: { rgb: 'CCCCCC' } },
            bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
            left: { style: 'thin', color: { rgb: 'CCCCCC' } },
            right: { style: 'thin', color: { rgb: 'CCCCCC' } }
          },
          alignment: {
            horizontal: horizontalAlign,
            vertical: 'center',
            wrapText: false
          }
        };
      }
    });
    
    // Set column widths
    ws['!cols'] = [
      { wch: 25 }, // Resource Name
      { wch: 20 }, // Department
      ...Array(monthProjects.length).fill({ wch: 18 }), // Projects
      { wch: 12 }  // Total
    ];
    
    // Set row heights
    ws['!rows'] = allocationData.map(() => ({ hpx: 25 }));
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, `Monthly Allocation ${format(month, 'MMM yyyy')}`);
    
    // Generate Excel file with styles and download
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `Monthly_Allocation_${format(month, 'yyyy-MM')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    saveAs(data, fileName);
  };

  // Excel Export Function - dynamically loads XLSX to reduce initial bundle size
  const exportToExcel = async () => {
    // Dynamically import XLSX only when needed (~1MB library)
    const XLSX = await import('xlsx-js-style');
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Prepare data for the main allocation sheet
    const allocationData: any[] = [];
    const rowTypes: ('header' | 'unallocated' | 'department' | 'resource')[] = [];
    
    // Add header row
    const headers = ['Resource Name', 'Department', ...months.map(m => format(m, 'MMM yyyy'))];
    allocationData.push(headers);
    rowTypes.push('header');
    
    // Add unallocated positions row
    const unallocatedRow = ['Unallocated', ''];
    months.forEach((_, i) => {
      const unallocatedInMonth = unallocatedPositionsByMonth[i];
      if (unallocatedInMonth.length > 0) {
        unallocatedRow.push(unallocatedInMonth.map(p => 
          `${p.PositionName} (${formatValue(p.LoE, p.AllocationMode)})`
        ).join(', '));
      } else {
        unallocatedRow.push('');
      }
    });
    allocationData.push(unallocatedRow);
    rowTypes.push('unallocated');
    
    // Add department and resource rows (already sorted)
    resourcesByDepartment.forEach(([department, deptResources]) => {
      // Add department header
      allocationData.push([department, '', ...Array(months.length).fill('')]);
      rowTypes.push('department');
      
      // Add resources in this department
      deptResources.forEach(resource => {
        const resourceRow = [resource.Name, resource.Department || ''];
        
        months.forEach(month => {
          const monthStart = startOfMonth(month);
          const monthEnd = endOfMonth(month);
          
          // Check if resource is active during this month
          const resourceStart = new Date(resource.StartDate);
          const resourceEnd = resource.EndDate ? new Date(resource.EndDate) : null;
          const isActive = isWithinInterval(monthStart, { start: resourceStart, end: resourceEnd || new Date('2099-12-31') }) ||
                          isWithinInterval(monthEnd, { start: resourceStart, end: resourceEnd || new Date('2099-12-31') }) ||
                          (isBefore(resourceStart, monthStart) && (!resourceEnd || isAfter(resourceEnd || new Date('2099-12-31'), monthEnd)));
          
          if (!isActive) {
            resourceRow.push('Not Active');
            return;
          }
          
          // Get allocations for this resource and month
          const cellAllocations = allocations.filter(a => 
            a.ResourceID === resource.ID &&
            (() => {
              const allocationDate = new Date(a.MonthYear);
              return isWithinInterval(allocationDate, { start: monthStart, end: monthEnd });
            })()
          );
          
          if (cellAllocations.length > 0) {
            const allocationDetails = cellAllocations.map(a => 
              `${a.ProjectName} - ${a.PositionName} (${formatValue(a.LoE, a.AllocationMode)})`
            ).join(', ');
            resourceRow.push(allocationDetails);
          } else {
            resourceRow.push('0%');
          }
        });
        
        allocationData.push(resourceRow);
        rowTypes.push('resource');
      });
    });
    
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(allocationData);
    
    // Define styles matching Report page
    const styleColors = {
      header: { fill: '005272', font: 'FFFFFF', bold: true },      // Blue header with white text
      unallocated: { fill: 'FFE4E1', font: '000000', bold: true }, // Light red/pink for unallocated
      department: { fill: 'ADD8E6', font: '000000', bold: true },  // Light blue for departments
      resource: { fill: 'FFFFFF', font: '000000', bold: false }    // White for resources
    };
    
    // Apply styles to all cells
    const colCount = 2 + months.length; // Resource Name + Department + months
    allocationData.forEach((_, rowIdx) => {
      const rowType = rowTypes[rowIdx];
      const style = styleColors[rowType];
      
      for (let colIdx = 0; colIdx < colCount; colIdx++) {
        const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
        if (!ws[cellRef]) {
          ws[cellRef] = { v: '', t: 's' };
        }
        
        // Determine alignment
        let horizontalAlign = 'left';
        if (rowType === 'header' || colIdx >= 2) {
          horizontalAlign = 'center'; // Header and month columns centered
        }
        
        ws[cellRef].s = {
          fill: {
            patternType: 'solid',
            fgColor: { rgb: style.fill }
          },
          font: {
            name: 'Arial',
            sz: 8,
            bold: style.bold,
            color: { rgb: style.font }
          },
          border: {
            top: { style: 'thin', color: { rgb: 'CCCCCC' } },
            bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
            left: { style: 'thin', color: { rgb: 'CCCCCC' } },
            right: { style: 'thin', color: { rgb: 'CCCCCC' } }
          },
          alignment: {
            horizontal: horizontalAlign,
            vertical: 'center',
            wrapText: true
          }
        };
      }
    });
    
    // Set column widths
    ws['!cols'] = [
      { wch: 25 }, // Resource Name
      { wch: 20 }, // Department
      ...Array(months.length).fill({ wch: 30 }) // Months
    ];
    
    // Set row heights
    ws['!rows'] = allocationData.map(() => ({ hpx: 25 }));
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Resource Allocation');
    
    // Create a separate sheet for unallocated positions details with styling
    const unallocatedData: any[] = [['Project Name', 'Position Name', 'Month', 'LoE', 'Allocation Mode']];
    
    unallocatedPositionsByMonth.forEach((monthPositions, monthIndex) => {
      monthPositions.forEach(position => {
        unallocatedData.push([
          position.ProjectName,
          position.PositionName,
          format(months[monthIndex], 'MMM yyyy'),
          position.LoE,
          position.AllocationMode
        ]);
      });
    });
    
    if (unallocatedData.length > 1) {
      const unallocatedWs = XLSX.utils.aoa_to_sheet(unallocatedData);
      
      // Apply styles to unallocated sheet
      const unallocColCount = 5;
      unallocatedData.forEach((_, rowIdx) => {
        const isHeader = rowIdx === 0;
        const style = isHeader ? styleColors.header : styleColors.resource;
        
        for (let colIdx = 0; colIdx < unallocColCount; colIdx++) {
          const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
          if (!unallocatedWs[cellRef]) {
            unallocatedWs[cellRef] = { v: '', t: 's' };
          }
          
          unallocatedWs[cellRef].s = {
            fill: {
              patternType: 'solid',
              fgColor: { rgb: style.fill }
            },
            font: {
              name: 'Arial',
              sz: 8,
              bold: style.bold,
              color: { rgb: style.font }
            },
            border: {
              top: { style: 'thin', color: { rgb: 'CCCCCC' } },
              bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
              left: { style: 'thin', color: { rgb: 'CCCCCC' } },
              right: { style: 'thin', color: { rgb: 'CCCCCC' } }
            },
            alignment: {
              horizontal: isHeader ? 'center' : 'left',
              vertical: 'center',
              wrapText: false
            }
          };
        }
      });
      
      unallocatedWs['!cols'] = [
        { wch: 25 }, // Project Name
        { wch: 30 }, // Position Name
        { wch: 15 }, // Month
        { wch: 10 }, // LoE
        { wch: 18 }  // Allocation Mode
      ];
      unallocatedWs['!rows'] = unallocatedData.map(() => ({ hpx: 25 }));
      
      XLSX.utils.book_append_sheet(wb, unallocatedWs, 'Unallocated Positions');
    }
    
    // Generate Excel file with styles and download
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `Resource_Allocation_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    saveAs(data, fileName);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <Box sx={{ px: 0, py: 0.5 }}>
      {/* Filter Controls */}
      <Box sx={{ 
        mb: 1, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        backgroundColor: 'white',
        p: 1,
        borderRadius: 1,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(0, 0, 0, 0.12)'
      }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 600, color: '#1f2937', fontSize: '1rem' }}>
          Resource Allocation Table
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="quarter-filter-label">Quarter</InputLabel>
            <Select
              labelId="quarter-filter-label"
              value={quarterFilter}
              label="Quarter"
              onChange={(e) => setQuarterFilter(e.target.value as '1Q' | '2Q' | '3Q')}
              sx={{ backgroundColor: 'white' }}
            >
              <MenuItem value="1Q">1Q (3 months)</MenuItem>
              <MenuItem value="2Q">2Q (6 months)</MenuItem>
              <MenuItem value="3Q">3Q (9 months)</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="project-filter-label">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <FilterList sx={{ fontSize: 18 }} />
                Project Filter
              </Box>
            </InputLabel>
            <Select
              labelId="project-filter-label"
              value={selectedProjectFilter}
              label="Project Filter"
              onChange={(e) => setSelectedProjectFilter(e.target.value)}
              sx={{ backgroundColor: 'white' }}
            >
              <MenuItem value="all">All Projects</MenuItem>
              {projects.map((project) => (
                <MenuItem key={project.ID} value={project.ID}>
                  {project.Name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip title="Open Gantt Chart">
            <IconButton
              onClick={() => navigate('/gantt')}
              sx={{
                backgroundColor: 'white',
                border: '1px solid rgba(0,0,0,0.12)',
                '&:hover': { backgroundColor: '#f3f4f6' },
                p: 1,
              }}
            >
              <Timeline />
            </IconButton>
          </Tooltip>
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
          
          <Tooltip title="Download to Excel">
            <IconButton 
              onClick={exportToExcel}
              sx={{ 
                backgroundColor: 'primary.main',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                }
              }}
            >
              <Download />
            </IconButton>
          </Tooltip>
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
        border: '1px solid rgba(0, 0, 0, 0.12)',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <Table size="small" sx={{ width: '100%', tableLayout: 'fixed' }} stickyHeader>
          <TableHead sx={{ backgroundColor: '#f9fafb' }}>
            <TableRow>
              <TableCell sx={{ 
                width: '200px',
                fontWeight: 600,
                color: '#374151',
                border: '1px solid rgba(0, 0, 0, 0.12)',
                fontSize: '0.875rem',
                position: 'sticky',
                left: 0,
                zIndex: 3,
                backgroundColor: '#f3f4f6'
              }}>
                Name
              </TableCell>
              {months.map((m, idx) => (
                <TableCell 
                  key={idx} 
                  align="center" 
                  sx={{ 
                    width: getMonthColumnWidth(),
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
          </TableHead>
          <TableBody>
            {/* Unallocated positions row */}
            <TableRow>
              <TableCell sx={{ 
                width: '200px',
                fontWeight: 600,
                color: '#6b7280',
                border: '1px solid rgba(0, 0, 0, 0.12)',
                fontSize: '0.75rem',
                position: 'sticky',
                left: 0,
                zIndex: 1,
                backgroundColor: '#f9fafb'
              }}>
                Unallocated
              </TableCell>
              {months.map((_, i) => (
                <TableCell key={i} align="center" sx={{ 
                  p: 0.5, 
                  width: getMonthColumnWidth(),
                  backgroundColor: '#f9fafb',
                  border: '1px solid rgba(0, 0, 0, 0.12)',
                  verticalAlign: 'top'
                }}>
                  {unallocatedPositionsByMonth[i].length > 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: '120px', overflowY: 'auto' }}>
                      {unallocatedPositionsByMonth[i].map((position) => (
                        <DraggablePosition key={position.ID} position={position} />
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
            
            {resourcesByDepartment.map(([department, departmentResources]) => (
              <React.Fragment key={department}>
                {/* Department header row */}
                <TableRow>
                  <TableCell 
                    colSpan={10} 
                    sx={{ 
                      backgroundColor: 'grey.300', 
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
                    <TableCell component="th" scope="row" sx={{ 
                      pl: 2, pr: 1, py: 0.25, width: '200px', fontSize: '0.8rem',
                      position: 'sticky',
                      left: 0,
                      zIndex: 1,
                      backgroundColor: 'white'
                    }}>
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
                        <DroppableCell 
                          key={i} 
                          resourceId={resource.ID} 
                          monthIndex={i}
                          isActive={isActive}
                          isValidDropTarget={draggedPosition ? (
                            startOfMonth(new Date(draggedPosition.MonthYear)).getTime() === startOfMonth(month).getTime()
                          ) : undefined}
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
                              })() &&
                              (selectedProjectFilter === 'all' || a.ProjectID === selectedProjectFilter)
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
                              let barWidth = totalPercentage;
                              
                              if (displayMode === 'days') {
                                displayValue = totalPercentage * 20 / 100; // Convert % to days
                                barWidth = displayValue * 100 / 20; // Convert days back to % for bar width
                              }
                              
                              const backgroundColor = getBackgroundColor(displayValue, displayMode === 'days' ? 'days' : '%');
                              
                              return (
                                <Tooltip 
                                  title={
                                    <div>
                                      {cellAllocations.map((allocation) => (
                                        <div key={allocation.ID}>
                                          {allocation.ProjectName} - {allocation.PositionName} - {formatValue(allocation.LoE, allocation.AllocationMode)}
                                        </div>
                                      ))}
                                    </div>
                                  }
                                  arrow
                                  placement="top"
                                >
                                  <Box 
                                    sx={{ 
                                      position: 'absolute',
                                      top: 0,
                                      left: 0,
                                      width: '100%',
                                      height: '100%',
                                      backgroundColor: 'transparent',
                                      borderRadius: 1,
                                      overflow: 'hidden',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <Box
                                      sx={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        height: '100%',
                                        width: `${Math.min(100, Math.max(0, barWidth))}%`,
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
                                </Tooltip>
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
                        </DroppableCell>
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
        fullScreen
        sx={{ '& .MuiDialog-paper': { p: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Monthly Allocation View - {monthlyAllocationDialog.monthYear}</span>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
            <Tooltip title="Download to Excel">
              <IconButton 
                onClick={exportMonthlyAllocationToExcel}
                sx={{ 
                  backgroundColor: 'primary.main',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  }
                }}
              >
                <Download />
              </IconButton>
            </Tooltip>
            <Tooltip title="Close">
              <IconButton 
                onClick={() => setMonthlyAllocationDialog({ ...monthlyAllocationDialog, open: false })}
                sx={{ 
                  backgroundColor: 'grey.600',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'grey.700',
                  }
                }}
              >
                <Close />
              </IconButton>
            </Tooltip>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, maxHeight: '70vh', overflow: 'auto' }}>
          <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0, px: 0 }, '& .MuiTableRow-root': { height: 'auto' } }}>
            <TableHead sx={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f8f9fa', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <TableRow>
                <TableCell sx={{ width: '150px', minWidth: '150px', py: 1, px: 1, backgroundColor: '#f8f9fa', fontSize: '0.75rem', fontWeight: 600, position: 'sticky', left: 0, zIndex: 11 }}>Resource</TableCell>
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
                        <TableCell key={idx} align="center" sx={{ width: '100px', minWidth: '100px', py: 1, px: 0.5, backgroundColor: '#f8f9fa', fontSize: '0.75rem', fontWeight: 600 }}>
                          {project}
                        </TableCell>
                      ));
                    })()}
                    <TableCell align="center" sx={{ width: '100px', minWidth: '100px', py: 1, px: 0.5, backgroundColor: '#f8f9fa', fontSize: '0.75rem', fontWeight: 600 }}>Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {resourcesByDepartment.map(([department, departmentResources]) => (
                    <React.Fragment key={department}>
                      {/* Department header row */}
                      <TableRow>
                        <TableCell 
                          colSpan={20} 
                          sx={{ 
                            backgroundColor: '#e9ecef', 
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            py: 0.5,
                            px: 1,
                            color: '#495057',
                            position: 'sticky',
                            left: 0,
                            zIndex: 2
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
                          })() &&
                          (selectedProjectFilter === 'all' || a.ProjectID === selectedProjectFilter)
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
                          <TableRow key={resource.ID} hover sx={{ '&:hover': { backgroundColor: '#f8f9fa' } }}>
                            <TableCell component="th" scope="row" sx={{ pl: 2, py: 0.5, px: 1, fontSize: '0.75rem', position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 1 }}>
                              {resource.Name}
                            </TableCell>
                            {monthProjects.map((project) => {
                              // Find allocation for this resource and project
                              const allocation = resourceAllocations.find(a => {
                                return a.ProjectName === project;
                              });
                              return (
                                <TableCell key={project} align="center" sx={{ p: 0.25, py: 0.5 }}>
                                  {allocation ? (
                                    <Box sx={{ 
                                      backgroundColor: '#1976d2',
                                      color: 'white',
                                      px: 0.75,
                                      py: 0.25,
                                      borderRadius: 1,
                                      fontSize: '0.65rem',
                                      fontWeight: 600,
                                      display: 'inline-block'
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
                            <TableCell align="center" sx={{ p: 0.25, py: 0.5, width: '100px', minWidth: '100px' }}>
                              {totalLoE > 0 ? (
                                <Box sx={{ position: 'relative', width: '100%' }}>
                                  <LinearProgress 
                                    variant="determinate" 
                                    value={Math.min(totalLoE, 100)} // Cap at 100% for visual display
                                    sx={{
                                      width: '100%',
                                      height: 20,
                                      borderRadius: 2,
                                      backgroundColor: 'grey.300',
                                      '& .MuiLinearProgress-bar': {
                                        backgroundColor: displayMode === 'days' 
                                          ? (percentageToDays(totalLoE) >= 17 && percentageToDays(totalLoE) <= 24 ? '#4caf50' : percentageToDays(totalLoE) > 24 ? '#f44336' : '#ffb300')
                                          : (totalLoE >= 85 && totalLoE <= 120 ? '#4caf50' : totalLoE > 120 ? '#f44336' : '#ffb300'),
                                        borderRadius: 2,
                                      }
                                    }}
                                  />
                                  <Typography 
                                    variant="caption" 
                                    sx={{ 
                                      position: 'absolute',
                                      top: 0,
                                      left: 0,
                                      right: 0,
                                      bottom: 0,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '0.7rem',
                                      fontWeight: 'bold',
                                      color: 'white',
                                      textShadow: '0 0 2px rgba(0,0,0,0.5)'
                                    }}
                                  >
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
                                  </Typography>
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
        </DialogContent>
      </Dialog>
      
      {/* Drag Overlay */}
      <DragOverlay>
        {activeId && draggedPosition ? (
          <Box
            sx={{
              backgroundColor: '#dbeafe',
              p: 1,
              borderRadius: 0.5,
              fontSize: '0.60rem',
              fontWeight: 'normal',
              lineHeight: 1.2,
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              border: '1px solid #93c5fd',
              color: '#1e40af',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              opacity: 0.9,
            }}
          >
            {draggedPosition.ProjectName} - {draggedPosition.PositionName} - {formatValue(draggedPosition.LoE, draggedPosition.AllocationMode || '%')}
          </Box>
        ) : null}
      </DragOverlay>
    </Box>
  </DndContext>
  );
}
