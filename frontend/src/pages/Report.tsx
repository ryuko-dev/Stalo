import { Box, Typography, Button, Card, CardContent, Chip, Tooltip, TextField, Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, CircularProgress, Autocomplete, Menu, MenuItem } from '@mui/material';
import { CloudSync as CloudSyncIcon, OpenInNew as OpenInNewIcon, FileDownload as FileDownloadIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect, Fragment } from 'react';
import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';

interface ProjectLedgerEntry {
  Donor_Project_No: string;
  Donor_Project_Task_No: string;
  Donor_Description: string;
  Planning_Description: string;
  Job_Task_Description: string;
  Document_No: string;
  External_Document_No: string | null;
  Posting_Date: string;
  Document_Date: string | null;
  Azz_Vendor_Name: string;
  Azz_Transaction_Currency: string;
  Azz_Transaction_Amount: number;
  Project_Currency: string;
  Task_Top_Description: string;
  Task_Middle_Description: string;
  Formula: number; // Amount in project currency
  Budget_Amount: number;
  Level1_Job_Task_No: string;
  Level1_Description: string;
  Level2_Job_Task_No: string;
  Level2_Description: string;
  Has_Middle_Level: boolean;
}

interface JobTaskHierarchy {
  Job_Task_No: string;
  Description: string;
  Level1_Job_Task_No: string;
  Level1_Description: string;
  Level2_Job_Task_No: string;
  Level2_Description: string;
  Has_Middle_Level: boolean;
  Budget_Amount: number;
}

interface GroupedData {
  [taskTop: string]: {
    [taskMiddle: string]: {
      [taskDetail: string]: {
        entries: ProjectLedgerEntry[];
        budget: number;
        jobTaskNo: string;
      };
    };
  };
}

interface BudgetVersion {
  Version_ID: number;
  Version_Name: string;
  Is_Baseline: boolean;
  Created_Date: string;
}

