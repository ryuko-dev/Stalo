import { useState, useMemo, useRef } from 'react';
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
  DialogActions,
  Checkbox
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
import { getResources, createResource, updateResource, deleteResource, getEntities } from '../services/staloService';
import { usePermissions } from '../contexts/PermissionsContext';
import type { Resource } from '../types';
import type { Entity } from '../types/entities';
import { format } from 'date-fns';
import * as XLSX from 'xlsx-js-style';

const resourceTypes = ['Staff', 'SME'];
const workDaysOptions = ['Mon-Fri', 'Sun-Thu'];

export default function Resources() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { getPagePermissions } = usePermissions();
  const pagePermissions = getPagePermissions('resources');
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'staff' | 'sme'>('all');
  const [filterEntity, setFilterEntity] = useState<string>('all');
  const [editingResource, setEditingResource] = useState<Resource | null>(null);

  const showNotification = (message: string, severity: 'success' | 'error' = 'success') => {
    setNotification({ open: true, message, severity });
  };

  // Excel download function
  const downloadExcel = () => {
    try {
      const worksheetData = filteredResources.map(resource => ({
        'Name': resource.Name || '',
        'Type': resource.ResourceType || '',
        'Entity': resource.EntityName || resource.Entity || '',
        'Vendor Account': resource.DynamicsVendorAcc || '',
        'Start Date': resource.StartDate ? format(new Date(resource.StartDate), 'yyyy-MM-dd') : '',
        'End Date': resource.EndDate ? format(new Date(resource.EndDate), 'yyyy-MM-dd') : '',
        'Work Days': resource.WorkDays || '',
        'Department': resource.Department || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Resources');
      
      // Set column widths
      const colWidths = [
        { wch: 20 }, // Name
        { wch: 10 }, // Type
        { wch: 15 }, // Entity
        { wch: 15 }, // Vendor Account
        { wch: 12 }, // Start Date
        { wch: 12 }, // End Date
        { wch: 10 }, // Work Days
        { wch: 15 }  // Department
      ];
      worksheet['!cols'] = colWidths;

      XLSX.writeFile(workbook, `resources_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      showNotification('Resources downloaded successfully!', 'success');
    } catch (error) {
      showNotification('Error downloading Excel file', 'error');
    }
  };

  // Excel upload function
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        let successCount = 0;
        let errorCount = 0;

        jsonData.forEach((row) => {
          try {
            const resourceData: Partial<Resource> = {
              Name: row['Name'] || '',
              ResourceType: row['Type'] || '',
              Entity: row['Entity'] || '',
              DynamicsVendorAcc: row['Vendor Account'] || '',
              StartDate: row['Start Date'] ? new Date(row['Start Date']).toISOString().split('T')[0] : '',
              EndDate: row['End Date'] ? new Date(row['End Date']).toISOString().split('T')[0] : null,
              WorkDays: row['Work Days'] || '',
              Department: row['Department'] || ''
            };

            // Validate required fields
            if (resourceData.Name && resourceData.ResourceType && resourceData.Entity && 
                resourceData.StartDate && resourceData.WorkDays && resourceData.Department) {
              createMutation.mutate(resourceData);
              successCount++;
            } else {
              errorCount++;
            }
          } catch (error) {
            errorCount++;
          }
        });

        showNotification(
          `Upload completed: ${successCount} resources added, ${errorCount} failed`, 
          successCount > 0 ? 'success' : 'error'
        );
      } catch (error) {
        showNotification('Error reading Excel file', 'error');
      }
    };

    reader.readAsArrayBuffer(file);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const { data: resourcesData } = useQuery<Resource[], Error>({ 
    queryKey: ['resources'], 
    queryFn: getResources, 
    staleTime: 1000 * 60 * 5 
  });
  
  const { data: entitiesData } = useQuery<Entity[], Error>({ 
    queryKey: ['entities'], 
    queryFn: getEntities, 
    staleTime: 1000 * 60 * 5 
  });

  const createMutation = useMutation<Resource, Error, Partial<Resource>>({
    mutationFn: (payload) => createResource(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      showNotification('Resource created successfully!', 'success');
    },
    onError: (error) => {
      showNotification(`Error creating resource: ${error.message}`, 'error');
    }
  });

  const updateMutation = useMutation<Resource, Error, { id: string; payload: Partial<Resource> }>({
    mutationFn: ({ id, payload }) => updateResource(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      showNotification('Resource updated successfully!', 'success');
    },
    onError: (error) => {
      showNotification(`Error updating resource: ${error.message}`, 'error');
    }
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (id) => deleteResource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      showNotification('Resource deleted successfully!', 'success');
    },
    onError: (error: any) => {
      console.log('=== DELETE ERROR DEBUG ===');
      console.log('Full error object:', error);
      console.log('error.response:', error.response);
      console.log('error.response?.data:', error.response?.data);
      console.log('error.response?.data?.details:', error.response?.data?.details);
      console.log('error.response?.data?.error:', error.response?.data?.error);
      console.log('error.message:', error.message);
      console.log('========================');
      
      // Extract detailed error message from backend
      let errorMessage = 'Failed to delete resource';
      if (error.response?.data) {
        console.log('Using response.data');
        // Try to get the most detailed error message available
        errorMessage = error.response.data.details || error.response.data.error || error.response.data.message || errorMessage;
      } else if (error.message) {
        console.log('Using error.message');
        errorMessage = error.message;
      }
      console.log('Final error message:', errorMessage);
      showNotification(errorMessage, 'error');
    }
  });

  const [newResource, setNewResource] = useState<Partial<Resource>>({
    Name: '',
    ResourceType: '',
    Entity: '',
    DynamicsVendorAcc: '',
    StartDate: '',
    EndDate: null,
    WorkDays: '',
    Department: '',
  });

  const resources = resourcesData ?? [];
  const entities = entitiesData ?? [];

  // Filter resources based on search and filters
  const filteredResources = useMemo(() => {
    return resources
      .filter(resource => {
        const matchesSearch = resource.Name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             resource.Department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             resource.DynamicsVendorAcc?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             (resource.EntityName?.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesType = filterType === 'all' || 
                          (filterType === 'staff' && resource.ResourceType === 'Staff') ||
                          (filterType === 'sme' && resource.ResourceType === 'SME');
        
        const matchesEntity = filterEntity === 'all' || resource.Entity === filterEntity;
        
        return matchesSearch && matchesType && matchesEntity;
      })
      .sort((a, b) => {
        // Sort by StartDate, latest first
        const dateA = a.StartDate ? new Date(a.StartDate).getTime() : 0;
        const dateB = b.StartDate ? new Date(b.StartDate).getTime() : 0;
        return dateB - dateA; // Descending order (latest first)
      });
  }, [resources, searchTerm, filterType, filterEntity]);

  const handleCreate = () => {
    if (!newResource.Name || !newResource.ResourceType || !newResource.Entity || !newResource.StartDate || !newResource.WorkDays || !newResource.Department) {
      showNotification('Please fill in all required fields!', 'error');
      return;
    }
    createMutation.mutate(newResource);
    setNewResource({
      Name: '',
      ResourceType: '',
      Entity: '',
      DynamicsVendorAcc: '',
      StartDate: '',
      EndDate: null,
      WorkDays: '',
      Department: '',
    });
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 2, backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
        {/* Compact Header */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold', color: '#333' }}>
            Resources
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              onClick={downloadExcel}
              sx={{ fontSize: '0.75rem' }}
            >
              Download Excel
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<UploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              sx={{ fontSize: '0.75rem' }}
            >
              Upload Excel
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <Chip 
              label={`${filteredResources.length}/${resources.length}`} 
              color="primary" 
              variant="outlined" 
              size="small"
            />
          </Box>
        </Box>

        {/* Compact Add Resource Form */}
        {pagePermissions.canEdit && (
          <Card sx={{ mb: 2, boxShadow: 1 }}>
            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 1, display: 'block', color: '#666' }}>
                ADD NEW RESOURCE
              </Typography>
            
            {/* Header Row */}
            <Box sx={{ display: 'flex', gap: 1, mb: 0.5, alignItems: 'center' }}>
              <Box sx={{ flex: '1 1 180px', minWidth: '180px' }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>NAME *</Typography>
              </Box>
              <Box sx={{ flex: '0 1 100px', minWidth: '100px' }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>TYPE *</Typography>
              </Box>
              <Box sx={{ flex: '0 1 150px', minWidth: '150px' }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>ENTITY *</Typography>
              </Box>
              <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>VENDOR ACC</Typography>
              </Box>
              <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>START *</Typography>
              </Box>
              <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>END</Typography>
              </Box>
              <Box sx={{ flex: '0 1 100px', minWidth: '100px' }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>WORK DAYS *</Typography>
              </Box>
              <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>DEPARTMENT *</Typography>
              </Box>
              <Box sx={{ flex: '0 1 60px', minWidth: '60px' }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>ACTION</Typography>
              </Box>
            </Box>
            
            {/* Input Row */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <Box sx={{ flex: '1 1 180px', minWidth: '180px' }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Resource name"
                  value={newResource.Name || ''}
                  onChange={(e) => setNewResource({ ...newResource, Name: e.target.value })}
                  sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
                />
              </Box>
              <Box sx={{ flex: '0 1 100px', minWidth: '100px' }}>
                <FormControl fullWidth size="small">
                  <Select
                    value={newResource.ResourceType || ''}
                    displayEmpty
                    onChange={(e) => setNewResource({ ...newResource, ResourceType: e.target.value })}
                    renderValue={(value) => {
                      if (!value) return <em style={{ fontSize: '0.75rem' }}>Type</em>;
                      return <span style={{ fontSize: '0.75rem' }}>{value}</span>;
                    }}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    <MenuItem value=""><em style={{ fontSize: '0.75rem' }}>Type</em></MenuItem>
                    {resourceTypes.map((type) => (
                      <MenuItem key={type} value={type} sx={{ fontSize: '0.75rem' }}>{type}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ flex: '0 1 150px', minWidth: '150px' }}>
                <FormControl fullWidth size="small">
                  <Select
                    value={newResource.Entity || ''}
                    displayEmpty
                    onChange={(e) => setNewResource({ ...newResource, Entity: e.target.value })}
                    renderValue={(value) => {
                      if (!value) return <em style={{ fontSize: '0.75rem' }}>Select entity</em>;
                      const entity = entities.find(e => e.ID === value);
                      return <span style={{ fontSize: '0.75rem' }}>{entity?.Name || value}</span>;
                    }}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    <MenuItem value=""><em style={{ fontSize: '0.75rem' }}>Select entity</em></MenuItem>
                    {entities.map((entity) => (
                      <MenuItem key={entity.ID} value={entity.ID} sx={{ fontSize: '0.75rem' }}>{entity.Name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Vendor account"
                  value={newResource.DynamicsVendorAcc || ''}
                  onChange={(e) => setNewResource({ ...newResource, DynamicsVendorAcc: e.target.value })}
                  sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
                />
              </Box>
              <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
                <DatePicker
                  value={newResource.StartDate ? new Date(newResource.StartDate) : null}
                  onChange={(date) => setNewResource({ ...newResource, StartDate: date ? date.toISOString().split('T')[0] : '' })}
                  slotProps={{
                    textField: {
                      size: 'small',
                      placeholder: 'Start date',
                      sx: { '& .MuiInputBase-input': { fontSize: '0.75rem' } }
                    }
                  }}
                />
              </Box>
              <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
                <DatePicker
                  value={newResource.EndDate ? new Date(newResource.EndDate) : null}
                  onChange={(date) => setNewResource({ ...newResource, EndDate: date ? date.toISOString().split('T')[0] : null })}
                  slotProps={{
                    textField: {
                      size: 'small',
                      placeholder: 'End date',
                      sx: { '& .MuiInputBase-input': { fontSize: '0.75rem' } }
                    }
                  }}
                />
              </Box>
              <Box sx={{ flex: '0 1 100px', minWidth: '100px' }}>
                <FormControl fullWidth size="small">
                  <Select
                    value={newResource.WorkDays || ''}
                    displayEmpty
                    onChange={(e) => setNewResource({ ...newResource, WorkDays: e.target.value })}
                    renderValue={(value) => {
                      if (!value) return <em style={{ fontSize: '0.75rem' }}>Days</em>;
                      return <span style={{ fontSize: '0.75rem' }}>{value}</span>;
                    }}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    <MenuItem value=""><em style={{ fontSize: '0.75rem' }}>Days</em></MenuItem>
                    {workDaysOptions.map((option) => (
                      <MenuItem key={option} value={option} sx={{ fontSize: '0.75rem' }}>{option}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Department"
                  value={newResource.Department || ''}
                  onChange={(e) => setNewResource({ ...newResource, Department: e.target.value })}
                  sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
                />
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
        )}

        {/* Compact Resources Table */}
        <Card sx={{ boxShadow: 1 }}>
          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
            {/* Filters */}
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', backgroundColor: '#fafafa' }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search resources..."
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
                      value={filterEntity}
                      onChange={(e) => setFilterEntity(e.target.value)}
                      startAdornment={
                        <InputAdornment position="start">
                          <FilterIcon />
                        </InputAdornment>
                      }
                    >
                      <MenuItem value="all">All Entities</MenuItem>
                      {entities.map((entity) => (
                        <MenuItem key={entity.ID} value={entity.ID}>{entity.Name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ flex: '0 1 150px', minWidth: '150px' }}>
                  <FormControl fullWidth size="small">
                    <Select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value as 'all' | 'staff' | 'sme')}
                    >
                      <MenuItem value="all">All Types</MenuItem>
                      <MenuItem value="staff">Staff</MenuItem>
                      <MenuItem value="sme">SME</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ flex: '0 1 auto' }}>
                  <Typography variant="body2" color="text.secondary">
                    {filteredResources.length} of {resources.length} resources
                  </Typography>
                </Box>
              </Box>
            </Box>

            <TableContainer sx={{ maxHeight: '60vh' }}>
              <Table size="small" stickyHeader sx={{ '& .MuiTableCell-root': { py: 0.5 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5 }}>Name</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5 }}>Type</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5 }}>Entity</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5 }}>Vendor Acc</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5 }}>Start Date</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5 }}>End Date</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5 }}>Work Days</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5 }}>Department</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5, textAlign: 'center' }}>Track</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5, textAlign: 'center' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredResources.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          {resources.length === 0 ? 'No resources found. Create your first resource above!' : 'No resources match your filters.'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredResources.map((resource) => (
                      <TableRow key={resource.ID} hover sx={{ '&:hover': { backgroundColor: '#f8f9fa' } }}>
                        <TableCell sx={{ p: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                            {resource.Name}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ p: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                            {resource.ResourceType}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ p: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                            {resource.EntityName || resource.Entity}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ p: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                            {resource.DynamicsVendorAcc || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ p: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                            {resource.StartDate ? format(new Date(resource.StartDate), 'MMM dd, yyyy') : 'No start date'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ p: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                            {resource.EndDate ? format(new Date(resource.EndDate), 'MMM dd, yyyy') : 'No end date'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ p: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                            {resource.WorkDays}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ p: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                            {resource.Department}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ p: 0.5, textAlign: 'center' }}>
                          <Checkbox
                            checked={resource.Track !== false}
                            onChange={(e) => {
                              updateMutation.mutate({
                                id: resource.ID,
                                payload: { Track: e.target.checked }
                              });
                            }}
                            disabled={!pagePermissions.canEdit || updateMutation.isPending}
                            size="small"
                          />
                        </TableCell>
                        <TableCell sx={{ p: 0.5, textAlign: 'center' }}>
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                            {pagePermissions.canEdit && (
                              <IconButton 
                                size="small" 
                                color="primary" 
                                onClick={() => setEditingResource(resource)}
                                disabled={updateMutation.isPending}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            )}
                            {pagePermissions.canDelete && (
                              <IconButton 
                                size="small" 
                                color="error" 
                                onClick={() => deleteMutation.mutate(resource.ID)}
                                disabled={deleteMutation.isPending}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
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
          autoHideDuration={notification.severity === 'error' ? 8000 : 4000}
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

        {/* Edit Resource Dialog */}
        <Dialog 
          open={!!editingResource} 
          onClose={() => setEditingResource(null)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Edit Resource</DialogTitle>
          <DialogContent>
            {editingResource && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                <TextField
                  label="Name"
                  fullWidth
                  defaultValue={editingResource.Name}
                  onBlur={(e) => {
                    if (e.target.value !== editingResource.Name) {
                      updateMutation.mutate({ id: editingResource.ID, payload: { Name: e.target.value } });
                    }
                  }}
                />
                <FormControl fullWidth>
                  <Select
                    value={editingResource.ResourceType || ''}
                    onChange={(e) => {
                      updateMutation.mutate({ id: editingResource.ID, payload: { ResourceType: e.target.value } });
                    }}
                  >
                    <MenuItem value="">Resource Type</MenuItem>
                    {resourceTypes.map((type) => (
                      <MenuItem key={type} value={type}>{type}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <Select
                    value={editingResource.Entity || ''}
                    onChange={(e) => {
                      updateMutation.mutate({ id: editingResource.ID, payload: { Entity: e.target.value } });
                    }}
                  >
                    <MenuItem value="">Select Entity</MenuItem>
                    {entities.map((entity) => (
                      <MenuItem key={entity.ID} value={entity.ID}>{entity.Name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Vendor Account"
                  fullWidth
                  defaultValue={editingResource.DynamicsVendorAcc}
                  onBlur={(e) => {
                    if (e.target.value !== editingResource.DynamicsVendorAcc) {
                      updateMutation.mutate({ id: editingResource.ID, payload: { DynamicsVendorAcc: e.target.value } });
                    }
                  }}
                />
                <DatePicker
                  label="Start Date"
                  value={editingResource.StartDate ? new Date(editingResource.StartDate) : null}
                  onChange={(date) => {
                    if (date) {
                      updateMutation.mutate({ id: editingResource.ID, payload: { StartDate: date.toISOString().split('T')[0] } });
                    }
                  }}
                />
                <DatePicker
                  label="End Date"
                  value={editingResource.EndDate ? new Date(editingResource.EndDate) : null}
                  onChange={(date) => {
                    if (date) {
                      updateMutation.mutate({ id: editingResource.ID, payload: { EndDate: date.toISOString().split('T')[0] } });
                    } else {
                      updateMutation.mutate({ id: editingResource.ID, payload: { EndDate: null } });
                    }
                  }}
                />
                <FormControl fullWidth>
                  <Select
                    value={editingResource.WorkDays || ''}
                    onChange={(e) => {
                      updateMutation.mutate({ id: editingResource.ID, payload: { WorkDays: e.target.value } });
                    }}
                  >
                    <MenuItem value="">Work Days</MenuItem>
                    {workDaysOptions.map((option) => (
                      <MenuItem key={option} value={option}>{option}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Department"
                  fullWidth
                  defaultValue={editingResource.Department}
                  onBlur={(e) => {
                    if (e.target.value !== editingResource.Department) {
                      updateMutation.mutate({ id: editingResource.ID, payload: { Department: e.target.value } });
                    }
                  }}
                />
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditingResource(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
}
