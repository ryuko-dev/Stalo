import { useState, useMemo } from 'react';
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
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputLabel
} from '@mui/material';
import { 
  Delete as DeleteIcon, 
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Timeline as TimelineIcon,
  Edit as EditIcon,
  CloudSync as CloudSyncIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProjects, createProject, updateProject, deleteProject, getSystemUsers } from '../services/staloService';
import { useAuth } from '../contexts/AuthContext';
import type { Project } from '../types';
import type { SystemUser } from '../types/systemUsers';
import GanttChart from './GanttChart';
import { format } from 'date-fns';

const allocationModes = ['%', 'Days'];

export default function Projects() {
  const queryClient = useQueryClient();
  const { isAuthenticated, login, logout, userDisplayName, isLoading: authLoading } = useAuth();
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all');
  const [ganttDialogOpen, setGanttDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const showNotification = (message: string, severity: 'success' | 'error' = 'success') => {
    setNotification({ open: true, message, severity });
  };

  const { data: projectsData } = useQuery<Project[], Error>({ 
    queryKey: ['projects'], 
    queryFn: getProjects, 
    staleTime: 1000 * 60 * 5 
  });
  const { data: usersData } = useQuery<SystemUser[], Error>({ 
    queryKey: ['systemUsers'], 
    queryFn: getSystemUsers, 
    staleTime: 1000 * 60 * 5 
  });

  const createMutation = useMutation<Project, Error, Partial<Project>>({
    mutationFn: (payload) => createProject(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      showNotification('Project created successfully!', 'success');
    },
    onError: (error) => {
      showNotification(`Error creating project: ${error.message}`, 'error');
    }
  });

  const updateMutation = useMutation<Project, Error, { id: string; payload: Partial<Project> }>({
    mutationFn: ({ id, payload }) => updateProject(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      showNotification('Project updated successfully!', 'success');
    },
    onError: (error) => {
      showNotification(`Error updating project: ${error.message}`, 'error');
    }
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (id) => deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      showNotification('Project deleted successfully!', 'success');
    },
    onError: (error) => {
      showNotification(`Error deleting project: ${error.message}`, 'error');
    }
  });

  const [newProject, setNewProject] = useState<Partial<Project>>({
    Name: '',
    StartDate: '',
    EndDate: '',
    ProjectCurrency: '',
    ProjectBudget: undefined,
    BudgetManager: '',
    AllocationMode: allocationModes[0],
    Fringe: 'No',
  });

  const projects = projectsData ?? [];
  const budgetManagers = useMemo(() => (usersData ?? []), [usersData]);

  const handleCreate = () => {
    if (!newProject.Name) {
      showNotification('Project name is required!', 'error');
      return;
    }
    createMutation.mutate(newProject);
    setNewProject({ Name: '', StartDate: '', EndDate: '', ProjectCurrency: '', ProjectBudget: undefined, BudgetManager: '', AllocationMode: allocationModes[0], Fringe: 'No' });
  };

  // Filter projects based on search and status
  const filteredProjects = useMemo(() => {
    return projects
      .filter(project => {
        const matchesSearch = project.Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             (project.ProjectCurrency?.toLowerCase().includes(searchTerm.toLowerCase())) ||
                             (budgetManagers.find(m => m.ID === project.BudgetManager)?.Name.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const now = new Date();
        const isActive = project.StartDate && project.EndDate && 
                        new Date(project.StartDate) <= now && new Date(project.EndDate) >= now;
        const isCompleted = project.EndDate && new Date(project.EndDate) < now;
        
        switch (filterStatus) {
          case 'active':
            return matchesSearch && isActive;
          case 'completed':
            return matchesSearch && isCompleted;
          default:
            return matchesSearch;
        }
      })
      .sort((a, b) => {
        // Sort by end date, latest first
        const dateA = a.EndDate ? new Date(a.EndDate).getTime() : 0;
        const dateB = b.EndDate ? new Date(b.EndDate).getTime() : 0;
        return dateB - dateA; // Descending order (latest first)
      });
  }, [projects, searchTerm, filterStatus, budgetManagers]);

  return (
    <Box sx={{ p: 2, backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      {/* Compact Header */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold', color: '#333' }}>
          Projects
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {isAuthenticated && (
            <Chip
              label={`Connected: ${userDisplayName}`}
              color="success"
              variant="filled"
              size="small"
              sx={{ fontWeight: 'bold' }}
            />
          )}
          <Tooltip title={isAuthenticated ? 'Disconnect from Business Central' : 'Connect to Business Central'}>
            <Button 
              variant={isAuthenticated ? 'contained' : 'outlined'}
              color={isAuthenticated ? 'success' : 'primary'}
              size="small" 
              startIcon={<CloudSyncIcon />}
              onClick={() => isAuthenticated ? logout() : login()}
              disabled={authLoading}
            >
              {authLoading ? 'Connecting...' : isAuthenticated ? 'Disconnect' : 'Connect to BC'}
            </Button>
          </Tooltip>
          <Tooltip title="View Gantt Chart">
            <Button 
              variant="outlined" 
              size="small" 
              startIcon={<TimelineIcon />}
              onClick={() => setGanttDialogOpen(true)}
            >
              Gantt
            </Button>
          </Tooltip>
          <Chip 
            label={`${filteredProjects.length}/${projects.length}`} 
            color="primary" 
            variant="outlined" 
            size="small"
          />
        </Box>
      </Box>

      {/* Compact Add Project Form */}
      <Card sx={{ mb: 2, boxShadow: 1 }}>
        <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 1, display: 'block', color: '#666' }}>
            ADD NEW PROJECT
          </Typography>
          
          {/* Header Row */}
          <Box sx={{ display: 'flex', gap: 1, mb: 0.5, alignItems: 'center' }}>
            <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>PROJECT *</Typography>
            </Box>
            <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>START *</Typography>
            </Box>
            <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>END *</Typography>
            </Box>
            <Box sx={{ flex: '0 1 90px', minWidth: '90px' }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>CURRENCY</Typography>
            </Box>
            <Box sx={{ flex: '0 1 90px', minWidth: '90px' }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>BUDGET</Typography>
            </Box>
            <Box sx={{ flex: '0 1 140px', minWidth: '140px' }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>MANAGER</Typography>
            </Box>
            <Box sx={{ flex: '0 1 80px', minWidth: '80px' }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>MODE</Typography>
            </Box>
            <Box sx={{ flex: '0 1 80px', minWidth: '80px' }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>FRINGE</Typography>
            </Box>
            <Box sx={{ flex: '0 1 80px', minWidth: '80px' }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>ACTION</Typography>
            </Box>
          </Box>
          
          {/* Input Row */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
              <TextField 
                fullWidth 
                size="small" 
                placeholder="Project name"
                value={newProject.Name ?? ''} 
                onChange={(e) => setNewProject({ ...newProject, Name: e.target.value })}
                variant="outlined"
                sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
              />
            </Box>
            <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
              <TextField 
                fullWidth
                size="small" 
                type="date" 
                InputLabelProps={{ shrink: true }} 
                value={newProject.StartDate ?? ''} 
                onChange={(e) => setNewProject({ ...newProject, StartDate: e.target.value })}
                sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
              />
            </Box>
            <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
              <TextField 
                fullWidth
                size="small" 
                type="date" 
                InputLabelProps={{ shrink: true }} 
                value={newProject.EndDate ?? ''} 
                onChange={(e) => setNewProject({ ...newProject, EndDate: e.target.value })}
                sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
              />
            </Box>
            <Box sx={{ flex: '0 1 90px', minWidth: '90px' }}>
              <TextField 
                fullWidth
                size="small" 
                placeholder="USD"
                value={newProject.ProjectCurrency ?? ''} 
                onChange={(e) => setNewProject({ ...newProject, ProjectCurrency: e.target.value })}
                sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
              />
            </Box>
            <Box sx={{ flex: '0 1 90px', minWidth: '90px' }}>
              <TextField 
                fullWidth
                size="small" 
                type="number" 
                placeholder="0"
                value={newProject.ProjectBudget ?? ''} 
                onChange={(e) => setNewProject({ ...newProject, ProjectBudget: Number(e.target.value) })}
                sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
              />
            </Box>
            <Box sx={{ flex: '0 1 140px', minWidth: '140px' }}>
              <FormControl fullWidth size="small">
                <Select
                  value={newProject.BudgetManager ?? ''}
                  onChange={(e) => setNewProject({ ...newProject, BudgetManager: String(e.target.value) })}
                  displayEmpty
                  renderValue={(value) => {
                    if (!value) return <em style={{ fontSize: '0.75rem' }}>Select manager</em>;
                    const manager = budgetManagers.find(u => u.ID === value);
                    return <span style={{ fontSize: '0.75rem' }}>{manager?.Name || value}</span>;
                  }}
                  sx={{ fontSize: '0.75rem' }}
                >
                  <MenuItem value=""><em style={{ fontSize: '0.75rem' }}>None</em></MenuItem>
                  {budgetManagers.map((u) => (
                    <MenuItem key={u.ID} value={u.ID} sx={{ fontSize: '0.75rem' }}>{u.Name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ flex: '0 1 80px', minWidth: '80px' }}>
              <FormControl fullWidth size="small">
                <Select
                  value={newProject.AllocationMode ?? allocationModes[0]}
                  onChange={(e) => setNewProject({ ...newProject, AllocationMode: String(e.target.value) })}
                  sx={{ fontSize: '0.75rem' }}
                >
                  {allocationModes.map((m) => (
                    <MenuItem key={m} value={m} sx={{ fontSize: '0.75rem' }}>{m}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ flex: '0 1 80px', minWidth: '80px' }}>
              <FormControl fullWidth size="small">
                <Select
                  value={newProject.Fringe ?? 'No'}
                  onChange={(e) => setNewProject({ ...newProject, Fringe: String(e.target.value) })}
                  sx={{ fontSize: '0.75rem' }}
                >
                  <MenuItem value="Yes" sx={{ fontSize: '0.75rem' }}>Yes</MenuItem>
                  <MenuItem value="No" sx={{ fontSize: '0.75rem' }}>No</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ flex: '0 1 80px', minWidth: '80px' }}>
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

      {/* Compact Projects Table */}
      <Card sx={{ boxShadow: 1 }}>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          {/* Filters */}
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', backgroundColor: '#fafafa' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
              <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search projects..."
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
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'completed')}
                    startAdornment={
                      <InputAdornment position="start">
                        <FilterIcon />
                      </InputAdornment>
                    }
                  >
                    <MenuItem value="all">All Projects</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ flex: '0 1 auto' }}>
                <Typography variant="body2" color="text.secondary">
                  {filteredProjects.length} of {projects.length} projects
                </Typography>
              </Box>
            </Box>
          </Box>

          <TableContainer sx={{ maxHeight: '60vh' }}>
            <Table size="small" stickyHeader sx={{ '& .MuiTableCell-root': { py: 0.5 } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5 }}>Project</TableCell>
                  <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5 }}>Start Date</TableCell>
                  <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5 }}>End Date</TableCell>
                  <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5 }}>Currency</TableCell>
                  <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5 }}>Budget</TableCell>
                  <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5 }}>Manager</TableCell>
                  <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5 }}>Mode</TableCell>
                  <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5 }}>Fringe</TableCell>
                  <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 0.5, textAlign: 'center' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        {projects.length === 0 ? 'No projects found. Create your first project above!' : 'No projects match your filters.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProjects.map((p) => (
                    <TableRow key={p.ID} hover sx={{ '&:hover': { backgroundColor: '#f8f9fa' } }}>
                      <TableCell sx={{ p: 0.5 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.7rem' }}>
                          {p.Name}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ p: 0.5 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                          {p.StartDate ? format(new Date(p.StartDate), 'MMM dd, yyyy') : 'No start date'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ p: 0.5 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                          {p.EndDate ? format(new Date(p.EndDate), 'MMM dd, yyyy') : 'No end date'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ p: 0.5 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                          {p.ProjectCurrency || 'No currency'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ p: 0.5 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                          {p.ProjectBudget ? `${p.ProjectBudget.toLocaleString()}` : 'No budget'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ p: 0.5 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                          {(() => {
                            const manager = budgetManagers.find(u => u.ID === p.BudgetManager);
                            return manager?.Name || 'No manager';
                          })()}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ p: 0.5 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                          {p.AllocationMode || allocationModes[0]}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ p: 0.5 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                          {p.Fringe || 'No'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ p: 0.5, textAlign: 'center' }}>
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                          <IconButton 
                            size="small" 
                            color="primary" 
                            onClick={() => setEditingProject(p)}
                            disabled={updateMutation.isPending}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton 
                            size="small" 
                            color="error" 
                            onClick={() => deleteMutation.mutate(p.ID)}
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

      {/* Edit Project Dialog */}
      <Dialog 
        open={!!editingProject} 
        onClose={() => setEditingProject(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Project</DialogTitle>
        <DialogContent>
          {editingProject && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField
                label="Project Name"
                fullWidth
                defaultValue={editingProject.Name}
                onBlur={(e) => {
                  if (e.target.value !== editingProject.Name) {
                    updateMutation.mutate({ id: editingProject.ID, payload: { Name: e.target.value } });
                  }
                }}
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Start Date"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  defaultValue={editingProject.StartDate?.substring(0, 10)}
                  onBlur={(e) => {
                    if (e.target.value !== editingProject.StartDate?.substring(0, 10)) {
                      updateMutation.mutate({ id: editingProject.ID, payload: { StartDate: e.target.value } });
                    }
                  }}
                />
                <TextField
                  label="End Date"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  defaultValue={editingProject.EndDate?.substring(0, 10)}
                  onBlur={(e) => {
                    if (e.target.value !== editingProject.EndDate?.substring(0, 10)) {
                      updateMutation.mutate({ id: editingProject.ID, payload: { EndDate: e.target.value } });
                    }
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Currency"
                  defaultValue={editingProject.ProjectCurrency || ''}
                  onBlur={(e) => {
                    if (e.target.value !== (editingProject.ProjectCurrency || '')) {
                      updateMutation.mutate({ id: editingProject.ID, payload: { ProjectCurrency: e.target.value } });
                    }
                  }}
                />
                <TextField
                  label="Budget"
                  type="number"
                  defaultValue={editingProject.ProjectBudget || ''}
                  onBlur={(e) => {
                    const newBudget = Number(e.target.value);
                    if (newBudget !== (editingProject.ProjectBudget || 0)) {
                      updateMutation.mutate({ id: editingProject.ID, payload: { ProjectBudget: newBudget } });
                    }
                  }}
                />
              </Box>
              <FormControl fullWidth>
                <InputLabel>Budget Manager</InputLabel>
                <Select
                  value={editingProject.BudgetManager || ''}
                  onChange={(e) => {
                    updateMutation.mutate({ id: editingProject.ID, payload: { BudgetManager: String(e.target.value) } });
                  }}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {budgetManagers.map((u) => (
                    <MenuItem key={u.ID} value={u.ID}>{u.Name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Allocation Mode</InputLabel>
                  <Select
                    value={editingProject.AllocationMode || allocationModes[0]}
                    onChange={(e) => {
                      updateMutation.mutate({ id: editingProject.ID, payload: { AllocationMode: String(e.target.value) } });
                    }}
                  >
                    {allocationModes.map((m) => (
                      <MenuItem key={m} value={m}>{m}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>Fringe</InputLabel>
                  <Select
                    value={editingProject.Fringe || 'No'}
                    onChange={(e) => {
                      updateMutation.mutate({ id: editingProject.ID, payload: { Fringe: String(e.target.value) } });
                    }}
                  >
                    <MenuItem value="Yes">Yes</MenuItem>
                    <MenuItem value="No">No</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingProject(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* GENA Chart Dialog */}
      <Dialog 
        open={ganttDialogOpen} 
        onClose={() => setGanttDialogOpen(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            height: '90vh',
            maxHeight: '90vh'
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TimelineIcon />
          Project Gantt Chart
        </DialogTitle>
        <DialogContent sx={{ p: 0, height: 'calc(90vh - 120px)', overflow: 'hidden' }}>
          <GanttChart selectedDate={new Date()} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGanttDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

