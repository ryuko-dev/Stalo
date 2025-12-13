import React from 'react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import { 
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  SaveAlt as SaveAltIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Percent as PercentIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getPayrollResources, 
  getPayrollRecords, 
  createOrUpdatePayrollRecord,
  getPayrollProjects
} from '../services/staloService';
import type { PayrollResource, PayrollRecord } from '../types';
import { format, startOfMonth, eachDayOfInterval, getDay, endOfMonth } from 'date-fns';
import * as XLSX from 'xlsx';
import { getEntities } from '../services/staloService';

interface PayrollAllocationProps {
  selectedDate: Date;
}

// Calculate working days for a given month based on work schedule
function calculateWorkingDays(year: number, month: number, workDays: string): number {
  const startDate = new Date(year, month, 1);
  const endDate = endOfMonth(startDate);
  const allDays = eachDayOfInterval({ start: startDate, end: endDate });
  
  let count = 0;
  
  if (workDays === 'Mon-Fri') {
    // Monday = 1, Friday = 5
    allDays.forEach(day => {
      const dayOfWeek = getDay(day);
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        count++;
      }
    });
  } else if (workDays === 'Sun-Thu') {
    // Sunday = 0, Thursday = 4
    allDays.forEach(day => {
      const dayOfWeek = getDay(day);
      if (dayOfWeek === 0 || (dayOfWeek >= 1 && dayOfWeek <= 4)) {
        count++;
      }
    });
  } else {
    // Default to Mon-Fri if unknown
    allDays.forEach(day => {
      const dayOfWeek = getDay(day);
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        count++;
      }
    });
  }
  
  return count;
}

// Group resources by entity
interface GroupedResources {
  entityName: string;
  entityId: string;
  resources: PayrollResource[];
}

