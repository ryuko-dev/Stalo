import { Box, Typography, Card, CardContent, Autocomplete, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, CircularProgress, Chip, Button, MenuItem, Select, FormControl, InputLabel, IconButton, Snackbar, Alert } from '@mui/material';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { format, eachMonthOfInterval, parseISO } from 'date-fns';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import SaveBudgetDialog from '../components/SaveBudgetDialog';

interface ProjectCard {
  No: string;
  Budget_Manager_Name: string;
  Starting_Date: string;
  Ending_Date: string;
}

interface JobTaskLine {
  Job_No: string;
  Job_Task_No: string;
  Description: string;
  Job_Task_Type: string;
}

interface BudgetVersion {
  Version_ID: number;
  Job_No: string;
  Version_Name: string;
  Version_Description: string | null;
  Is_Active: boolean;
  Is_Baseline: boolean;
  Created_By: string;
  Created_Date: string;
  Modified_By: string | null;
  Modified_Date: string | null;
  Source_Type: string | null;
}

interface BudgetData {
  ID: number;
  Version_ID: number;
  Job_No: string;
  Job_Task_No: string;
  Budget_Month: string;
  Budget_Amount: number;
}

export default function Glidepath() {
  const { isAuthenticated, userEmail } = useAuth();
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectCard | null>(null);
  const [jobTaskLines, setJobTaskLines] = useState<JobTaskLine[]>([]);
  const [versions, setVersions] = useState<BudgetVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<BudgetVersion | null>(null);
  const [budgetData, setBudgetData] = useState<Map<string, number>>(new Map());
  const [pendingChanges, setPendingChanges] = useState<Map<string, number>>(new Map());
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isLoadingBudgetData, setIsLoadingBudgetData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDialogMode, setSaveDialogMode] = useState<'upload' | 'edit'>('edit');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({ 
    open: false, 
    message: '', 
    severity: 'success' 
  });

  // Fetch project cards on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchProjects();
    }
  }, [isAuthenticated]);

  // Fetch job task lines when project is selected
  useEffect(() => {
    if (selectedProject) {
      // Clear previous project's version and data
      setSelectedVersion(null);
      setBudgetData(new Map());
      setPendingChanges(new Map());
      
      // Fetch new project data
      fetchJobTaskLines(selectedProject.No);
      fetchVersions(selectedProject.No);
    } else {
      setJobTaskLines([]);
      setVersions([]);
      setSelectedVersion(null);
      setBudgetData(new Map());
      setPendingChanges(new Map());
    }
  }, [selectedProject]);

  // Fetch budget data when version is selected
  useEffect(() => {
    if (selectedVersion) {
      fetchBudgetData(selectedVersion.Version_ID);
    } else {
      setBudgetData(new Map());
      setPendingChanges(new Map());
    }
  }, [selectedVersion]);

  const fetchProjects = async () => {
    setIsLoadingProjects(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:3001/api/bc/project-cards');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch projects');
      }
      
      setProjects(data.projectCards);
      console.log(`✅ Loaded ${data.count} project cards`);
    } catch (err: any) {
      console.error('Failed to fetch projects:', err);
      setError(err.message);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const fetchJobTaskLines = async (jobNo: string) => {
    setIsLoadingTasks(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:3001/api/bc/job-task-lines?jobNo=${encodeURIComponent(jobNo)}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch job task lines');
      }
      
      setJobTaskLines(data.taskLines);
      console.log(`✅ Loaded ${data.count} job task lines for project ${jobNo}`);
    } catch (err: any) {
      console.error('Failed to fetch job task lines:', err);
      setError(err.message);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const fetchVersions = async (jobNo: string) => {
    setIsLoadingVersions(true);
    try {
      const response = await fetch(`http://localhost:3001/api/budget/versions/${encodeURIComponent(jobNo)}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch versions');
      }
      
      setVersions(data.versions);
      // Auto-select latest version
      if (data.versions.length > 0) {
        setSelectedVersion(data.versions[0]);
      }
      console.log(`✅ Loaded ${data.count} budget versions`);
    } catch (err: any) {
      console.error('Failed to fetch versions:', err);
      // Don't show error if no versions exist yet
      if (!err.message.includes('No versions found')) {
        setError(err.message);
      }
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const fetchBudgetData = async (versionId: number) => {
    setIsLoadingBudgetData(true);
    try {
      const response = await fetch(`http://localhost:3001/api/budget/data/${versionId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch budget data');
      }
      
      // Convert array to Map for fast lookup using proper key format
      // Key format: "Job_Task_No|yyyy-MM-dd" to match getCellKey format
      const dataMap = new Map<string, number>();
      data.budgetData.forEach((item: BudgetData) => {
        // Normalize the Budget_Month to yyyy-MM-dd format
        const monthDate = parseISO(item.Budget_Month.split('T')[0]); // Remove time component if present
        const normalizedMonth = format(monthDate, 'yyyy-MM-dd');
        const key = `${item.Job_Task_No}|${normalizedMonth}`;
        dataMap.set(key, item.Budget_Amount);
        console.log(`Loaded: ${item.Job_Task_No} | ${normalizedMonth} = ${item.Budget_Amount}`);
      });
      
      setBudgetData(dataMap);
      setPendingChanges(new Map()); // Clear pending changes
      console.log(`✅ Loaded ${data.count} budget records from Version ${versionId}`);
    } catch (err: any) {
      console.error('Failed to fetch budget data:', err);
      setError(err.message);
    } finally {
      setIsLoadingBudgetData(false);
    }
  };

  // Helper function to get cell key
  const getCellKey = (taskNo: string, month: Date): string => {
    return `${taskNo}|${format(month, 'yyyy-MM-dd')}`;
  };

  // Get budget value for a cell (pending changes override saved data)
  const getBudgetValue = (taskNo: string, month: Date): number => {
    const key = getCellKey(taskNo, month);
    const value = pendingChanges.get(key) ?? budgetData.get(key) ?? 0;
    return value;
  };

  // Handle cell value change
  const handleCellChange = (taskNo: string, month: Date, value: string) => {
    const numValue = parseFloat(value) || 0;
    const key = getCellKey(taskNo, month);
    
    setPendingChanges(prev => {
      const newChanges = new Map(prev);
      newChanges.set(key, numValue);
      return newChanges;
    });
  };

  const handleSaveBudget = async (saveAsNew: boolean, versionName?: string, description?: string) => {
    if (!selectedProject || !userEmail) {
      return;
    }

    setIsSaving(true);
    try {
      let targetVersionId: number;

      if (saveAsNew) {
        // Create new version
        const createResponse = await fetch('http://localhost:3001/api/budget/versions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobNo: selectedProject.No,
            versionName,
            versionDescription: description,
            sourceType: saveDialogMode === 'upload' ? 'Excel Upload' : 'Manual Edit',
            createdBy: userEmail
          })
        });

        const createData = await createResponse.json();
        if (!createResponse.ok) {
          throw new Error(createData.error || 'Failed to create version');
        }

        targetVersionId = createData.version.Version_ID;
      } else {
        if (!selectedVersion) {
          throw new Error('No version selected');
        }
        targetVersionId = selectedVersion.Version_ID;
      }

      // Prepare budget data array
      const budgetDataArray: any[] = [];
      pendingChanges.forEach((amount, key) => {
        const [taskNo, monthStr] = key.split('|');
        budgetDataArray.push({
          jobNo: selectedProject.No,
          jobTaskNo: taskNo,
          budgetMonth: monthStr,
          budgetAmount: amount
        });
      });

      // Save budget data only if there are changes
      if (budgetDataArray.length > 0) {
        const endpoint = saveAsNew || saveDialogMode === 'upload' 
          ? `http://localhost:3001/api/budget/data/${targetVersionId}`
          : `http://localhost:3001/api/budget/data/${targetVersionId}`;
        
        const method = 'POST';
        const saveResponse = await fetch(endpoint, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            budgetData: budgetDataArray,
            modifiedBy: userEmail
          })
        });

        const saveData = await saveResponse.json();
        if (!saveResponse.ok) {
          throw new Error(saveData.error || 'Failed to save budget data');
        }
      }

      // Refresh versions and data
      await fetchVersions(selectedProject.No);
      if (saveAsNew) {
        // Need to refetch to get the new version
        const versionsResponse = await fetch(`http://localhost:3001/api/budget/versions/${encodeURIComponent(selectedProject.No)}`);
        const versionsData = await versionsResponse.json();
        if (versionsResponse.ok) {
          setVersions(versionsData.versions);
          // Select the newly created version
          const newVersion = versionsData.versions.find((v: BudgetVersion) => v.Version_ID === targetVersionId);
          if (newVersion) {
            setSelectedVersion(newVersion);
          }
        }
      } else {
        // Reload current version data to show updated values
        await fetchBudgetData(targetVersionId);
      }

      setPendingChanges(new Map());
      setSaveDialogOpen(false);
      setIsSaving(false);
      
      const message = saveAsNew 
        ? `✅ Created version '${versionName}'${budgetDataArray.length > 0 ? ` with ${budgetDataArray.length} records` : ''}`
        : `✅ Updated version with ${budgetDataArray.length} records`;
      
      setSnackbar({
        open: true,
        message,
        severity: 'success'
      });
    } catch (err: any) {
      console.error('Failed to save budget:', err);
      setIsSaving(false);
      setSnackbar({
        open: true,
        message: `❌ ${err.message}`,
        severity: 'error'
      });
    }
  };

  const handleCreateNewVersion = () => {
    if (!selectedProject) return;
    
    setSaveDialogMode('edit');
    setSaveDialogOpen(true);
  };

  const handleSaveChanges = () => {
    if (pendingChanges.size === 0) return;
    
    setSaveDialogMode('edit');
    setSaveDialogOpen(true);
  };

  // Helper function to parse various month label formats
  const parseMonthLabel = (label: string): { month: number; year: number } | null => {
    const trimmed = label.trim();
    
    // Month name mapping
    const monthMap: Record<string, number> = {
      'jan': 0, 'january': 0,
      'feb': 1, 'february': 1,
      'mar': 2, 'march': 2,
      'apr': 3, 'april': 3,
      'may': 4,
      'jun': 5, 'june': 5,
      'jul': 6, 'july': 6,
      'aug': 7, 'august': 7,
      'sep': 8, 'sept': 8, 'september': 8,
      'oct': 9, 'october': 9,
      'nov': 10, 'november': 10,
      'dec': 11, 'december': 11
    };
    
    // Try formats: "Oct-25", "Oct 25", "Oct-2025", "Oct 2025"
    const patterns = [
      /^([a-z]{3,})[- ]?(\d{2,4})$/i,  // Oct-25, Oct 25, Oct-2025, Oct 2025
    ];
    
    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        const monthName = match[1].toLowerCase();
        let yearStr = match[2];
        
        if (monthMap.hasOwnProperty(monthName)) {
          const month = monthMap[monthName];
          // Convert 2-digit year to 4-digit
          let year = parseInt(yearStr);
          if (year < 100) {
            year += year < 50 ? 2000 : 1900;
          }
          return { month, year };
        }
      }
    }
    
    return null;
  };

  const handleUploadExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedProject) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          throw new Error('File is empty or invalid');
        }

        // Parse CSV properly handling quotes
        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        // Parse header
        const headers = parseCSVLine(lines[0]);
        
        console.log('CSV Headers:', headers);
        console.log('Month Columns:', monthColumns.map(m => m.label));

        // Verify header format
        if (!headers[0]?.includes('Job Task') || !headers[1]?.includes('Description')) {
          throw new Error('Invalid file format. Expected columns: Job Task No, Description, [months]');
        }

        const newChanges = new Map<string, number>();
        let importedCount = 0;

        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
          const cells = parseCSVLine(lines[i]);
          const taskNo = cells[0];
          
          if (!taskNo) continue;

          console.log(`Processing Task ${taskNo}:`, cells);

          // Parse each month column (starting from column 2)
          for (let j = 2; j < Math.min(headers.length, cells.length); j++) {
            const value = cells[j];
            const numValue = parseFloat(value);
            
            // Import if it's a valid number (including zero)
            if (value && value !== '' && !isNaN(numValue)) {
              // Find the corresponding month from monthColumns
              const monthLabel = headers[j];
              
              // Try exact match first
              let month = monthColumns.find(m => m.label === monthLabel);
              
              // If not found, try parsing the month label and matching by date
              if (!month) {
                // Try to parse formats like "Oct-25", "Oct 25", "10/2025", etc.
                const parsed = parseMonthLabel(monthLabel);
                if (parsed) {
                  month = monthColumns.find(m => 
                    m.date.getFullYear() === parsed.year && 
                    m.date.getMonth() === parsed.month
                  );
                }
              }
              
              if (month) {
                const key = getCellKey(taskNo, month.date);
                newChanges.set(key, numValue);
                importedCount++;
                console.log(`Imported: ${taskNo} | ${monthLabel} = ${numValue}`);
              } else {
                console.warn(`Month not found: "${monthLabel}" - Available months:`, monthColumns.map(m => `"${m.label}"`));
              }
            }
          }
        }

        if (importedCount === 0) {
          console.error('No data imported. Headers:', headers);
          console.error('Available months:', monthColumns.map(m => m.label));
          throw new Error('No valid budget data found in file. Check that month columns match exactly.');
        }

        setPendingChanges(newChanges);
        setSaveDialogMode('upload');
        setSaveDialogOpen(true);

        setSnackbar({
          open: true,
          message: `✅ Imported ${importedCount} budget values from Excel`,
          severity: 'success'
        });
      } catch (err: any) {
        console.error('Failed to parse Excel file:', err);
        setSnackbar({
          open: true,
          message: `❌ Failed to import: ${err.message}`,
          severity: 'error'
        });
      }
    };

    reader.onerror = () => {
      setSnackbar({
        open: true,
        message: '❌ Failed to read file',
        severity: 'error'
      });
    };

    reader.readAsText(file);
    
    // Reset input so same file can be uploaded again
    event.target.value = '';
  };

  const handleDownloadExcel = () => {
    if (!selectedProject || jobTaskLines.length === 0) return;

    // Prepare data for Excel
    const headers = ['Job Task No', 'Description', ...monthColumns.map(m => m.label)];
    console.log('📥 Download - Headers:', headers);
    console.log('📥 Download - Month columns:', monthColumns.map(m => `"${m.label}"`));
    const rows = jobTaskLines
      .filter(task => task.Job_Task_Type !== 'Total') // Exclude Total rows
      .map(task => {
        const row = [task.Job_Task_No, task.Description];
        // Add budget values for each month
        monthColumns.forEach(month => {
          const value = getBudgetValue(task.Job_Task_No, month.date);
          row.push(value || '');
        });
        return row;
      });

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        // Escape cells containing commas or quotes
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const versionSuffix = selectedVersion ? `_${selectedVersion.Version_Name.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    link.setAttribute('download', `${selectedProject.No}${versionSuffix}_Budget.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSnackbar({
      open: true,
      message: `✅ Downloaded budget template for ${selectedProject.No}`,
      severity: 'success'
    });
  };

  // Generate month columns based on project start and end dates
  const monthColumns = useMemo(() => {
    if (!selectedProject?.Starting_Date || !selectedProject?.Ending_Date) {
      return [];
    }

    try {
      const startDate = parseISO(selectedProject.Starting_Date);
      const endDate = parseISO(selectedProject.Ending_Date);
      
      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      
      return months.map(month => ({
        date: month,
        label: format(month, 'MMM yyyy')
      }));
    } catch (error) {
      console.error('Error parsing dates:', error);
      return [];
    }
  }, [selectedProject]);

  // Calculate total for a parent task based on its children
  const calculateTaskTotal = (parentTaskNo: string, month: Date): number => {
    // Find all child tasks (e.g., if parent is "01", find "01.01", "01.02", etc.)
    const childTasks = jobTaskLines.filter(task => 
      task.Job_Task_No.startsWith(parentTaskNo + '.') && 
      task.Job_Task_Type !== 'Total'
    );
    
    // Sum up the budget values for the specific month
    return childTasks.reduce((sum, task) => {
      return sum + getBudgetValue(task.Job_Task_No, month);
    }, 0);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
        Glidepath - Project Budget Planning
      </Typography>

      {/* Project Selection and Version Control Header */}
      <Card sx={{ mb: 3, backgroundColor: '#f5f5f5', border: '2px solid #1976d2' }}>
        <CardContent sx={{ py: 2, px: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
            <Autocomplete
              options={projects}
              getOptionLabel={(option) => option.No}
              value={selectedProject}
              onChange={(_, newValue) => setSelectedProject(newValue)}
              loading={isLoadingProjects}
              disabled={!isAuthenticated}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Project"
                  placeholder="Choose a project..."
                  size="small"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {isLoadingProjects ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              sx={{ minWidth: 300, flex: 1 }}
            />

            {selectedProject && (
              <>
                <FormControl size="small" sx={{ minWidth: 250 }}>
                  <InputLabel>Version</InputLabel>
                  <Select
                    value={selectedVersion?.Version_ID || ''}
                    onChange={(e) => {
                      const version = versions.find(v => v.Version_ID === e.target.value);
                      setSelectedVersion(version || null);
                    }}
                    label="Version"
                    disabled={isLoadingVersions || versions.length === 0}
                  >
                    {versions.map((version) => (
                      <MenuItem key={version.Version_ID} value={version.Version_ID}>
                        {version.Version_Name}
                        {version.Is_Baseline && ' ⭐'}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={handleCreateNewVersion}
                  size="small"
                >
                  New Version
                </Button>
              </>
            )}
          </Box>

          {selectedProject && (
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Budget Manager
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {selectedProject.Budget_Manager_Name || 'N/A'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Starting Date
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {selectedProject.Starting_Date ? new Date(selectedProject.Starting_Date).toLocaleDateString() : 'N/A'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Ending Date
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {selectedProject.Ending_Date ? new Date(selectedProject.Ending_Date).toLocaleDateString() : 'N/A'}
                </Typography>
              </Box>
            </Box>
          )}

          {selectedVersion && (
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between', pt: 1, borderTop: '1px solid #ddd' }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Current Version: <strong>{selectedVersion.Version_Name}</strong>
                  {selectedVersion.Modified_Date && (
                    <> (Modified: {new Date(selectedVersion.Modified_Date).toLocaleDateString()} by {selectedVersion.Modified_By})</>
                  )}
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  size="small"
                  onClick={handleDownloadExcel}
                  disabled={!selectedProject || jobTaskLines.length === 0}
                >
                  Download Excel
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<UploadIcon />}
                  size="small"
                  component="label"
                  disabled={!selectedProject || jobTaskLines.length === 0}
                >
                  Upload Excel
                  <input
                    type="file"
                    hidden
                    accept=".csv,.xlsx,.xls"
                    onChange={handleUploadExcel}
                  />
                </Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card sx={{ mb: 2, backgroundColor: '#ffebee' }}>
          <CardContent sx={{ py: 1.5 }}>
            <Typography color="error" variant="body2">
              ⚠️ {error}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Job Task Lines Table */}
      <Card>
        <CardContent>
          <TableContainer component={Paper} sx={{ maxHeight: 600, border: '1px solid #ddd', overflowX: 'auto' }}>
            <Table stickyHeader aria-label="job task lines table" sx={{ minWidth: 650 }} size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#0078D7' }}>
                  <TableCell sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#0078D7', border: '1px solid #ddd', minWidth: 100, fontSize: '0.7rem', py: 0.5, px: 1 }}>
                    Job Task No
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: 'white', backgroundColor: '#0078D7', border: '1px solid #ddd', minWidth: 180, fontSize: '0.7rem', py: 0.5, px: 1 }}>
                    Description
                  </TableCell>
                  {monthColumns.map((month, index) => (
                    <TableCell 
                      key={index}
                      sx={{ 
                        fontWeight: 'bold', 
                        color: 'white', 
                        backgroundColor: '#0078D7', 
                        border: '1px solid #ddd',
                        minWidth: 80,
                        textAlign: 'center',
                        fontSize: '0.7rem',
                        py: 0.5,
                        px: 1
                      }}
                    >
                      {month.label}
                    </TableCell>
                  ))}
                  <TableCell 
                    sx={{ 
                      fontWeight: 'bold', 
                      color: 'white', 
                      backgroundColor: '#0078D7', 
                      border: '1px solid #ddd',
                      minWidth: 100,
                      textAlign: 'center',
                      fontSize: '0.7rem',
                      py: 0.5,
                      px: 1
                    }}
                  >
                    Total
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!selectedProject ? (
                  <TableRow>
                    <TableCell colSpan={3 + monthColumns.length} align="center" sx={{ py: 4, color: 'text.secondary', fontSize: '0.75rem' }}>
                      <Typography variant="body2">
                        Please select a project to view job task lines.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : isLoadingTasks ? (
                  <TableRow>
                    <TableCell colSpan={3 + monthColumns.length} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={24} />
                      <Typography variant="body2" sx={{ mt: 1, fontSize: '0.75rem' }}>
                        Loading job task lines...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : jobTaskLines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3 + monthColumns.length} align="center" sx={{ py: 4, color: 'text.secondary', fontSize: '0.75rem' }}>
                      <Typography variant="body2">
                        No job task lines found for this project.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  jobTaskLines.map((task, index) => {
                    const isTotal = task.Job_Task_Type === 'Total';
                    return (
                      <TableRow 
                        key={`${task.Job_No}-${task.Job_Task_No}-${index}`} 
                        hover={!isTotal}
                        sx={{ 
                          backgroundColor: isTotal ? '#ADD8E6' : 'inherit',
                          '&:hover': {
                            backgroundColor: isTotal ? '#ADD8E6' : undefined
                          }
                        }}
                      >
                        <TableCell sx={{ py: 0.5, px: 1, border: '1px solid #ddd', fontSize: '0.7rem', fontWeight: isTotal ? 'bold' : 'normal' }}>
                          {task.Job_Task_No}
                        </TableCell>
                        <TableCell sx={{ py: 0.5, px: 1, border: '1px solid #ddd', fontSize: '0.7rem', fontWeight: isTotal ? 'bold' : 'normal' }}>
                          {task.Description}
                        </TableCell>
                        {monthColumns.map((month, monthIndex) => {
                          const budgetValue = isTotal 
                            ? calculateTaskTotal(task.Job_Task_No, month.date)
                            : getBudgetValue(task.Job_Task_No, month.date);
                          
                          return (
                            <TableCell 
                              key={monthIndex}
                              sx={{ 
                                py: 0.5, 
                                px: 1, 
                                border: '1px solid #ddd',
                                textAlign: 'center',
                                fontSize: '0.7rem',
                                fontWeight: isTotal ? 'bold' : 'normal',
                                backgroundColor: isTotal ? '#ADD8E6' : (pendingChanges.has(getCellKey(task.Job_Task_No, month.date)) ? '#fff9c4' : undefined)
                              }}
                            >
                              {budgetValue > 0 ? budgetValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </TableCell>
                          );
                        })}
                        <TableCell 
                          sx={{ 
                            py: 0.5, 
                            px: 1, 
                            border: '1px solid #ddd',
                            textAlign: 'center',
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                            backgroundColor: '#f5f5f5'
                          }}
                        >
                          {(() => {
                            const rowTotal = monthColumns.reduce((sum, month) => {
                              const value = isTotal 
                                ? calculateTaskTotal(task.Job_Task_No, month.date)
                                : getBudgetValue(task.Job_Task_No, month.date);
                              return sum + (value || 0);
                            }, 0);
                            return rowTotal > 0 ? rowTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
                          })()}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
                {/* Grand Total Row */}
                {jobTaskLines.length > 0 && monthColumns.length > 0 && (
                  <TableRow sx={{ backgroundColor: '#90EE90', fontWeight: 'bold' }}>
                    <TableCell sx={{ py: 0.5, px: 1, border: '1px solid #ddd', fontSize: '0.7rem', fontWeight: 'bold' }} colSpan={2}>
                      GRAND TOTAL
                    </TableCell>
                    {monthColumns.map((month, monthIndex) => {
                      const columnTotal = jobTaskLines
                        .filter(task => task.Job_Task_Type !== 'Total')
                        .reduce((sum, task) => {
                          return sum + (getBudgetValue(task.Job_Task_No, month.date) || 0);
                        }, 0);
                      return (
                        <TableCell 
                          key={monthIndex}
                          sx={{ 
                            py: 0.5, 
                            px: 1, 
                            border: '1px solid #ddd',
                            textAlign: 'center',
                            fontSize: '0.7rem',
                            fontWeight: 'bold'
                          }}
                        >
                          {columnTotal > 0 ? columnTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                        </TableCell>
                      );
                    })}
                    <TableCell 
                      sx={{ 
                        py: 0.5, 
                        px: 1, 
                        border: '1px solid #ddd',
                        textAlign: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        backgroundColor: '#FFA500'
                      }}
                    >
                      {(() => {
                        const grandTotal = monthColumns.reduce((sum, month) => {
                          const monthTotal = jobTaskLines
                            .filter(task => task.Job_Task_Type !== 'Total')
                            .reduce((taskSum, task) => {
                              return taskSum + (getBudgetValue(task.Job_Task_No, month.date) || 0);
                            }, 0);
                          return sum + monthTotal;
                        }, 0);
                        return grandTotal > 0 ? grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
                      })()}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Save Budget Dialog */}
      <SaveBudgetDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        onSave={handleSaveBudget}
        currentVersionName={selectedVersion?.Version_Name}
        changeCount={pendingChanges.size}
        mode={saveDialogMode}
        isSaving={isSaving}
      />

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