export default function Report() {
  const { isAuthenticated, login, logout, userDisplayName, isLoading: authLoading, error: authError, clearError } = useAuth();
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [projectOptions, setProjectOptions] = useState<string[]>([]);
  const [ledgerData, setLedgerData] = useState<ProjectLedgerEntry[]>([]);
  const [jobTaskHierarchy, setJobTaskHierarchy] = useState<JobTaskHierarchy[]>([]);
  const [budgetVersions, setBudgetVersions] = useState<BudgetVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; documentNo: string } | null>(null);

  // Fetch available projects on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchProjects();
    }
  }, [isAuthenticated]);

  // Fetch budget versions when project changes
  useEffect(() => {
    if (projectFilter) {
      fetchBudgetVersions(projectFilter);
    } else {
      setBudgetVersions([]);
      setSelectedVersion(null);
    }
  }, [projectFilter]);

  const fetchBudgetVersions = async (projectNo: string) => {
    setIsLoadingVersions(true);
    try {
      const response = await fetch(`http://localhost:3001/api/budget/versions/${encodeURIComponent(projectNo)}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch budget versions');
      }
      
      const versions = data.versions || [];
      setBudgetVersions(versions);
      // Default to latest version (first in the list since it's already sorted by Created_Date DESC)
      if (versions.length > 0) {
        setSelectedVersion(versions[0].Version_ID);
      } else {
        setSelectedVersion(null);
      }
    } catch (err: any) {
      console.error('Failed to fetch budget versions:', err);
      setBudgetVersions([]);
      setSelectedVersion(null);
    } finally {
      setIsLoadingVersions(false);
    }
  };

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
        ...(selectedVersion && { versionId: selectedVersion.toString() }),
      });

      const response = await fetch(`http://localhost:3001/api/bc/ledger-entries?${params}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate report');
      }
      
      setLedgerData(data.entries);
      setJobTaskHierarchy(data.jobTaskHierarchy || []);
      console.log(`✅ Fetched ${data.count} ledger entries for project ${projectFilter} (${startDate} to ${endDate})`);
      console.log(`✅ Fetched ${data.jobTaskHierarchy?.length || 0} job task hierarchy items`);
    } catch (err: any) {
      console.error('Failed to generate report:', err);
      setReportError(err.message || 'Failed to generate report');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate amount in project currency (placeholder formula - adjust as needed)
  const calculateAmount = (entry: ProjectLedgerEntry): number => {
    // Use the Formula field which contains the converted amount
    return entry.Formula || entry.Azz_Transaction_Amount;
  };

  // Build grouped data from job task hierarchy (from Job_Task_Lines API)
  // This ensures we show all levels even if there are no transactions
  const groupedData: GroupedData = (() => {
    const result: GroupedData = {};
    
    // First, build structure from hierarchy (this ensures empty groups are shown)
    jobTaskHierarchy.forEach((task) => {
      const taskTop = `${task.Level1_Job_Task_No} - ${task.Level1_Description || 'Uncategorized'}`;
      const taskMiddle = task.Has_Middle_Level ? `${task.Level2_Job_Task_No} - ${task.Level2_Description || 'Uncategorized'}` : '';
      const taskDetail = `${task.Job_Task_No} - ${task.Description}`;
      
      if (!result[taskTop]) {
        result[taskTop] = {};
      }
      
      const middleKey = taskMiddle || '_NO_MIDDLE_LEVEL_';
      if (!result[taskTop][middleKey]) {
        result[taskTop][middleKey] = {};
      }
      
      if (!result[taskTop][middleKey][taskDetail]) {
        result[taskTop][middleKey][taskDetail] = {
          entries: [],
          budget: task.Budget_Amount || 0,
          jobTaskNo: task.Job_Task_No
        };
      }
    });
    
    // Then, populate with actual transaction data
    ledgerData.forEach((entry) => {
      const taskTop = `${entry.Level1_Job_Task_No} - ${entry.Level1_Description || 'Uncategorized'}`;
      const taskMiddle = entry.Has_Middle_Level ? `${entry.Level2_Job_Task_No} - ${entry.Level2_Description || 'Uncategorized'}` : '';
      const taskDetail = `${entry.Donor_Project_Task_No} - ${entry.Job_Task_Description}`;
      
      const middleKey = taskMiddle || '_NO_MIDDLE_LEVEL_';
      
      if (result[taskTop]?.[middleKey]?.[taskDetail]) {
        result[taskTop][middleKey][taskDetail].entries.push(entry);
      }
    });
    
    return result;
  })();

  // Calculate totals for a group
  const calculateGroupTotal = (data: { entries: ProjectLedgerEntry[]; budget: number; jobTaskNo: string }): number => {
    return data.entries.reduce((sum, entry) => sum + calculateAmount(entry), 0);
  };

  // Calculate budget for a detail-level group
  const calculateGroupBudget = (data: { entries: ProjectLedgerEntry[]; budget: number; jobTaskNo: string }): number => {
    return data.budget;
  };

  // Type for detail groups
  type DetailGroupsType = { [taskDetail: string]: { entries: ProjectLedgerEntry[]; budget: number; jobTaskNo: string } };
  type MiddleGroupsType = { [taskMiddle: string]: DetailGroupsType };

  // Calculate total for a top-level group
  const calculateTopGroupTotal = (middleGroups: MiddleGroupsType): number => {
    return Object.values(middleGroups).reduce((sum, detailGroups) => {
      return sum + Object.values(detailGroups).reduce((detailSum, data) => detailSum + calculateGroupTotal(data), 0);
    }, 0);
  };

  // Calculate budget for a top-level group
  const calculateTopGroupBudget = (middleGroups: MiddleGroupsType): number => {
    return Object.values(middleGroups).reduce((sum, detailGroups) => {
      return sum + Object.values(detailGroups).reduce((detailSum, data) => detailSum + calculateGroupBudget(data), 0);
    }, 0);
  };

  // Calculate total for a middle-level group
  const calculateMiddleGroupTotal = (detailGroups: DetailGroupsType): number => {
    return Object.values(detailGroups).reduce((sum, data) => sum + calculateGroupTotal(data), 0);
  };

  // Calculate budget for a middle-level group
  const calculateMiddleGroupBudget = (detailGroups: DetailGroupsType): number => {
    return Object.values(detailGroups).reduce((sum, data) => sum + calculateGroupBudget(data), 0);
  };

  // Calculate grand total
  const calculateGrandTotal = (): number => {
    return ledgerData.reduce((sum, entry) => sum + calculateAmount(entry), 0);
  };

  // Calculate grand total budget (from hierarchy)
  const calculateGrandTotalBudget = (): number => {
    return jobTaskHierarchy.reduce((sum, task) => sum + (task.Budget_Amount || 0), 0);
  };

  // Export to Excel function
  const exportToExcel = () => {
    if (Object.keys(groupedData).length === 0) return;

    const rows: any[][] = [];
    const rowStyles: { level: 'header' | 'level1' | 'level2' | 'level3' | 'data' | 'grandTotal' | 'title', row: number }[] = [];
    const mergeRanges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
    let currentRow = 0;
    
    // Title rows at the beginning
    // Row 1: Project Name + "Financial Report"
    rows.push([`${projectFilter} Financial Report`, '', '', '', '', '', '', '', '', '', '']);
    mergeRanges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 10 } });
    rowStyles.push({ level: 'title', row: currentRow++ });
    
    // Row 2: Report Start Date and End Date
    rows.push([`Report Period: ${startDate} to ${endDate}`, '', '', '', '', '', '', '', '', '', '']);
    mergeRanges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 10 } });
    rowStyles.push({ level: 'title', row: currentRow++ });
    
    // Row 3: Empty row
    rows.push(['', '', '', '', '', '', '', '', '', '', '']);
    mergeRanges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 10 } });
    currentRow++;
    
    // Header row
    rows.push([
      'Category', 'Category Detail', 'Invoice Number', 'Document Date', 
      'Supplier', 'Invoice Currency', 'Invoice Amount', 'Project Currency', 
      'Amount', 'Budget', 'Variance'
    ]);
    rowStyles.push({ level: 'header', row: currentRow++ });

    // Process grouped data
    Object.entries(groupedData).sort(([a], [b]) => a.localeCompare(b)).forEach(([taskTop, middleGroups]) => {
      // Level 1 (Top) row
      const topTotal = calculateTopGroupTotal(middleGroups);
      const topBudget = calculateTopGroupBudget(middleGroups);
      const topVariance = topBudget - topTotal;
      rows.push([
        taskTop, '', '', '', '', '', '', '',
        topTotal, topBudget, topVariance
      ]);
      // Merge columns A-H (0-7)
      mergeRanges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 7 } });
      rowStyles.push({ level: 'level1', row: currentRow++ });

      Object.entries(middleGroups).sort(([a], [b]) => a.localeCompare(b)).forEach(([taskMiddle, detailGroups]) => {
        // Level 2 (Middle) row - only if not '_NO_MIDDLE_LEVEL_'
        if (taskMiddle !== '_NO_MIDDLE_LEVEL_') {
          const middleTotal = calculateMiddleGroupTotal(detailGroups);
          const middleBudget = calculateMiddleGroupBudget(detailGroups);
          const middleVariance = middleBudget - middleTotal;
          rows.push([
            `  ${taskMiddle}`, '', '', '', '', '', '', '',
            middleTotal, middleBudget, middleVariance
          ]);
          // Merge columns A-H (0-7)
          mergeRanges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 7 } });
          rowStyles.push({ level: 'level2', row: currentRow++ });
        }

        Object.entries(detailGroups).sort(([a], [b]) => a.localeCompare(b)).forEach(([taskDetail, data]) => {
          // Level 3 (Detail) row
          const detailTotal = calculateGroupTotal(data);
          const detailBudget = data.budget || 0;
          const detailVariance = detailBudget - detailTotal;
          const indent = taskMiddle === '_NO_MIDDLE_LEVEL_' ? '  ' : '    ';
          rows.push([
            `${indent}${taskDetail}`, '', '', '', '', '', '', '',
            detailTotal, detailBudget, detailVariance
          ]);
          // Merge columns A-H (0-7)
          mergeRanges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 7 } });
          rowStyles.push({ level: 'level3', row: currentRow++ });

          // Data rows
          data.entries.sort((a, b) => new Date(a.Posting_Date).getTime() - new Date(b.Posting_Date).getTime()).forEach((entry) => {
            const dataIndent = taskMiddle === '_NO_MIDDLE_LEVEL_' ? '    ' : '      ';
            rows.push([
              `${dataIndent}${entry.Donor_Project_Task_No}`,
              entry.Donor_Description,
              entry.External_Document_No || '',
              entry.Document_Date ? new Date(entry.Document_Date).toLocaleDateString() : '',
              entry.Azz_Vendor_Name,
              entry.Azz_Transaction_Currency,
              entry.Azz_Transaction_Amount,
              entry.Project_Currency,
              calculateAmount(entry),
              '', ''
            ]);
            rowStyles.push({ level: 'data', row: currentRow++ });
          });
        });
      });
    });

    // Grand Total row
    const grandTotal = calculateGrandTotal();
    const grandBudget = calculateGrandTotalBudget();
    const grandVariance = grandBudget - grandTotal;
    rows.push([
      `GRAND TOTAL (${projectCurrency})`, '', '', '', '', '', '', '',
      grandTotal, grandBudget, grandVariance
    ]);
    // Merge columns A-H (0-7)
    mergeRanges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 7 } });
    rowStyles.push({ level: 'grandTotal', row: currentRow++ });

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Set merge ranges
    ws['!merges'] = mergeRanges;

    // Define styles for each level
    const styleColors: { [key: string]: { fill: string; font: string; bold: boolean } } = {
      title: { fill: 'FFFFFF', font: '000000', bold: true },       // White background for title
      header: { fill: '005272', font: 'FFFFFF', bold: true },      // Blue header with white text
      level1: { fill: 'ADD8E6', font: '000000', bold: true },      // Light blue
      level2: { fill: 'ADD8E6', font: '000000', bold: true },      // Light blue
      level3: { fill: 'E8F4F8', font: '000000', bold: true },      // Very light blue
      data: { fill: 'FFFFFF', font: '000000', bold: false },       // White
      grandTotal: { fill: '0D47A1', font: 'FFFFFF', bold: true }   // Dark blue with white text
    };

    // Apply styles to cells
    const colCount = 11; // Number of columns
    rowStyles.forEach(({ level, row }) => {
      const style = styleColors[level];
      
      for (let col = 0; col < colCount; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
        if (!ws[cellRef]) {
          ws[cellRef] = { v: '', t: 's' };
        }
        
        // Determine alignment
        let horizontalAlign = 'left';
        if (level === 'title') {
          horizontalAlign = 'center'; // Title rows centered
        } else if (col === 5 || col === 7) {
          horizontalAlign = 'center'; // Invoice Currency and Project Currency centered
        } else if (col === 6 || col >= 8) {
          horizontalAlign = 'right'; // Invoice Amount and other amount columns right-aligned
        }
        
        // Text wrapping for Invoice Currency (col 5) and Project Currency (col 7)
        const wrapText = (col === 5 || col === 7);
        
        // Only apply borders to data (transaction) rows
        const borderStyle = level === 'data' ? {
          top: { style: 'thin', color: { rgb: 'CCCCCC' } },
          bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
          left: { style: 'thin', color: { rgb: 'CCCCCC' } },
          right: { style: 'thin', color: { rgb: 'CCCCCC' } }
        } : {};
        
        // Apply style
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
          border: borderStyle,
          alignment: {
            horizontal: horizontalAlign,
            vertical: 'center',
            wrapText: wrapText
          }
        };

        // Format number cells with 2 decimals: Invoice Amount (col 6), Amount (col 8), Budget (col 9), Variance (col 10)
        // For transaction rows (level === 'data'), skip Budget and Variance formatting (they're empty)
        if ((col === 6 || col >= 8) && col <= 10 && level !== 'header' && level !== 'title') {
          // Skip Budget and Variance for data rows (keep them empty)
          if (level === 'data' && (col === 9 || col === 10)) {
            // Keep empty for transaction rows
          } else {
            const value = ws[cellRef].v;
            if (typeof value === 'number' || value === '' || value === null) {
              if (typeof value !== 'number') {
                ws[cellRef].v = 0;
                ws[cellRef].t = 'n';
              }
              ws[cellRef].z = '#,##0.00';
            }
          }
        }
      }
    });

    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, // Column A - Category
      { wch: 60 }, // Column B - Category Detail
      { wch: 18 }, // Column C - Invoice Number
      { wch: 12 }, // Column D - Document Date
      { wch: 30 }, // Column E - Supplier
      { wch: 8 },  // Column F - Invoice Currency
      { wch: 15 }, // Column G - Invoice Amount
      { wch: 8 },  // Column H - Project Currency
      { wch: 15 }, // Column I - Amount
      { wch: 15 }, // Column J - Budget
      { wch: 15 }, // Column K - Variance
    ];

    // Set row heights (row 4 is index 3 - the header row after 3 title rows)
    ws['!rows'] = [];
    ws['!rows'][3] = { hpx: 25 }; // Row 4 height = 25 pixels

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Financial Report');

    // Generate Excel file with styles
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Save file
    const fileName = `Financial_Report_${projectFilter}_${startDate}_to_${endDate}.xlsx`;
    saveAs(blob, fileName);
  };

  // Context menu handlers
  const handleContextMenu = (event: React.MouseEvent, documentNo: string) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      documentNo: documentNo
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleViewEntry = () => {
    if (contextMenu) {
      const encodedDocNo = encodeURIComponent(contextMenu.documentNo);
      const bcUrl = `https://businesscentral.dynamics.com/9f4e2976-b07e-4f8f-9c78-055f6c855a11/Production?company=ARK%20Group%20Live&page=92&filter=%27Job%20Ledger%20Entry%27.%27Document%20No.%27%20IS%20%27${encodedDocNo}%27&dc=0`;
      window.open(bcUrl, '_blank');
      handleCloseContextMenu();
    }
  };

  // Get the project currency from the first entry
  const projectCurrency = ledgerData.length > 0 ? ledgerData[0].Project_Currency : '';

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
              onChange={(_, newValue) => setProjectFilter(newValue || '')}
              renderInput={(params) => <TextField {...params} label="Donor Project No" />}
              disabled={!isAuthenticated}
              loading={isLoadingProjects}
            />

            <Autocomplete
              sx={{ minWidth: 200 }}
              size="small"
              options={budgetVersions}
              getOptionLabel={(option) => option.Version_Name}
              value={budgetVersions.find(v => v.Version_ID === selectedVersion) || null}
              onChange={(_, newValue) => setSelectedVersion(newValue?.Version_ID || null)}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  label="Budget Version"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {isLoadingVersions ? <CircularProgress color="inherit" size={18} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              disabled={!isAuthenticated || !projectFilter || budgetVersions.length === 0}
              loading={isLoadingVersions}
              noOptionsText={projectFilter ? "No versions available" : "Select a project first"}
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

            <Button 
              variant="outlined" 
              color="success"
              size="small"
              disabled={Object.keys(groupedData).length === 0}
              onClick={exportToExcel}
              startIcon={<FileDownloadIcon />}
            >
              Export to Excel
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
                <TableRow sx={{ backgroundColor: '#0078D7' }}>
                  <TableCell sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#0078D7', fontSize: '0.65rem', border: '1px solid #ddd' }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#0078D7', fontSize: '0.65rem', border: '1px solid #ddd' }}>Category Detail</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#0078D7', fontSize: '0.65rem', border: '1px solid #ddd' }}>Invoice Number</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#0078D7', fontSize: '0.65rem', border: '1px solid #ddd' }}>Document Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#0078D7', fontSize: '0.65rem', border: '1px solid #ddd' }}>Supplier</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#0078D7', fontSize: '0.65rem', border: '1px solid #ddd' }}>Invoice Currency</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#0078D7', fontSize: '0.65rem', border: '1px solid #ddd' }}>Invoice Amount</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#0078D7', fontSize: '0.65rem', border: '1px solid #ddd' }}>Project Currency</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#0078D7', fontSize: '0.65rem', border: '1px solid #ddd' }}>Amount</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#0078D7', fontSize: '0.65rem', border: '1px solid #ddd' }}>Budget</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#0078D7', fontSize: '0.65rem', border: '1px solid #ddd' }}>Variance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!isAuthenticated ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      <Typography variant="body2">
                        No data. Connect to Business Central to generate a report.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : Object.keys(groupedData).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 4, color: 'text.secondary', fontSize: '0.75rem' }}>
                      <Typography variant="body2">
                        {isLoading ? 'Loading report data...' : 'No data. Select a project and click Generate Report.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  Object.entries(groupedData).sort(([a], [b]) => a.localeCompare(b)).map(([taskTop, middleGroups]) => (
                    <Fragment key={`top-group-${taskTop}`}>
                      {/* Top-level group header */}
                      <TableRow>
                        <TableCell 
                          colSpan={8} 
                          sx={{ 
                            fontWeight: 'bold', 
                            backgroundColor: '#ADD8E6', 
                            color: 'black',
                            fontSize: '0.7rem',
                            py: 1,
                            border: '1px solid #ddd'
                          }}
                        >
                          {taskTop}
                        </TableCell>
                        <TableCell 
                          align="right"
                          sx={{ 
                            fontWeight: 'bold', 
                            backgroundColor: '#ADD8E6', 
                            color: 'black',
                            fontSize: '0.7rem',
                            py: 1,
                            border: '1px solid #ddd'
                          }}
                        >
                          {calculateTopGroupTotal(middleGroups).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell 
                          align="right"
                          sx={{ 
                            fontWeight: 'bold', 
                            backgroundColor: '#ADD8E6', 
                            color: 'black',
                            fontSize: '0.7rem',
                            py: 1,
                            border: '1px solid #ddd'
                          }}
                        >
                          {calculateTopGroupBudget(middleGroups).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell 
                          align="right"
                          sx={{ 
                            fontWeight: 'bold', 
                            backgroundColor: '#ADD8E6', 
                            color: 'black',
                            fontSize: '0.7rem',
                            py: 1,
                            border: '1px solid #ddd'
                          }}
                        >
                          {(() => {
                            const budget = calculateTopGroupBudget(middleGroups);
                            const actual = calculateTopGroupTotal(middleGroups);
                            const variance = budget - actual;
                            return variance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          })()}
                        </TableCell>
                      </TableRow>
                      
                      {Object.entries(middleGroups).sort(([a], [b]) => a.localeCompare(b)).map(([taskMiddle, detailGroups]) => (
                        <Fragment key={`middle-group-${taskTop}-${taskMiddle}`}>
                          {/* Middle-level group header - only show if not '_NO_MIDDLE_LEVEL_' */}
                          {taskMiddle !== '_NO_MIDDLE_LEVEL_' && (
                            <TableRow>
                              <TableCell 
                                colSpan={8} 
                                sx={{
                                  fontWeight: 'bold', 
                                  backgroundColor: '#ADD8E6', 
                                  color: 'black',
                                  fontSize: '0.65rem',
                                  py: 0.75,
                                  pl: 3,
                                  border: '1px solid #ddd'
                                }}
                              >
                                {taskMiddle}
                              </TableCell>
                              <TableCell 
                                align="right"
                                sx={{ 
                                  fontWeight: 'bold', 
                                  backgroundColor: '#ADD8E6', 
                                  color: 'black',
                                  fontSize: '0.65rem',
                                  py: 0.75,
                                  border: '1px solid #ddd'
                                }}
                              >
                                {calculateMiddleGroupTotal(detailGroups).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell 
                                align="right"
                                sx={{ 
                                  fontWeight: 'bold', 
                                  backgroundColor: '#ADD8E6', 
                                  color: 'black',
                                  fontSize: '0.65rem',
                                  py: 0.75,
                                  border: '1px solid #ddd'
                                }}
                              >
                                {calculateMiddleGroupBudget(detailGroups).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell 
                                align="right"
                                sx={{ 
                                  fontWeight: 'bold', 
                                  backgroundColor: '#ADD8E6', 
                                  color: 'black',
                                  fontSize: '0.65rem',
                                  py: 0.75,
                                  border: '1px solid #ddd'
                                }}
                              >
                                {(() => {
                                  const budget = calculateMiddleGroupBudget(detailGroups);
                                  const actual = calculateMiddleGroupTotal(detailGroups);
                                  const variance = budget - actual;
                                  return variance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                })()}
                              </TableCell>
                            </TableRow>
                          )}
                          
                          {/* Detail-level groups */}
                          {Object.entries(detailGroups).sort(([a], [b]) => a.localeCompare(b)).map(([taskDetail, data]) => (
                            <Fragment key={`detail-group-${taskTop}-${taskMiddle}-${taskDetail}`}>
                              {/* Detail-level group header */}
                              <TableRow>
                                <TableCell 
                                  colSpan={8} 
                                  sx={{
                                    fontWeight: 'bold', 
                                    backgroundColor: '#E8F4F8', 
                                    color: 'black',
                                    fontSize: '0.65rem',
                                    py: 0.75,
                                    pl: taskMiddle === '_NO_MIDDLE_LEVEL_' ? 3 : 6,
                                    border: '1px solid #ddd'
                                  }}
                                >
                                  {taskDetail}
                                </TableCell>
                                <TableCell 
                                  align="right"
                                  sx={{ 
                                    fontWeight: 'bold', 
                                    backgroundColor: '#E8F4F8', 
                                    color: 'black',
                                    fontSize: '0.65rem',
                                    py: 0.75,
                                    border: '1px solid #ddd'
                                  }}
                                >
                                  {calculateGroupTotal(data).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell 
                                  align="right"
                                  sx={{ 
                                    fontWeight: 'bold', 
                                    backgroundColor: '#E8F4F8', 
                                    color: 'black',
                                    fontSize: '0.65rem',
                                    py: 0.75,
                                    border: '1px solid #ddd'
                                  }}
                                >
                                  {data.budget ? data.budget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                </TableCell>
                                <TableCell 
                                  align="right"
                                  sx={{ 
                                    fontWeight: 'bold', 
                                    backgroundColor: '#E8F4F8', 
                                    color: 'black',
                                    fontSize: '0.65rem',
                                    py: 0.75,
                                    border: '1px solid #ddd'
                                  }}
                                >
                                  {(() => {
                                    const budget = data.budget || 0;
                                    const actual = calculateGroupTotal(data);
                                    const variance = budget - actual;
                                    return variance !== 0 ? variance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
                                  })()}
                                </TableCell>
                              </TableRow>
                              
                              {/* Data rows */}
                              {data.entries.sort((a, b) => new Date(a.Posting_Date).getTime() - new Date(b.Posting_Date).getTime()).map((entry, index) => (
                                <TableRow 
                                  key={`entry-${taskTop}-${taskMiddle}-${taskDetail}-${index}`} 
                                  hover
                                  onContextMenu={(e) => handleContextMenu(e, entry.Document_No)}
                                  sx={{ cursor: 'context-menu' }}
                                >
                              <TableCell sx={{ fontSize: '0.65rem', py: 0.5, px: 1, pl: taskMiddle === '_NO_MIDDLE_LEVEL_' ? 4 : 8, border: '1px solid #ddd' }}>
                                {entry.Donor_Project_Task_No}
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.65rem', py: 0.5, px: 1, border: '1px solid #ddd' }}>
                                {entry.Donor_Description}
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.65rem', py: 0.5, px: 1, border: '1px solid #ddd' }}>
                                {entry.External_Document_No || ''}
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.65rem', py: 0.5, px: 1, border: '1px solid #ddd' }}>
                                {entry.Document_Date ? new Date(entry.Document_Date).toLocaleDateString() : '-'}
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.65rem', py: 0.5, px: 1, border: '1px solid #ddd' }}>
                                {entry.Azz_Vendor_Name}
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.65rem', py: 0.5, px: 1, border: '1px solid #ddd' }}>
                                {entry.Azz_Transaction_Currency}
                              </TableCell>
                              <TableCell align="right" sx={{ fontSize: '0.65rem', py: 0.5, px: 1, border: '1px solid #ddd' }}>
                                {entry.Azz_Transaction_Amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.65rem', py: 0.5, px: 1, border: '1px solid #ddd' }}>
                                {entry.Project_Currency}
                              </TableCell>
                              <TableCell align="right" sx={{ fontSize: '0.65rem', py: 0.5, px: 1, border: '1px solid #ddd' }}>
                                {calculateAmount(entry).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.65rem', py: 0.5, px: 1, border: '1px solid #ddd' }}>
                                {/* Empty - Budget shown at detail group level */}
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.65rem', py: 0.5, px: 1, border: '1px solid #ddd' }}>
                                {/* Empty - Variance shown at detail group level */}
                              </TableCell>
                                </TableRow>
                              ))}
                            </Fragment>
                          ))}
                        </Fragment>
                      ))}
                    </Fragment>
                  ))
                )}
                {/* Grand Total Row */}
                {Object.keys(groupedData).length > 0 && (
                  <TableRow>
                    <TableCell 
                      colSpan={8} 
                      sx={{
                        fontWeight: 'bold', 
                        backgroundColor: '#0d47a1', 
                        color: 'white',
                        fontSize: '0.75rem',
                        py: 1.5,
                        border: '1px solid #ddd'
                      }}
                    >
                      GRAND TOTAL ({projectCurrency})
                    </TableCell>
                    <TableCell 
                      align="right"
                      sx={{ 
                        fontWeight: 'bold', 
                        backgroundColor: '#0d47a1', 
                        color: 'white',
                        fontSize: '0.75rem',
                        py: 1.5,
                        border: '1px solid #ddd'
                      }}
                    >
                      {calculateGrandTotal().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell 
                      align="right"
                      sx={{ 
                        fontWeight: 'bold', 
                        backgroundColor: '#0d47a1', 
                        color: 'white',
                        fontSize: '0.75rem',
                        py: 1.5,
                        border: '1px solid #ddd'
                      }}
                    >
                      {calculateGrandTotalBudget().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell 
                      align="right"
                      sx={{ 
                        fontWeight: 'bold', 
                        backgroundColor: '#0d47a1', 
                        color: 'white',
                        fontSize: '0.75rem',
                        py: 1.5,
                        border: '1px solid #ddd'
                      }}
                    >
                      {(() => {
                        const budget = calculateGrandTotalBudget();
                        const actual = calculateGrandTotal();
                        const variance = budget - actual;
                        return variance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      })()}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleViewEntry}>
          <OpenInNewIcon sx={{ mr: 1, fontSize: 18 }} />
          View Entry in Business Central
        </MenuItem>
      </Menu>
    </Box>
  );
}