export default function PayrollAllocation({ selectedDate }: PayrollAllocationProps) {
  const queryClient = useQueryClient();
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());
  const [editedRecords, setEditedRecords] = useState<Map<string, Partial<PayrollRecord>>>(new Map());
  const [isLocked, setIsLocked] = useState(false);
  const [isPercentageMode, setIsPercentageMode] = useState(false);
  const [journalDialogOpen, setJournalDialogOpen] = useState(false);
  const [originalAllocations, setOriginalAllocations] = useState<Map<string, Record<string, number>>>(new Map());
  const [entityAverages, setEntityAverages] = useState<Map<string, Record<string, number>>>(new Map());
  
  // Format the selected month for API calls
  const monthParam = useMemo(() => {
    return format(startOfMonth(selectedDate), 'yyyy-MM-dd');
  }, [selectedDate]);

  const showNotification = (message: string, severity: 'success' | 'error' = 'success') => {
    setNotification({ open: true, message, severity });
  };

  // Fetch resources that have allocations for the selected month
  const { data: payrollResources, isLoading: resourcesLoading, refetch: refetchResources } = useQuery<PayrollResource[], Error>({
    queryKey: ['payrollResources', monthParam],
    queryFn: () => getPayrollResources(monthParam),
    staleTime: 1000 * 60 * 2
  });

  // Fetch existing payroll records for the month
  const { data: payrollRecords, isLoading: recordsLoading, refetch: refetchRecords } = useQuery<PayrollRecord[], Error>({
    queryKey: ['payrollRecords', monthParam],
    queryFn: () => getPayrollRecords(monthParam),
    staleTime: 1000 * 60 * 2
  });

  // Fetch projects that fall within the selected month
  const { data: payrollProjects, isLoading: projectsLoading } = useQuery<any[], Error>({
    queryKey: ['payrollProjects', monthParam],
    queryFn: () => getPayrollProjects(monthParam),
    staleTime: 1000 * 60 * 5
  });

  // Fetch entities for account codes
  const { data: entities } = useQuery<any[], Error>({
    queryKey: ['entities'],
    queryFn: () => getEntities(),
    staleTime: 1000 * 60 * 10
  });

  // Group resources by entity
  const groupedResources = useMemo((): GroupedResources[] => {
    if (!payrollResources) return [];
    
    // Use a Set to track unique resources and prevent duplicates
    const uniqueResources = new Map<string, PayrollResource>();
    
    payrollResources.forEach(resource => {
      if (!uniqueResources.has(resource.ResourceID)) {
        uniqueResources.set(resource.ResourceID, resource);
      }
    });
    
    const groups = new Map<string, GroupedResources>();
    
    uniqueResources.forEach(resource => {
      const entityKey = resource.EntityID || 'no-entity';
      const entityName = resource.EntityName || 'No Entity';
      
      if (!groups.has(entityKey)) {
        groups.set(entityKey, {
          entityName,
          entityId: entityKey,
          resources: []
        });
      }
      
      groups.get(entityKey)!.resources.push(resource);
    });
    
    // Sort by entity name
    return Array.from(groups.values()).sort((a, b) => a.entityName.localeCompare(b.entityName));
  }, [payrollResources]);

  // Initialize expanded entities on first load
  useEffect(() => {
    if (groupedResources.length > 0 && expandedEntities.size === 0) {
      setExpandedEntities(new Set(groupedResources.map(g => g.entityId)));
    }
  }, [groupedResources]);

  // Create a map of existing records by ResourceID
  const recordsByResource = useMemo(() => {
    const map = new Map<string, PayrollRecord>();
    payrollRecords?.forEach(record => {
      map.set(record.ResourceID, record);
    });
    return map;
  }, [payrollRecords]);

  // Save mutation for individual resource
  const saveMutation = useMutation({
    mutationFn: createOrUpdatePayrollRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrollRecords'] });
      showNotification('Payroll record saved successfully!', 'success');
    },
    onError: (error: any) => {
      showNotification(`Error saving payroll record: ${error.message}`, 'error');
    }
  });

  // Batch save mutation
  const batchSaveMutation = useMutation({
    mutationFn: async (records: Array<{ resourceId: string; data: any }>) => {
      const promises = records.map(record => 
        createOrUpdatePayrollRecord(record.data)
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrollRecords'] });
      showNotification('All payroll records saved successfully!', 'success');
      // Clear all unsaved changes after successful batch save
      setEditedRecords(new Map());
    },
    onError: (error: any) => {
      showNotification(`Error batch saving payroll records: ${error.message}`, 'error');
    }
  });

  // Calculate daily rate: (Net Salary * 12) / 220
  const calculateDailyRate = useCallback((netSalary: number | null | undefined): number | null => {
    if (!netSalary || netSalary === 0) return null;
    return (netSalary * 12) / 220;
  }, []);

  // Get the current value for a field (edited value or existing record value)
  const getFieldValue = useCallback((resourceId: string, field: keyof PayrollRecord, defaultValue: any = null) => {
    const editedRecord = editedRecords.get(resourceId);
    if (editedRecord && field in editedRecord) {
      return editedRecord[field];
    }
    
    const existingRecord = recordsByResource.get(resourceId);
    if (existingRecord && field in existingRecord) {
      return existingRecord[field];
    }
    
    return defaultValue;
  }, [editedRecords, recordsByResource]);

  // Handle field change
  const handleFieldChange = (resourceId: string, field: keyof PayrollRecord, value: any) => {
    setEditedRecords(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(resourceId) || {};
      newMap.set(resourceId, { ...existing, [field]: value });
      return newMap;
    });
  };

  // Batch save function
  const handleBatchSave = async () => {
    const recordsToSave: Array<{ resourceId: string; data: any }> = [];
    
    // Collect all edited records
    editedRecords.forEach((editedData, resourceId) => {
      const resource = payrollResources?.find(r => r.ResourceID === resourceId);
      const existingRecord = recordsByResource.get(resourceId);
      
      if (resource && Object.keys(editedData).length > 0) {
        const workingDays = calculateWorkingDays(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          resource.WorkDays
        );
        
        // Determine the project allocations JSON to save
        let projectAllocationsJson = editedData.ProjectAllocations || existingRecord?.ProjectAllocations || null;
        
        // Build record data - merge edited fields with existing record
        const recordData: Partial<PayrollRecord> = {
          ResourceID: resource.ResourceID,
          Department: resource.Department || null,
          EntityID: resource.EntityID || null,
          WorkingDays: workingDays.toString(),
          Currency: editedData.Currency !== undefined ? editedData.Currency : (existingRecord?.Currency || resource.Currency || null),
          NetSalary: editedData.NetSalary !== undefined ? editedData.NetSalary : existingRecord?.NetSalary,
          SocialSecurity: editedData.SocialSecurity !== undefined ? editedData.SocialSecurity : existingRecord?.SocialSecurity,
          EmployeeTax: editedData.EmployeeTax !== undefined ? editedData.EmployeeTax : existingRecord?.EmployeeTax,
          EmployerTax: editedData.EmployerTax !== undefined ? editedData.EmployerTax : existingRecord?.EmployerTax,
          Housing: editedData.Housing !== undefined ? editedData.Housing : existingRecord?.Housing,
          CommunicationsOther: editedData.CommunicationsOther !== undefined ? editedData.CommunicationsOther : existingRecord?.CommunicationsOther,
          AnnualLeave: editedData.AnnualLeave !== undefined ? editedData.AnnualLeave : existingRecord?.AnnualLeave,
          SickLeave: editedData.SickLeave !== undefined ? editedData.SickLeave : existingRecord?.SickLeave,
          PublicHolidays: editedData.PublicHolidays !== undefined ? editedData.PublicHolidays : existingRecord?.PublicHolidays,
          Month: monthParam,
          ProjectAllocations: projectAllocationsJson,
        };
        
        recordsToSave.push({ resourceId, data: recordData });
      }
    });
    
    if (recordsToSave.length === 0) {
      showNotification('No changes to save', 'error');
      return;
    }
    
    await batchSaveMutation.mutateAsync(recordsToSave);
  };

  // Generate journal rows based on payroll data
  const generateJournalRows = () => {
    const rows: any[] = [];
    const lastDayOfMonth = endOfMonth(selectedDate);
    const formattedDate = format(lastDayOfMonth, 'yyyy-MM-dd');
    const monthYear = format(selectedDate, 'MMM yyyy');
    
    // Generate document number based on month
    const documentNo = `P${selectedDate.getMonth() + 1}/${selectedDate.getFullYear()}`;
    
    // Process each resource that has allocations
    groupedResources.forEach(group => {
      group.resources.forEach(resource => {
        const projectAllocations = getProjectAllocations(resource.ResourceID);
        
        // Get entity codes for the resource's entity
        const entity = entities?.find(e => e.ID === resource.EntityID);
        const salExpCode = entity?.SalExpCode || '6000'; // Default salary expense code
        const ssExpCode = entity?.SSExpCode || '6100';  // Default social security expense code  
        const taxExpCode = entity?.TaxExpCode || '6200'; // Default tax expense code
        
        // Get payroll amounts
        const netSalary = getFieldValue(resource.ResourceID, 'NetSalary', 0) || 0;
        const socialSecurity = getFieldValue(resource.ResourceID, 'SocialSecurity', 0) || 0;
        const employeeTax = getFieldValue(resource.ResourceID, 'EmployeeTax', 0) || 0;
        const employerTax = getFieldValue(resource.ResourceID, 'EmployerTax', 0) || 0;
        const housing = getFieldValue(resource.ResourceID, 'Housing', 0) || 0;
        const commsOther = getFieldValue(resource.ResourceID, 'CommunicationsOther', 0) || 0;
        
        // Create rows for each payroll component and project allocation
        Object.entries(projectAllocations).forEach(([projectId, allocationValue]) => {
          const project = payrollProjects?.find(p => p.ID === projectId);
          const projectName = project?.Name || 'Unknown Project';
          
          // Only create rows if allocation value exists
          if (allocationValue > 0) {
            // Net Salary row
            if (netSalary > 0) {
              rows.push({
                Journal_Batch_Name: '',
                Line_No: '',
                Gen_Posting_Type: salExpCode.startsWith('6') ? 'Purchase' : '',
                Posting_Date: formattedDate,
                Document_Date: formattedDate,
                Invoice_Date: formattedDate,
                Document_No: documentNo,
                Vendor_Invoice_Ref: documentNo,
                External_Document_No: documentNo,
                Account_Type: salExpCode.startsWith('6') ? 'G/L Account' : salExpCode.startsWith('1') ? 'Vendor' : '',
                Account_No: salExpCode,
                Description: `${resource.ResourceName} Salary for ${monthYear}`,
                Vendor_Name: resource.ResourceName,
                Transaction_Currency: resource.Currency || 'USD',
                Currency_Code: resource.Currency || 'USD',
                Transaction_Amount: netSalary.toFixed(2),
                Amount: netSalary.toFixed(2),
                Project_Quantity: '1',
                Project_No: projectName,
                Project_Task_No: ''
              });
            }
            
            // Social Security row
            if (socialSecurity > 0) {
              rows.push({
                Journal_Batch_Name: '',
                Line_No: '',
                Gen_Posting_Type: ssExpCode.startsWith('6') ? 'Purchase' : '',
                Posting_Date: formattedDate,
                Document_Date: formattedDate,
                Invoice_Date: formattedDate,
                Document_No: documentNo,
                Vendor_Invoice_Ref: documentNo,
                External_Document_No: documentNo,
                Account_Type: ssExpCode.startsWith('6') ? 'G/L Account' : ssExpCode.startsWith('1') ? 'Vendor' : '',
                Account_No: ssExpCode,
                Description: `${resource.ResourceName} Social Security for ${monthYear}`,
                Vendor_Name: resource.ResourceName,
                Transaction_Currency: resource.Currency || 'USD',
                Currency_Code: resource.Currency || 'USD',
                Transaction_Amount: socialSecurity.toFixed(2),
                Amount: socialSecurity.toFixed(2),
                Project_Quantity: '1',
                Project_No: projectName,
                Project_Task_No: ''
              });
            }
            
            // Employee Tax row
            if (employeeTax > 0) {
              rows.push({
                Journal_Batch_Name: '',
                Line_No: '',
                Gen_Posting_Type: taxExpCode.startsWith('6') ? 'Purchase' : '',
                Posting_Date: formattedDate,
                Document_Date: formattedDate,
                Invoice_Date: formattedDate,
                Document_No: documentNo,
                Vendor_Invoice_Ref: documentNo,
                External_Document_No: documentNo,
                Account_Type: taxExpCode.startsWith('6') ? 'G/L Account' : taxExpCode.startsWith('1') ? 'Vendor' : '',
                Account_No: taxExpCode,
                Description: `${resource.ResourceName} Employee tax for ${monthYear}`,
                Vendor_Name: resource.ResourceName,
                Transaction_Currency: resource.Currency || 'USD',
                Currency_Code: resource.Currency || 'USD',
                Transaction_Amount: employeeTax.toFixed(2),
                Amount: employeeTax.toFixed(2),
                Project_Quantity: '1',
                Project_No: projectName,
                Project_Task_No: ''
              });
            }
            
            // Employer Tax row
            if (employerTax > 0) {
              rows.push({
                Journal_Batch_Name: '',
                Line_No: '',
                Gen_Posting_Type: taxExpCode.startsWith('6') ? 'Purchase' : '',
                Posting_Date: formattedDate,
                Document_Date: formattedDate,
                Invoice_Date: formattedDate,
                Document_No: documentNo,
                Vendor_Invoice_Ref: documentNo,
                External_Document_No: documentNo,
                Account_Type: taxExpCode.startsWith('6') ? 'G/L Account' : taxExpCode.startsWith('1') ? 'Vendor' : '',
                Account_No: taxExpCode,
                Description: `${resource.ResourceName} Employer tax for ${monthYear}`,
                Vendor_Name: resource.ResourceName,
                Transaction_Currency: resource.Currency || 'USD',
                Currency_Code: resource.Currency || 'USD',
                Transaction_Amount: employerTax.toFixed(2),
                Amount: employerTax.toFixed(2),
                Project_Quantity: '1',
                Project_No: projectName,
                Project_Task_No: ''
              });
            }
            
            // Housing row
            if (housing > 0) {
              rows.push({
                Journal_Batch_Name: '',
                Line_No: '',
                Gen_Posting_Type: salExpCode.startsWith('6') ? 'Purchase' : '',
                Posting_Date: formattedDate,
                Document_Date: formattedDate,
                Invoice_Date: formattedDate,
                Document_No: documentNo,
                Vendor_Invoice_Ref: documentNo,
                External_Document_No: documentNo,
                Account_Type: salExpCode.startsWith('6') ? 'G/L Account' : salExpCode.startsWith('1') ? 'Vendor' : '',
                Account_No: salExpCode,
                Description: `${resource.ResourceName} Housing for ${monthYear}`,
                Vendor_Name: resource.ResourceName,
                Transaction_Currency: resource.Currency || 'USD',
                Currency_Code: resource.Currency || 'USD',
                Transaction_Amount: housing.toFixed(2),
                Amount: housing.toFixed(2),
                Project_Quantity: '1',
                Project_No: projectName,
                Project_Task_No: ''
              });
            }
            
            // Comms/Other row
            if (commsOther > 0) {
              rows.push({
                Journal_Batch_Name: '',
                Line_No: '',
                Gen_Posting_Type: salExpCode.startsWith('6') ? 'Purchase' : '',
                Posting_Date: formattedDate,
                Document_Date: formattedDate,
                Invoice_Date: formattedDate,
                Document_No: documentNo,
                Vendor_Invoice_Ref: documentNo,
                External_Document_No: documentNo,
                Account_Type: salExpCode.startsWith('6') ? 'G/L Account' : salExpCode.startsWith('1') ? 'Vendor' : '',
                Account_No: salExpCode,
                Description: `${resource.ResourceName} Comms Allowance for ${monthYear}`,
                Vendor_Name: resource.ResourceName,
                Transaction_Currency: resource.Currency || 'USD',
                Currency_Code: resource.Currency || 'USD',
                Transaction_Amount: commsOther.toFixed(2),
                Amount: commsOther.toFixed(2),
                Project_Quantity: '1',
                Project_No: projectName,
                Project_Task_No: ''
              });
            }
          }
        });
      });
    });
    
    return rows;
  };

  // Save a single record
  const handleSaveRecord = async (resource: PayrollResource) => {
    const editedData = editedRecords.get(resource.ResourceID) || {};
    const existingRecord = recordsByResource.get(resource.ResourceID);
    
    const workingDays = calculateWorkingDays(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      resource.WorkDays
    );
    
    // Determine the project allocations JSON to save
    let projectAllocationsJson = editedData.ProjectAllocations || existingRecord?.ProjectAllocations || null;
    
    // Build the record data - combine existing and edited fields
    const recordData: Partial<PayrollRecord> = {
      ResourceID: resource.ResourceID,
      Department: resource.Department || null,
      EntityID: resource.EntityID || null,
      WorkingDays: workingDays.toString(),
      Currency: editedData.Currency !== undefined ? editedData.Currency : (existingRecord?.Currency || resource.Currency || null),
      NetSalary: editedData.NetSalary !== undefined ? editedData.NetSalary : existingRecord?.NetSalary,
      SocialSecurity: editedData.SocialSecurity !== undefined ? editedData.SocialSecurity : existingRecord?.SocialSecurity,
      EmployeeTax: editedData.EmployeeTax !== undefined ? editedData.EmployeeTax : existingRecord?.EmployeeTax,
      EmployerTax: editedData.EmployerTax !== undefined ? editedData.EmployerTax : existingRecord?.EmployerTax,
      Housing: editedData.Housing !== undefined ? editedData.Housing : existingRecord?.Housing,
      CommunicationsOther: editedData.CommunicationsOther !== undefined ? editedData.CommunicationsOther : existingRecord?.CommunicationsOther,
      AnnualLeave: editedData.AnnualLeave !== undefined ? editedData.AnnualLeave : existingRecord?.AnnualLeave,
      SickLeave: editedData.SickLeave !== undefined ? editedData.SickLeave : existingRecord?.SickLeave,
      PublicHolidays: editedData.PublicHolidays !== undefined ? editedData.PublicHolidays : existingRecord?.PublicHolidays,
      Month: monthParam,
      ProjectAllocations: projectAllocationsJson,
    };
    
    await saveMutation.mutateAsync(recordData);
    
    // Clear edited data for this resource after successful save
    setEditedRecords(prev => {
      const newMap = new Map(prev);
      newMap.delete(resource.ResourceID);
      return newMap;
    });
  };

  // Toggle entity expansion
  const toggleEntity = (entityId: string) => {
    setExpandedEntities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entityId)) {
        newSet.delete(entityId);
      } else {
        newSet.add(entityId);
      }
      return newSet;
    });
  };

  // Toggle lock/unlock functionality
  const toggleLock = () => {
    setIsLocked(prev => {
      const newLockedState = !prev;
      showNotification(
        newLockedState ? 'All cells locked for editing' : 'All cells unlocked for editing', 
        'success'
      );
      return newLockedState;
    });
  };

  // Convert project allocations to percentages for all resources (toggle on/off)
  const convertProjectsToPercentage = () => {
    if (isPercentageMode) {
      // Toggle back to original values - remove entity averages
      groupedResources.forEach(group => {
        group.resources.forEach(resource => {
          const original = originalAllocations.get(resource.ResourceID);
          if (original) {
            // Restore original allocations
            const restoredAllocations: Record<string, number> = {};
            Object.entries(original).forEach(([projectId, value]) => {
              restoredAllocations[projectId] = value;
            });
            handleFieldChange(resource.ResourceID, 'ProjectAllocations', JSON.stringify(restoredAllocations));
          }
        });
      });
      setIsPercentageMode(false);
      setEntityAverages(new Map()); // Clear entity averages
      showNotification('Project allocations reverted to original values', 'success');
    } else {
      // Convert to percentages and calculate entity averages
      const newOriginalAllocations = new Map<string, Record<string, number>>();
      const newEntityAverages = new Map<string, Record<string, number>>();
      
      groupedResources.forEach(group => {
        // Calculate averages for this entity across all its resources
        const entityProjectTotals: Record<string, number[]> = {};
        
        group.resources.forEach(resource => {
          const projectAllocations = getProjectAllocations(resource.ResourceID);
          // Save original allocations
          newOriginalAllocations.set(resource.ResourceID, { ...projectAllocations });
          
          // Calculate total allocation for this resource
          const total = Object.values(projectAllocations).reduce((sum, val) => sum + val, 0);
          
          if (total > 0) {
            // Convert each allocation to percentage of total for this resource
            const percentageAllocations: Record<string, number> = {};
            Object.entries(projectAllocations).forEach(([projectId, value]) => {
              const percentage = (value / total) * 100;
              percentageAllocations[projectId] = Math.round(percentage * 100) / 100;
              
              // Track percentages by project for averaging
              if (!entityProjectTotals[projectId]) {
                entityProjectTotals[projectId] = [];
              }
              entityProjectTotals[projectId].push(percentage);
            });
            handleFieldChange(resource.ResourceID, 'ProjectAllocations', JSON.stringify(percentageAllocations));
          }
        });
        
        // Calculate average percentages for each project in this entity
        const entityAveragePercentages: Record<string, number> = {};
        Object.entries(entityProjectTotals).forEach(([projectId, percentages]) => {
          const average = percentages.reduce((sum, val) => sum + val, 0) / percentages.length;
          entityAveragePercentages[projectId] = Math.round(average * 100) / 100;
        });
        
        newEntityAverages.set(group.entityId, entityAveragePercentages);
      });
      
      setOriginalAllocations(newOriginalAllocations);
      setEntityAverages(newEntityAverages);
      setIsPercentageMode(true);
      showNotification('Project allocations converted to percentages with entity averages', 'success');
    }
  };

  // Refresh data
  const handleRefresh = () => {
    refetchResources();
    refetchRecords();
    showNotification('Data refreshed', 'success');
  };

  // Check if a resource has unsaved changes
  const hasUnsavedChanges = (resourceId: string): boolean => {
    return editedRecords.has(resourceId) && Object.keys(editedRecords.get(resourceId)!).length > 0;
  };

  // Helper functions for project allocations
  const getProjectAllocations = useCallback((resourceId: string): Record<string, number> => {
    const editedRecord = editedRecords.get(resourceId);
    if (editedRecord && 'ProjectAllocations' in editedRecord) {
      try {
        return JSON.parse(editedRecord.ProjectAllocations || '{}');
      } catch {
        return {};
      }
    }
    
    const existingRecord = recordsByResource.get(resourceId);
    if (existingRecord && existingRecord.ProjectAllocations) {
      try {
        return JSON.parse(existingRecord.ProjectAllocations);
      } catch {
        return {};
      }
    }
    
    return {};
  }, [editedRecords, recordsByResource]);

  const setProjectAllocation = useCallback((resourceId: string, projectId: string, value: number) => {
    const currentAllocations = getProjectAllocations(resourceId);
    const newAllocations = { ...currentAllocations };
    
    if (value === 0 || value === null || value === undefined) {
      delete newAllocations[projectId];
    } else {
      newAllocations[projectId] = value;
    }
    
    setEditedRecords(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(resourceId) || {};
      newMap.set(resourceId, {
        ...existing,
        ProjectAllocations: JSON.stringify(newAllocations)
      });
      return newMap;
    });
  }, [getProjectAllocations]);

  // Excel Export function
  const handleExportToExcel = () => {
    if (!payrollResources || !payrollProjects) return;

    const worksheet = XLSX.utils.json_to_sheet([]);

    // Add headers
    const headers = [
      'Entity Name',
      'Resource Name', 
      'Work Days',
      'Currency',
      'Net Salary',
      'Social Security',
      'Employee Tax',
      'Employer Tax',
      'Housing',
      'Communications/Other',
      'Annual Leave',
      'Sick Leave',
      'Public Holidays',
      'Daily Rate',
      ...payrollProjects.map(p => p.Name)
    ];

    XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: 'A1' });

    // Add data rows
    let rowIndex = 2;
    groupedResources.forEach(group => {
      group.resources.forEach(resource => {
        const workingDays = calculateWorkingDays(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          resource.WorkDays
        );

        const projectAllocations = getProjectAllocations(resource.ResourceID);
        const netSalary = getFieldValue(resource.ResourceID, 'NetSalary', null);
        const dailyRate = calculateDailyRate(netSalary);

        const row = [
          group.entityName,
          resource.ResourceName,
          workingDays,
          getFieldValue(resource.ResourceID, 'Currency', '') || resource.Currency || '',
          getFieldValue(resource.ResourceID, 'NetSalary', '') || '',
          getFieldValue(resource.ResourceID, 'SocialSecurity', '') || '',
          getFieldValue(resource.ResourceID, 'EmployeeTax', '') || '',
          getFieldValue(resource.ResourceID, 'EmployerTax', '') || '',
          getFieldValue(resource.ResourceID, 'Housing', '') || '',
          getFieldValue(resource.ResourceID, 'CommunicationsOther', '') || '',
          getFieldValue(resource.ResourceID, 'AnnualLeave', '') || '',
          getFieldValue(resource.ResourceID, 'SickLeave', '') || '',
          getFieldValue(resource.ResourceID, 'PublicHolidays', '') || '',
          dailyRate ? dailyRate.toFixed(2) : '',
          ...payrollProjects.map(p => projectAllocations[p.ID] || 0)
        ];

        XLSX.utils.sheet_add_aoa(worksheet, [row], { origin: `A${rowIndex}` });
        rowIndex++;
      });
    });

    // Create workbook and save
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Payroll ${format(selectedDate, 'MMM yyyy')}`);
    XLSX.writeFile(workbook, `Payroll_Allocation_${format(selectedDate, 'yyyy-MM')}.xlsx`);
  };

  // Excel Import function
  const handleImportFromExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        // Build project column mapping based on column order (projects start at index 14)
        // Maps column index to project ID based on the order in payrollProjects
        const projectColumnMap: { columnIndex: number; projectId: string }[] = [];
        if (payrollProjects) {
          payrollProjects.forEach((project, projectIndex) => {
            projectColumnMap.push({
              columnIndex: 14 + projectIndex,
              projectId: project.ID
            });
          });
        }

        // Skip header row and process data
        jsonData.slice(1).forEach((row) => {
          if (row.length === 0 || !row[1]) return; // Skip empty rows

          const resourceName = row[1];
          const resource = payrollResources?.find(r => r.ResourceName === resourceName);
          
          if (resource) {
            // Update all fields
            handleFieldChange(resource.ResourceID, 'Currency', row[3] || null);
            handleFieldChange(resource.ResourceID, 'NetSalary', row[4] ? parseFloat(row[4]) : null);
            handleFieldChange(resource.ResourceID, 'SocialSecurity', row[5] ? parseFloat(row[5]) : null);
            handleFieldChange(resource.ResourceID, 'EmployeeTax', row[6] ? parseFloat(row[6]) : null);
            handleFieldChange(resource.ResourceID, 'EmployerTax', row[7] ? parseFloat(row[7]) : null);
            handleFieldChange(resource.ResourceID, 'Housing', row[8] ? parseFloat(row[8]) : null);
            handleFieldChange(resource.ResourceID, 'CommunicationsOther', row[9] ? parseFloat(row[9]) : null);
            handleFieldChange(resource.ResourceID, 'AnnualLeave', row[10] ? parseInt(row[10]) : null);
            handleFieldChange(resource.ResourceID, 'SickLeave', row[11] ? parseInt(row[11]) : null);
            handleFieldChange(resource.ResourceID, 'PublicHolidays', row[12] ? parseInt(row[12]) : null);
            // Daily Rate is at column 13 (index 13) - this is calculated, not stored
            // Projects start at column 14 (index 14) after Daily Rate

            // Update project allocations using strict column order
            // Column 14 = first project in payrollProjects, Column 15 = second project, etc.
            const projectAllocations: Record<string, number> = {};
            projectColumnMap.forEach(({ columnIndex, projectId }) => {
              const value = row[columnIndex];
              if (value !== undefined && value !== null && value !== '') {
                const parsed = parseFloat(value);
                if (!isNaN(parsed) && parsed > 0) {
                  projectAllocations[projectId] = parsed;
                }
              }
            });

            // Set all project allocations at once by updating the JSON field directly
            if (Object.keys(projectAllocations).length > 0) {
              handleFieldChange(resource.ResourceID, 'ProjectAllocations', JSON.stringify(projectAllocations));
            }
          }
        });

        showNotification('Excel data imported successfully!', 'success');
      } catch (error) {
        showNotification('Error importing Excel file', 'error');
      }
    };

    reader.readAsArrayBuffer(file);
    // Reset file input
    event.target.value = '';
  };

  const isLoading = resourcesLoading || recordsLoading || projectsLoading;

  return (
    <Box sx={{ p: 1 }}>
      <Card sx={{ mb: 1 }}>
        <CardContent sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" gutterBottom sx={{ fontSize: '1.1rem' }}>
              Payroll Allocation - {format(selectedDate, 'MMMM yyyy')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title={isLocked ? "Unlock All Cells" : "Lock All Cells"}>
                <span>
                  <IconButton 
                    onClick={toggleLock} 
                    disabled={isLoading} 
                    size="small"
                    color={isLocked ? "warning" : "default"}
                  >
                    {isLocked ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={isPercentageMode ? "Revert to Original Values" : "Convert to Percentages"}>
                <span>
                  <IconButton 
                    onClick={convertProjectsToPercentage} 
                    disabled={isLoading} 
                    size="small"
                    color={isPercentageMode ? "success" : "default"}
                  >
                    <PercentIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Batch Save All Changes">
                <span>
                  <IconButton 
                    onClick={handleBatchSave} 
                    disabled={isLoading || editedRecords.size === 0 || batchSaveMutation.isPending} 
                    size="small"
                    color="primary"
                  >
                    <SaveAltIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportFromExcel}
                style={{ display: 'none' }}
                id="excel-import-input"
              />
              <label htmlFor="excel-import-input">
                <Tooltip title="Import from Excel">
                  <span>
                    <IconButton component="span" size="small" disabled={isLoading}>
                      <UploadIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </label>
              <Tooltip title="Export to Excel">
                <span>
                  <IconButton onClick={handleExportToExcel} disabled={isLoading} size="small">
                    <DownloadIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Generate Journal">
                <span>
                  <IconButton onClick={() => setJournalDialogOpen(true)} disabled={isLoading} size="small">
                    <SaveAltIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Refresh data">
                <span>
                  <IconButton onClick={handleRefresh} disabled={isLoading} size="small">
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
            Resources with allocations for selected month. Work days auto-calculated.
          </Typography>
        </CardContent>
      </Card>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : groupedResources.length === 0 ? (
        <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
          No resources found with allocations for {format(selectedDate, 'MMMM yyyy')}.
        </Alert>
      ) : (
        <TableContainer component={Paper} sx={{ maxHeight: '70vh' }}>
          <Table size="small" sx={{ 
            minWidth: 1000, 
            fontSize: '0.7rem',
            borderCollapse: 'collapse',
            '& .MuiTableCell-root': {
              border: '1px solid #e0e0e0',
              padding: '2px 4px',
              height: '24px',
              verticalAlign: 'middle',
              textAlign: 'left',
              boxSizing: 'border-box'
            }
          }}>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell colSpan={9} sx={{ fontWeight: 'bold', fontSize: '0.8rem', py: 1, px: 1, height: '32px', backgroundColor: '#e3f2fd', border: '1px solid #ccc', textAlign: 'center', verticalAlign: 'middle' }}>Payroll</TableCell>
                <TableCell colSpan={4} sx={{ fontWeight: 'bold', fontSize: '0.8rem', py: 1, px: 1, height: '32px', backgroundColor: '#f0f4c3', border: '1px solid #ccc', textAlign: 'center', verticalAlign: 'middle' }}>Fringe</TableCell>
                <TableCell colSpan={payrollProjects?.length || 0} sx={{ fontWeight: 'bold', fontSize: '0.8rem', py: 1, px: 1, height: '32px', backgroundColor: '#e8f5e8', border: '1px solid #ccc', textAlign: 'center', verticalAlign: 'middle' }}>Projects</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '0.8rem', py: 1, px: 1, height: '32px', backgroundColor: '#f0f0f0', border: '1px solid #ccc', textAlign: 'center', verticalAlign: 'middle' }}></TableCell>
              </TableRow>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell sx={{ fontWeight: 'bold', minWidth: '110px', width: '110px', fontSize: '0.7rem', py: 0, px: 1, height: '28px', backgroundColor: '#f0f0f0', border: '1px solid #ccc' }}>Resource Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '40px', fontSize: '0.7rem', py: 0, px: 1, height: '28px', backgroundColor: '#f0f0f0', border: '1px solid #ccc' }}>Work Days</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '40px', fontSize: '0.7rem', py: 0, px: 1, height: '28px', backgroundColor: '#f0f0f0', border: '1px solid #ccc' }}>Currency</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '45px', fontSize: '0.7rem', py: 0, px: 1, height: '28px', backgroundColor: '#f0f0f0', border: '1px solid #ccc' }}>Net Salary</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '45px', fontSize: '0.7rem', py: 0, px: 1, height: '28px', backgroundColor: '#f0f0f0', border: '1px solid #ccc' }}>Social Security</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '45px', fontSize: '0.7rem', py: 0, px: 1, height: '28px', backgroundColor: '#f0f0f0', border: '1px solid #ccc' }}>Employee Tax</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '45px', fontSize: '0.7rem', py: 0, px: 1, height: '28px', backgroundColor: '#f0f0f0', border: '1px solid #ccc' }}>Employer Tax</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '45px', fontSize: '0.7rem', py: 0, px: 1, height: '28px', backgroundColor: '#f0f0f0', border: '1px solid #ccc' }}>Housing</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '45px', fontSize: '0.7rem', py: 0, px: 1, height: '28px', backgroundColor: '#f0f0f0', border: '1px solid #ccc' }}>Comm/Other</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '45px', fontSize: '0.7rem', py: 0, px: 1, height: '28px', backgroundColor: '#f0f0f0', border: '1px solid #ccc' }}>Annual Leave</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '45px', fontSize: '0.7rem', py: 0, px: 1, height: '28px', backgroundColor: '#f0f0f0', border: '1px solid #ccc' }}>Sick Leave</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '45px', fontSize: '0.7rem', py: 0, px: 1, height: '28px', backgroundColor: '#f0f0f0', border: '1px solid #ccc' }}>Public Holidays</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '45px', fontSize: '0.7rem', py: 0, px: 1, height: '28px', backgroundColor: '#f0f0f0', border: '1px solid #ccc' }}>Daily Rate</TableCell>
                {/* Dynamic Project Columns */}
                {payrollProjects?.map((project) => (
                  <TableCell key={project.ID} sx={{ fontWeight: 'bold', width: '50px', fontSize: '0.7rem', py: 0, px: 1, height: '28px', backgroundColor: '#e8f5e8', border: '1px solid #ccc' }}>
                    {project.Name}
                  </TableCell>
                ))}
                <TableCell sx={{ fontWeight: 'bold', width: '40px', fontSize: '0.7rem', py: 0, px: 1, height: '28px', backgroundColor: '#f0f0f0', border: '1px solid #ccc' }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groupedResources.map((group) => (
                <React.Fragment key={`group-${group.entityId}`}>
                  {/* Entity Header Row */}
                  <TableRow 
                    sx={{ 
                      backgroundColor: '#e3f2fd',
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: '#bbdefb' }
                    }}
                    onClick={() => toggleEntity(group.entityId)}
                  >
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', py: 0, px: 1, height: '24px', backgroundColor: '#e8f4fd', border: '1px solid #ccc', minWidth: '110px', width: '110px' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {expandedEntities.has(group.entityId) ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        {group.entityName}
                      </Box>
                    </TableCell>
                    {/* Empty cells for remaining Payroll columns */}
                    <TableCell sx={{ backgroundColor: '#e8f4fd', border: '1px solid #ccc', width: '40px', py: 0, px: 1, height: '24px' }}></TableCell>
                    <TableCell sx={{ backgroundColor: '#e8f4fd', border: '1px solid #ccc', width: '40px', py: 0, px: 1, height: '24px' }}></TableCell>
                    <TableCell sx={{ backgroundColor: '#e8f4fd', border: '1px solid #ccc', width: '45px', py: 0, px: 1, height: '24px' }}></TableCell>
                    <TableCell sx={{ backgroundColor: '#e8f4fd', border: '1px solid #ccc', width: '45px', py: 0, px: 1, height: '24px' }}></TableCell>
                    <TableCell sx={{ backgroundColor: '#e8f4fd', border: '1px solid #ccc', width: '45px', py: 0, px: 1, height: '24px' }}></TableCell>
                    <TableCell sx={{ backgroundColor: '#e8f4fd', border: '1px solid #ccc', width: '45px', py: 0, px: 1, height: '24px' }}></TableCell>
                    <TableCell sx={{ backgroundColor: '#e8f4fd', border: '1px solid #ccc', width: '45px', py: 0, px: 1, height: '24px' }}></TableCell>
                    <TableCell sx={{ backgroundColor: '#e8f4fd', border: '1px solid #ccc', width: '45px', py: 0, px: 1, height: '24px' }}></TableCell>
                    {/* Empty cells for Fringe columns */}
                    <TableCell sx={{ backgroundColor: '#e8f4fd', border: '1px solid #ccc', width: '45px', py: 0, px: 1, height: '24px' }}></TableCell>
                    <TableCell sx={{ backgroundColor: '#e8f4fd', border: '1px solid #ccc', width: '45px', py: 0, px: 1, height: '24px' }}></TableCell>
                    <TableCell sx={{ backgroundColor: '#e8f4fd', border: '1px solid #ccc', width: '45px', py: 0, px: 1, height: '24px' }}></TableCell>
                    <TableCell sx={{ backgroundColor: '#e8f4fd', border: '1px solid #ccc', width: '45px', py: 0, px: 1, height: '24px' }}></TableCell>
                    {/* Entity Average Columns for Projects */}
                    {payrollProjects?.map((project) => {
                      const averages = entityAverages.get(group.entityId);
                      const averageValue = averages?.[project.ID] || 0;
                      
                      return (
                        <TableCell 
                          key={`entity-avg-${project.ID}`}
                          sx={{ 
                            fontSize: '0.7rem', 
                            py: 0, 
                            px: 1, 
                            height: '24px', 
                            border: '1px solid #ccc', 
                            width: '50px',
                            backgroundColor: isPercentageMode && averageValue > 0 ? '#d4edda' : '#f0f8f0',
                            fontWeight: isPercentageMode && averageValue > 0 ? 'bold' : 'normal',
                            textAlign: 'center'
                          }}
                        >
                          {isPercentageMode && averageValue > 0 ? `${averageValue}%` : ''}
                        </TableCell>
                      );
                    })}
                    {/* Empty cell for Save button column */}
                    <TableCell sx={{ backgroundColor: '#e8f4fd', border: '1px solid #ccc', width: '40px', py: 0, px: 1, height: '24px' }}></TableCell>
                  </TableRow>
                  
                  {/* Resource Rows */}
                  {expandedEntities.has(group.entityId) && group.resources.map((resource) => {
                    const workingDays = calculateWorkingDays(
                      selectedDate.getFullYear(),
                      selectedDate.getMonth(),
                      resource.WorkDays
                    );
                    
                    return (
                      <TableRow 
                        key={resource.ResourceID}
                        sx={{ 
                          backgroundColor: hasUnsavedChanges(resource.ResourceID) ? '#fff3e0' : 'inherit',
                          '&:hover': { backgroundColor: '#f5f5f5' }
                        }}
                      >
                        <TableCell sx={{ fontSize: '0.7rem', py: 0, px: 1, height: '24px', border: '1px solid #e0e0e0', minWidth: '110px', width: '110px', backgroundColor: '#f3f8ff' }}>{resource.ResourceName}</TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', py: 0, px: 1, height: '24px', border: '1px solid #e0e0e0', width: '40px', backgroundColor: '#f3f8ff' }}>{workingDays}</TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', py: 0, px: 1, height: '24px', border: '1px solid #e0e0e0', width: '40px', backgroundColor: '#f3f8ff' }}>
                          <input
                            type="text"
                            value={getFieldValue(resource.ResourceID, 'Currency', '') || resource.Currency || ''}
                            onChange={(e) => handleFieldChange(resource.ResourceID, 'Currency', e.target.value)}
                            disabled={isLocked}
                            style={{
                              width: '100%',
                              border: 'none',
                              outline: 'none',
                              background: 'transparent',
                              fontSize: '0.65rem',
                              height: '20px',
                              padding: '0',
                              color: 'inherit'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', py: 0, px: 1, height: '24px', border: '1px solid #e0e0e0', width: '45px', backgroundColor: '#f3f8ff' }}>
                          <input
                            type="number"
                            step="0.01"
                            value={getFieldValue(resource.ResourceID, 'NetSalary', '') || ''}
                            onChange={(e) => handleFieldChange(resource.ResourceID, 'NetSalary', e.target.value ? parseFloat(e.target.value) : null)}
                            disabled={isLocked}
                            style={{
                              width: '100%',
                              border: 'none',
                              outline: 'none',
                              background: 'transparent',
                              fontSize: '0.65rem',
                              height: '20px',
                              padding: '0',
                              color: 'inherit'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', py: 0, px: 1, height: '24px', border: '1px solid #e0e0e0', width: '45px', backgroundColor: '#f3f8ff' }}>
                          <input
                            type="number"
                            step="0.01"
                            value={getFieldValue(resource.ResourceID, 'SocialSecurity', '') || ''}
                            onChange={(e) => handleFieldChange(resource.ResourceID, 'SocialSecurity', e.target.value ? parseFloat(e.target.value) : null)}
                            disabled={isLocked}
                            style={{
                              width: '100%',
                              border: 'none',
                              outline: 'none',
                              background: 'transparent',
                              fontSize: '0.65rem',
                              height: '20px',
                              padding: '0',
                              color: 'inherit'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', py: 0, px: 1, height: '24px', border: '1px solid #e0e0e0', width: '45px', backgroundColor: '#f3f8ff' }}>
                          <input
                            type="number"
                            step="0.01"
                            value={getFieldValue(resource.ResourceID, 'EmployeeTax', '') || ''}
                            onChange={(e) => handleFieldChange(resource.ResourceID, 'EmployeeTax', e.target.value ? parseFloat(e.target.value) : null)}
                            disabled={isLocked}
                            style={{
                              width: '100%',
                              border: 'none',
                              outline: 'none',
                              background: 'transparent',
                              fontSize: '0.65rem',
                              height: '20px',
                              padding: '0',
                              color: 'inherit'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', py: 0, px: 1, height: '24px', border: '1px solid #e0e0e0', width: '45px', backgroundColor: '#f3f8ff' }}>
                          <input
                            type="number"
                            step="0.01"
                            value={getFieldValue(resource.ResourceID, 'EmployerTax', '') || ''}
                            onChange={(e) => handleFieldChange(resource.ResourceID, 'EmployerTax', e.target.value ? parseFloat(e.target.value) : null)}
                            disabled={isLocked}
                            style={{
                              width: '100%',
                              border: 'none',
                              outline: 'none',
                              background: 'transparent',
                              fontSize: '0.65rem',
                              height: '20px',
                              padding: '0',
                              color: 'inherit'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', py: 0, px: 1, height: '24px', border: '1px solid #e0e0e0', width: '45px', backgroundColor: '#f3f8ff' }}>
                          <input
                            type="number"
                            step="0.01"
                            value={getFieldValue(resource.ResourceID, 'Housing', '') || ''}
                            onChange={(e) => handleFieldChange(resource.ResourceID, 'Housing', e.target.value ? parseFloat(e.target.value) : null)}
                            disabled={isLocked}
                            style={{
                              width: '100%',
                              border: 'none',
                              outline: 'none',
                              background: 'transparent',
                              fontSize: '0.65rem',
                              height: '20px',
                              padding: '0',
                              color: 'inherit'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', py: 0, px: 1, height: '24px', border: '1px solid #e0e0e0', width: '45px', backgroundColor: '#f3f8ff' }}>
                          <input
                            type="number"
                            step="0.01"
                            value={getFieldValue(resource.ResourceID, 'CommunicationsOther', '') || ''}
                            onChange={(e) => handleFieldChange(resource.ResourceID, 'CommunicationsOther', e.target.value ? parseFloat(e.target.value) : null)}
                            disabled={isLocked}
                            style={{
                              width: '100%',
                              border: 'none',
                              outline: 'none',
                              background: 'transparent',
                              fontSize: '0.65rem',
                              height: '20px',
                              padding: '0',
                              color: 'inherit'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', py: 0, px: 1, height: '24px', border: '1px solid #e0e0e0', width: '45px', backgroundColor: '#fcf8e3' }}>
                          <input
                            type="number"
                            value={getFieldValue(resource.ResourceID, 'AnnualLeave', '') || ''}
                            onChange={(e) => handleFieldChange(resource.ResourceID, 'AnnualLeave', e.target.value ? parseInt(e.target.value) : null)}
                            disabled={isLocked}
                            style={{
                              width: '100%',
                              border: 'none',
                              outline: 'none',
                              background: 'transparent',
                              fontSize: '0.65rem',
                              height: '20px',
                              padding: '0',
                              color: 'inherit'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', py: 0, px: 1, height: '24px', border: '1px solid #e0e0e0', width: '45px', backgroundColor: '#fcf8e3' }}>
                          <input
                            type="number"
                            value={getFieldValue(resource.ResourceID, 'SickLeave', '') || ''}
                            onChange={(e) => handleFieldChange(resource.ResourceID, 'SickLeave', e.target.value ? parseInt(e.target.value) : null)}
                            disabled={isLocked}
                            style={{
                              width: '100%',
                              border: 'none',
                              outline: 'none',
                              background: 'transparent',
                              fontSize: '0.65rem',
                              height: '20px',
                              padding: '0',
                              color: 'inherit'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', py: 0, px: 1, height: '24px', border: '1px solid #e0e0e0', width: '45px', backgroundColor: '#fcf8e3' }}>
                          <input
                            type="number"
                            value={getFieldValue(resource.ResourceID, 'PublicHolidays', '') || ''}
                            onChange={(e) => handleFieldChange(resource.ResourceID, 'PublicHolidays', e.target.value ? parseInt(e.target.value) : null)}
                            disabled={isLocked}
                            style={{
                              width: '100%',
                              border: 'none',
                              outline: 'none',
                              background: 'transparent',
                              fontSize: '0.65rem',
                              height: '20px',
                              padding: '0',
                              color: 'inherit'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', py: 0, px: 1, height: '24px', border: '1px solid #e0e0e0', width: '45px', backgroundColor: '#fcf8e3' }}>
                          {(() => {
                            const netSalary = getFieldValue(resource.ResourceID, 'NetSalary', null);
                            const dailyRate = calculateDailyRate(netSalary);
                            return dailyRate ? dailyRate.toFixed(2) : '';
                          })()}
                        </TableCell>
                        {/* Dynamic Project Columns */}
                        {payrollProjects?.map((project) => {
                          const projectAllocations = getProjectAllocations(resource.ResourceID);
                          const allocationValue = projectAllocations[project.ID] || 0;
                          
                          return (
                            <TableCell key={project.ID} sx={{ fontSize: '0.7rem', py: 0, px: 1, height: '24px', border: '1px solid #e0e0e0', backgroundColor: '#f0f8f0', width: '50px' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2px' }}>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={allocationValue}
                                  onChange={(e) => setProjectAllocation(resource.ResourceID, project.ID, parseFloat(e.target.value) || 0)}
                                  disabled={isLocked || isPercentageMode}
                                  placeholder="0"
                                  style={{
                                    width: isPercentageMode ? '70%' : '100%',
                                    border: 'none',
                                    outline: 'none',
                                    background: 'transparent',
                                    fontSize: '0.65rem',
                                    height: '20px',
                                    padding: '0',
                                    color: 'inherit',
                                    cursor: isPercentageMode ? 'not-allowed' : 'inherit',
                                    opacity: isPercentageMode ? 0.6 : 1
                                  }}
                                />
                                {isPercentageMode && allocationValue > 0 && (
                                  <span style={{ fontSize: '0.6rem', fontWeight: 'bold', minWidth: '20px' }}>%</span>
                                )}
                              </Box>
                            </TableCell>
                          );
                        })}
                        <TableCell sx={{ fontSize: '0.7rem', py: 0, px: 1, height: '24px', border: '1px solid #e0e0e0', width: '40px', backgroundColor: '#f9f9f9' }}>
                          <Tooltip title="Save record">
                            <span>
                              <IconButton
                                size="small"
                                color={hasUnsavedChanges(resource.ResourceID) ? 'primary' : 'default'}
                                onClick={() => handleSaveRecord(resource)}
                                disabled={saveMutation.isPending}
                                sx={{ padding: '2px', height: '20px', width: '20px' }}
                              >
                                <SaveIcon fontSize="inherit" sx={{ fontSize: '14px' }} />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Snackbar
        open={notification.open}
        autoHideDuration={2000}
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setNotification(prev => ({ ...prev, open: false }))} 
          severity={notification.severity}
          sx={{ fontSize: '0.8rem' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>

      {/* Journal Dialog */}
      <Dialog 
        open={journalDialogOpen} 
        onClose={() => setJournalDialogOpen(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            height: '80vh',
            maxHeight: '80vh'
          }
        }}
      >
        <DialogTitle>
          <Typography variant="h6">
            Journal Entries - {format(selectedDate, 'MMMM yyyy')}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <TableContainer sx={{ maxHeight: '60vh', overflow: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '0.7rem', minWidth: '120px' }}>Journal_Batch_Name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '0.7rem', minWidth: '60px' }}>Line No.</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '0.7rem', minWidth: '100px' }}>Gen. Posting Type</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '0.7rem', minWidth: '100px' }}>Posting Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '0.7rem', minWidth: '100px' }}>Document Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '0.7rem', minWidth: '100px' }}>Invoice Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '0.7rem', minWidth: '120px' }}>Document No.</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '0.7rem', minWidth: '120px' }}>Vendor Invoice Ref.</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '0.7rem', minWidth: '140px' }}>External Document No.</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '0.7rem', minWidth: '100px' }}>Account Type</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '0.7rem', minWidth: '100px' }}>Account No.</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '0.7rem', minWidth: '200px' }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '0.7rem', minWidth: '150px' }}>Vendor Name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '0.7rem', minWidth: '120px' }}>Transaction Currency</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '0.7rem', minWidth: '100px' }}>Currency Code</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '0.7rem', minWidth: '120px' }}>Transaction Amount</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '0.7rem', minWidth: '100px' }}>Amount</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '0.7rem', minWidth: '100px' }}>Project Quantity</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '0.7rem', minWidth: '100px' }}>Project No.</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '0.7rem', minWidth: '120px' }}>Project Task No.</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {generateJournalRows().map((row, index) => (
                  <TableRow key={index}>
                    <TableCell sx={{ fontSize: '0.65rem' }}>{row.Journal_Batch_Name}</TableCell>
                    <TableCell sx={{ fontSize: '0.65rem' }}>{row.Line_No}</TableCell>
                    <TableCell sx={{ fontSize: '0.65rem' }}>{row.Gen_Posting_Type}</TableCell>
                    <TableCell sx={{ fontSize: '0.65rem' }}>{row.Posting_Date}</TableCell>
                    <TableCell sx={{ fontSize: '0.65rem' }}>{row.Document_Date}</TableCell>
                    <TableCell sx={{ fontSize: '0.65rem' }}>{row.Invoice_Date}</TableCell>
                    <TableCell sx={{ fontSize: '0.65rem' }}>{row.Document_No}</TableCell>
                    <TableCell sx={{ fontSize: '0.65rem' }}>{row.Vendor_Invoice_Ref}</TableCell>
                    <TableCell sx={{ fontSize: '0.65rem' }}>{row.External_Document_No}</TableCell>
                    <TableCell sx={{ fontSize: '0.65rem' }}>{row.Account_Type}</TableCell>
                    <TableCell sx={{ fontSize: '0.65rem' }}>{row.Account_No}</TableCell>
                    <TableCell sx={{ fontSize: '0.65rem' }}>{row.Description}</TableCell>
                    <TableCell sx={{ fontSize: '0.65rem' }}>{row.Vendor_Name}</TableCell>
                    <TableCell sx={{ fontSize: '0.65rem' }}>{row.Transaction_Currency}</TableCell>
                    <TableCell sx={{ fontSize: '0.65rem' }}>{row.Currency_Code}</TableCell>
                    <TableCell sx={{ fontSize: '0.65rem', textAlign: 'right' }}>{row.Transaction_Amount}</TableCell>
                    <TableCell sx={{ fontSize: '0.65rem', textAlign: 'right' }}>{row.Amount}</TableCell>
                    <TableCell sx={{ fontSize: '0.65rem', textAlign: 'right' }}>{row.Project_Quantity}</TableCell>
                    <TableCell sx={{ fontSize: '0.65rem' }}>{row.Project_No}</TableCell>
                    <TableCell sx={{ fontSize: '0.65rem' }}>{row.Project_Task_No}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJournalDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
