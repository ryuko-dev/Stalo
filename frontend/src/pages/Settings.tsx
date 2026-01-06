import { useMemo, useState } from 'react';
import { 
  Box, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  Select, 
  MenuItem, 
  FormControl, 
  CircularProgress, 
  TextField, 
  Button, 
  IconButton,
  Card,
  CardContent,
  Chip,
  Alert,
  Snackbar,
  InputAdornment
} from '@mui/material';
import { 
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  RemoveRedEye as ViewAsIcon,
  ExitToApp as ExitIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSystemUsers, updateSystemUser } from '../services/staloService';
import { createSystemUser, deleteSystemUser } from '../services/staloService';
import { getEntities, createEntity, updateEntity, deleteEntity } from '../services/staloService';
import type { SystemUser } from '../types/systemUsers';
import type { SystemUserCreate } from '../types/systemUsers';
import type { Entity, EntityCreate, EntityUpdate } from '../types/entities';
import { format } from 'date-fns';
import { usePermissions } from '../contexts/PermissionsContext';
import type { RoleType } from '../types/systemUsers';

// Super admin email - cannot be changed or deleted
const SUPER_ADMIN_EMAIL = 'sinan.mecit@arkgroupdmcc.com';

export default function Settings() {
  const { isSuperAdmin, viewingAsRole, setViewingAsRole, actualRole } = usePermissions();
  const queryClient = useQueryClient();
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterActive, setFilterActive] = useState<string>('all');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<SystemUser>>({});
  const [usersSectionCollapsed, setUsersSectionCollapsed] = useState(true);

  const showNotification = (message: string, severity: 'success' | 'error' = 'success') => {
    setNotification({ open: true, message, severity });
  };

  const { data: usersData, isLoading: usersLoading, isError: usersError } = useQuery<SystemUser[], Error>({
    queryKey: ['systemUsers'],
    queryFn: getSystemUsers,
    staleTime: 1000 * 60 * 5,
  });

  const mutation = useMutation<SystemUser, Error, { id: string; payload: Partial<SystemUser> }>({
    mutationFn: ({ id, payload }) => updateSystemUser(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemUsers'] });
      showNotification('User updated successfully!', 'success');
    },
    onError: (error) => {
      showNotification(`Error updating user: ${error.message}`, 'error');
    }
  });

  const createMutation = useMutation<SystemUser, Error, SystemUserCreate>({
    mutationFn: (payload) => createSystemUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemUsers'] });
      showNotification('User created successfully!', 'success');
    },
    onError: (error) => {
      showNotification(`Error creating user: ${error.message}`, 'error');
    }
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (id) => deleteSystemUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemUsers'] });
      showNotification('User deleted successfully!', 'success');
    },
    onError: (error) => {
      showNotification(`Error deleting user: ${error.message}`, 'error');
    }
  });

  const [newUser, setNewUser] = useState<SystemUserCreate>({ 
    Name: '', 
    EmailAddress: '', 
    StartDate: '', 
    EndDate: null, 
    Active: true, 
    Role: 'Viewer' 
  });

  const users = usersData ?? [];
  const roleOptions = useMemo(() => ['Admin', 'BudgetManager', 'Viewer', 'Editor'], []);

  // Filter users based on search and filters
  const filteredUsers = useMemo(() => {
    return users
      .filter(user => {
        const matchesSearch = user.Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             user.EmailAddress.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesRole = filterRole === 'all' || user.Role === filterRole;
        
        const matchesActive = filterActive === 'all' || 
                             (filterActive === 'active' && user.Active) ||
                             (filterActive === 'inactive' && !user.Active);
        
        return matchesSearch && matchesRole && matchesActive;
      })
      .sort((a, b) => {
        // Sort by Name alphabetically
        return a.Name.localeCompare(b.Name);
      });
  }, [users, searchTerm, filterRole, filterActive]);

  const handleCreate = () => {
    if (!newUser.Name || !newUser.EmailAddress || !newUser.StartDate) {
      showNotification('Please fill in all required fields!', 'error');
      return;
    }
    createMutation.mutate(newUser);
    setNewUser({ 
      Name: '', 
      EmailAddress: '', 
      StartDate: '', 
      EndDate: null, 
      Active: true, 
      Role: 'Viewer' 
    });
  };

  const handleEditClick = (user: SystemUser) => {
    setEditingUser(user.ID);
    setEditFormData({
      Name: user.Name,
      EmailAddress: user.EmailAddress,
      StartDate: user.StartDate,
      EndDate: user.EndDate,
      Active: user.Active,
      Role: user.Role
    });
  };

  const handleEditSave = () => {
    if (editingUser && editFormData) {
      mutation.mutate({ id: editingUser, payload: editFormData });
      setEditingUser(null);
      setEditFormData({});
    }
  };

  const handleEditCancel = () => {
    setEditingUser(null);
    setEditFormData({});
  };

  const handleEditFieldChange = (field: keyof SystemUser, value: any) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 2, backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
        {/* Super Admin View As Control */}
        {isSuperAdmin && (
          <Card sx={{ mb: 2, boxShadow: 2, border: '2px solid #1976d2' }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: viewingAsRole ? 2 : 0 }}>
                <ViewAsIcon sx={{ color: '#1976d2', mt: 0.5 }} />
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1976d2', mb: 2 }}>
                    Super Admin View Mode
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
                    <Box>
                      <Typography variant="caption" sx={{ display: 'block', color: '#666', mb: 0.5 }}>
                        Current View:
                      </Typography>
                      <Chip 
                        label={viewingAsRole || actualRole || 'Admin'}
                        color={viewingAsRole ? 'warning' : 'primary'}
                        sx={{ fontWeight: 'bold' }}
                      />
                    </Box>
                    
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                      <Typography variant="caption" sx={{ display: 'block', color: '#666', mb: 0.5 }}>
                        View as Role:
                      </Typography>
                      <Select
                        value={viewingAsRole || ''}
                        onChange={(e) => setViewingAsRole(e.target.value as RoleType)}
                        displayEmpty
                        renderValue={(value) => {
                          if (!value) return <em>Normal Admin View</em>;
                          return value;
                        }}
                      >
                        <MenuItem value="">
                          <em>Normal Admin View</em>
                        </MenuItem>
                        {roleOptions.map((role) => (
                          <MenuItem key={role} value={role}>{role}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    
                    {viewingAsRole && (
                      <Button
                        variant="contained"
                        color="error"
                        startIcon={<ExitIcon />}
                        onClick={() => setViewingAsRole(null)}
                        size="medium"
                      >
                        Exit View Mode
                      </Button>
                    )}
                  </Box>
                </Box>
              </Box>
              
              {viewingAsRole && (
                <Alert severity="info" sx={{ mt: 0 }}>
                  You are viewing the application as a <strong>{viewingAsRole}</strong> user. 
                  Navigation and permissions are temporarily restricted to review the user experience. 
                  Select "Normal Admin View" or click "Exit View Mode" to return to your full admin access.
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Compact Header */}
        <Card sx={{ mb: 2, boxShadow: 1 }}>
          <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
            <Box 
              sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                cursor: 'pointer',
                '&:hover': { backgroundColor: 'action.hover' }
              }}
              onClick={() => setUsersSectionCollapsed(!usersSectionCollapsed)}
            >
              <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold', color: '#333' }}>
                System Users
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip 
                  label={`${filteredUsers.length}/${users.length} Users`} 
                  color="primary" 
                  variant="outlined" 
                  size="small"
                />
                {usersSectionCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
              </Box>
            </Box>
          </CardContent>
        </Card>

        {!usersSectionCollapsed && (
          <>
            {/* Role Permissions Matrix */}
            <Card sx={{ mb: 2, boxShadow: 1 }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#1976d2' }}>
                  Role Permissions Matrix
                </Typography>
                <TableContainer>
                  <Table size="small" sx={{ '& td, & th': { fontSize: '0.75rem', py: 0.5 } }}>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                        <TableCell sx={{ fontWeight: 'bold', width: '25%' }}>Page / Feature</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold', width: '18.75%' }}>
                          <Chip label="Admin" color="error" size="small" />
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold', width: '18.75%' }}>
                          <Chip label="BudgetManager" color="primary" size="small" />
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold', width: '18.75%' }}>
                          <Chip label="Viewer" color="default" size="small" />
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold', width: '18.75%' }}>
                          <Chip label="Editor" color="success" size="small" />
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell><strong>Home</strong></TableCell>
                        <TableCell align="center">✅ Full Access</TableCell>
                        <TableCell align="center">👁️ View Only</TableCell>
                        <TableCell align="center">👁️ View Only + Click Links</TableCell>
                        <TableCell align="center">✅ Full Access</TableCell>
                      </TableRow>
                      <TableRow sx={{ backgroundColor: '#fafafa' }}>
                        <TableCell><strong>Gantt Chart</strong></TableCell>
                        <TableCell align="center">✅ Full Access</TableCell>
                        <TableCell align="center">👁️ View Only</TableCell>
                        <TableCell align="center">👁️ View Only</TableCell>
                        <TableCell align="center">✅ Full Access</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Glidepath</strong></TableCell>
                        <TableCell align="center">✅ Full Access</TableCell>
                        <TableCell align="center">✏️ Edit + Add + Delete</TableCell>
                        <TableCell align="center">❌ No Access</TableCell>
                        <TableCell align="center">✅ Full Access</TableCell>
                      </TableRow>
                      <TableRow sx={{ backgroundColor: '#fafafa' }}>
                        <TableCell><strong>Projects</strong></TableCell>
                        <TableCell align="center">✅ Full Access</TableCell>
                        <TableCell align="center">👁️ View Only</TableCell>
                        <TableCell align="center">❌ No Access</TableCell>
                        <TableCell align="center">✅ Full Access</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Positions</strong></TableCell>
                        <TableCell align="center">✅ Full Access</TableCell>
                        <TableCell align="center">👁️ View Only</TableCell>
                        <TableCell align="center">❌ No Access</TableCell>
                        <TableCell align="center">✅ Full Access</TableCell>
                      </TableRow>
                      <TableRow sx={{ backgroundColor: '#fafafa' }}>
                        <TableCell><strong>Resources</strong></TableCell>
                        <TableCell align="center">✅ Full Access</TableCell>
                        <TableCell align="center">👁️ View Only</TableCell>
                        <TableCell align="center">❌ No Access</TableCell>
                        <TableCell align="center">✅ Full Access</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Payroll Allocation</strong></TableCell>
                        <TableCell align="center">✅ Full Access</TableCell>
                        <TableCell align="center">👁️ View Only</TableCell>
                        <TableCell align="center">❌ No Access</TableCell>
                        <TableCell align="center">✅ Full Access</TableCell>
                      </TableRow>
                      <TableRow sx={{ backgroundColor: '#fafafa' }}>
                        <TableCell><strong>Scheduled Records</strong></TableCell>
                        <TableCell align="center">✅ Full Access</TableCell>
                        <TableCell align="center">✏️ Edit + Delete</TableCell>
                        <TableCell align="center">❌ No Access</TableCell>
                        <TableCell align="center">✅ Full Access</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Reports</strong></TableCell>
                        <TableCell align="center">✅ Full Access</TableCell>
                        <TableCell align="center">👁️ View + 📥 Export</TableCell>
                        <TableCell align="center">❌ No Access</TableCell>
                        <TableCell align="center">✅ Full Access</TableCell>
                      </TableRow>
                      <TableRow sx={{ backgroundColor: '#fafafa' }}>
                        <TableCell><strong>Payments</strong></TableCell>
                        <TableCell align="center">✅ Full Access</TableCell>
                        <TableCell align="center">👁️ View Only</TableCell>
                        <TableCell align="center">❌ No Access</TableCell>
                        <TableCell align="center">👁️ View Only</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Settings</strong></TableCell>
                        <TableCell align="center">✅ Full Access</TableCell>
                        <TableCell align="center">❌ No Access</TableCell>
                        <TableCell align="center">❌ No Access</TableCell>
                        <TableCell align="center">❌ No Access</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
                <Box sx={{ mt: 2, p: 1, backgroundColor: '#e3f2fd', borderRadius: 1 }}>
                  <Typography variant="caption" sx={{ display: 'block', color: '#1565c0' }}>
                    <strong>Legend:</strong> ✅ Full Access (View/Edit/Delete) • 👁️ View Only • ✏️ Edit Access • 📥 Export • ❌ No Access
                  </Typography>
                </Box>
              </CardContent>
            </Card>

            {/* Filters */}
            <Card sx={{ mb: 2, boxShadow: 1 }}>
          <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: 200, '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
              />
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  displayEmpty
                  renderValue={(value) => {
                    if (value === 'all') return <em style={{ fontSize: '0.75rem' }}>All Roles</em>;
                    return <span style={{ fontSize: '0.75rem' }}>{value}</span>;
                  }}
                  sx={{ fontSize: '0.75rem' }}
                >
                  <MenuItem value="all"><em style={{ fontSize: '0.75rem' }}>All Roles</em></MenuItem>
                  {roleOptions.map((role) => (
                    <MenuItem key={role} value={role} sx={{ fontSize: '0.75rem' }}>{role}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select
                  value={filterActive}
                  onChange={(e) => setFilterActive(e.target.value)}
                  displayEmpty
                  renderValue={(value) => {
                    if (value === 'all') return <em style={{ fontSize: '0.75rem' }}>All Status</em>;
                    return <span style={{ fontSize: '0.75rem' }}>{value === 'active' ? 'Active' : 'Inactive'}</span>;
                  }}
                  sx={{ fontSize: '0.75rem' }}
                >
                  <MenuItem value="all"><em style={{ fontSize: '0.75rem' }}>All Status</em></MenuItem>
                  <MenuItem value="active" sx={{ fontSize: '0.75rem' }}>Active</MenuItem>
                  <MenuItem value="inactive" sx={{ fontSize: '0.75rem' }}>Inactive</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </CardContent>
        </Card>

        {/* Compact Add User Form */}
        <Card sx={{ mb: 2, boxShadow: 1 }}>
          <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 1, display: 'block', color: '#666' }}>
              ADD NEW USER
            </Typography>
            
            {/* Header Row */}
            <Box sx={{ display: 'flex', gap: 1, mb: 0.5, alignItems: 'center' }}>
              <Box sx={{ flex: '1 1 150px', minWidth: '150px' }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>NAME *</Typography>
              </Box>
              <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>EMAIL *</Typography>
              </Box>
              <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>START *</Typography>
              </Box>
              <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>END</Typography>
              </Box>
              <Box sx={{ flex: '0 1 80px', minWidth: '80px' }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>ACTIVE</Typography>
              </Box>
              <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>ROLE *</Typography>
              </Box>
              <Box sx={{ flex: '0 1 60px', minWidth: '60px' }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>ACTION</Typography>
              </Box>
            </Box>
            
            {/* Input Row */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <Box sx={{ flex: '1 1 150px', minWidth: '150px' }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="User name"
                  value={newUser.Name || ''}
                  onChange={(e) => setNewUser({ ...newUser, Name: e.target.value })}
                  sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
                />
              </Box>
              <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Email address"
                  value={newUser.EmailAddress || ''}
                  onChange={(e) => setNewUser({ ...newUser, EmailAddress: e.target.value })}
                  sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
                />
              </Box>
              <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
                <DatePicker
                  value={newUser.StartDate ? new Date(newUser.StartDate) : null}
                  onChange={(date) => setNewUser({ ...newUser, StartDate: date ? date.toISOString().split('T')[0] : '' })}
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
                  value={newUser.EndDate ? new Date(newUser.EndDate) : null}
                  onChange={(date) => setNewUser({ ...newUser, EndDate: date ? date.toISOString().split('T')[0] : null })}
                  slotProps={{
                    textField: {
                      size: 'small',
                      placeholder: 'End date',
                      sx: { '& .MuiInputBase-input': { fontSize: '0.75rem' } }
                    }
                  }}
                />
              </Box>
              <Box sx={{ flex: '0 1 80px', minWidth: '80px' }}>
                <FormControl fullWidth size="small">
                  <Select
                    value={String(newUser.Active)}
                    onChange={(e) => setNewUser({ ...newUser, Active: e.target.value === 'true' })}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    <MenuItem value="true" sx={{ fontSize: '0.75rem' }}>Yes</MenuItem>
                    <MenuItem value="false" sx={{ fontSize: '0.75rem' }}>No</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
                <FormControl fullWidth size="small">
                  <Select
                    value={newUser.Role}
                    onChange={(e) => setNewUser({ ...newUser, Role: String(e.target.value) })}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    {roleOptions.map((role) => (
                      <MenuItem key={role} value={role} sx={{ fontSize: '0.75rem' }}>{role}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ flex: '0 1 60px', minWidth: '60px' }}>
                <Button 
                  variant="contained" 
                  size="small" 
                  onClick={handleCreate} 
                  disabled={createMutation.status === 'pending'}
                  sx={{ fontSize: '0.7rem', minWidth: '50px' }}
                >
                  Add
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card sx={{ boxShadow: 1 }}>
          <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 1, display: 'block', color: '#666' }}>
              SYSTEM USERS
            </Typography>
            
            {usersLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : usersError ? (
              <Box sx={{ p: 4 }}>
                <Typography color="error">Failed to load system users</Typography>
              </Box>
            ) : (
              <TableContainer component={Paper} sx={{ boxShadow: 'none' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 1 }}><strong>NAME</strong></TableCell>
                      <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 1 }}><strong>EMAIL</strong></TableCell>
                      <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 1 }}><strong>START</strong></TableCell>
                      <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 1 }}><strong>END</strong></TableCell>
                      <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 1 }}><strong>ACTIVE</strong></TableCell>
                      <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 1 }}><strong>ROLE</strong></TableCell>
                      <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 1 }}><strong>ACTIONS</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ fontSize: '0.75rem', p: 2 }}>
                          No system users found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user: SystemUser) => (
                        <TableRow key={user.ID} hover sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
                          <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>
                            {editingUser === user.ID ? (
                              <TextField
                                size="small"
                                value={editFormData.Name || ''}
                                onChange={(e) => handleEditFieldChange('Name', e.target.value)}
                                sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
                              />
                            ) : (
                              user.Name
                            )}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>
                            {editingUser === user.ID ? (
                              <TextField
                                size="small"
                                value={editFormData.EmailAddress || ''}
                                onChange={(e) => handleEditFieldChange('EmailAddress', e.target.value)}
                                sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
                              />
                            ) : (
                              user.EmailAddress
                            )}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>
                            {editingUser === user.ID ? (
                              <DatePicker
                                value={editFormData.StartDate ? new Date(editFormData.StartDate) : null}
                                onChange={(date) => handleEditFieldChange('StartDate', date ? date.toISOString().split('T')[0] : '')}
                                slotProps={{
                                  textField: {
                                    size: 'small',
                                    sx: { '& .MuiInputBase-input': { fontSize: '0.75rem' } }
                                  }
                                }}
                              />
                            ) : (
                              user.StartDate ? format(new Date(user.StartDate), 'yyyy-MM-dd') : '-'
                            )}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>
                            {editingUser === user.ID ? (
                              <DatePicker
                                value={editFormData.EndDate ? new Date(editFormData.EndDate) : null}
                                onChange={(date) => handleEditFieldChange('EndDate', date ? date.toISOString().split('T')[0] : null)}
                                slotProps={{
                                  textField: {
                                    size: 'small',
                                    sx: { '& .MuiInputBase-input': { fontSize: '0.75rem' } }
                                  }
                                }}
                              />
                            ) : (
                              user.EndDate ? format(new Date(user.EndDate), 'yyyy-MM-dd') : '-'
                            )}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>
                            {editingUser === user.ID ? (
                              <FormControl size="small">
                                <Select 
                                  value={String(editFormData.Active)} 
                                  onChange={(e) => handleEditFieldChange('Active', e.target.value === 'true')}
                                  sx={{ fontSize: '0.75rem' }}
                                >
                                  <MenuItem value="true" sx={{ fontSize: '0.75rem' }}>Yes</MenuItem>
                                  <MenuItem value="false" sx={{ fontSize: '0.75rem' }}>No</MenuItem>
                                </Select>
                              </FormControl>
                            ) : (
                              <Typography sx={{ fontSize: '0.75rem' }}>
                                {user.Active ? 'Yes' : 'No'}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>
                            {editingUser === user.ID ? (
                              <FormControl size="small">
                                <Select 
                                  value={editFormData.Role ?? ''} 
                                  onChange={(e) => handleEditFieldChange('Role', String(e.target.value))}
                                  disabled={user.EmailAddress.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()}
                                  sx={{ fontSize: '0.75rem' }}
                                >
                                  {roleOptions.map((role) => (
                                    <MenuItem key={role} value={role} sx={{ fontSize: '0.75rem' }}>{role}</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            ) : (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography sx={{ fontSize: '0.75rem' }}>
                                  {user.Role || 'Admin'}
                                </Typography>
                                {user.EmailAddress.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() && (
                                  <Chip label="Protected" size="small" color="error" sx={{ height: '16px', fontSize: '0.65rem' }} />
                                )}
                              </Box>
                            )}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>
                            {editingUser === user.ID ? (
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <IconButton 
                                  size="small" 
                                  color="primary" 
                                  onClick={handleEditSave}
                                  sx={{ p: 0.5 }}
                                  title="Save Changes"
                                >
                                  <SaveIcon fontSize="small" />
                                </IconButton>
                                <IconButton 
                                  size="small" 
                                  color="secondary" 
                                  onClick={handleEditCancel}
                                  sx={{ p: 0.5 }}
                                  title="Cancel"
                                >
                                  <ExitIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            ) : (
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <IconButton 
                                  size="small" 
                                  color="primary" 
                                  onClick={() => handleEditClick(user)}
                                  disabled={user.EmailAddress.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()}
                                  sx={{ p: 0.5 }}
                                  title="Edit User"
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton 
                                  size="small" 
                                  color="error" 
                                  onClick={() => deleteMutation.mutate(user.ID)}
                                  disabled={user.EmailAddress.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()}
                                  sx={{ p: 0.5 }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
          </>
        )}

        {/* Entities Section */}
        <Box sx={{ mt: 3 }}>
          <EntitiesManager />
        </Box>

        {/* Notification Snackbar */}
        <Snackbar
          open={notification.open}
          autoHideDuration={6000}
          onClose={() => setNotification({ ...notification, open: false })}
        >
          <Alert 
            severity={notification.severity} 
            onClose={() => setNotification({ ...notification, open: false })}
            sx={{ fontSize: '0.75rem' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
}

function EntitiesManager() {
  const queryClient = useQueryClient();
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [editingEntity, setEditingEntity] = useState<string | null>(null);
  const [editEntityData, setEditEntityData] = useState<Partial<Entity>>({});
  const [entitiesSectionCollapsed, setEntitiesSectionCollapsed] = useState(true);

  const showNotification = (message: string, severity: 'success' | 'error' = 'success') => {
    setNotification({ open: true, message, severity });
  };

  const { data: entitiesData, isLoading: entitiesLoading, isError: entitiesError } = useQuery<Entity[], Error>({ 
    queryKey: ['entities'], 
    queryFn: getEntities, 
    staleTime: 1000 * 60 * 5 
  });

  const createMutation = useMutation<Entity, Error, EntityCreate>({ 
    mutationFn: (p) => createEntity(p), 
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities'] });
      showNotification('Entity created successfully!', 'success');
    },
    onError: (error) => {
      showNotification(`Error creating entity: ${error.message}`, 'error');
    }
  });

  const updateMutation = useMutation<Entity, Error, { id: string; payload: EntityUpdate }>({ 
    mutationFn: ({ id, payload }) => updateEntity(id, payload), 
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities'] });
      showNotification('Entity updated successfully!', 'success');
    },
    onError: (error) => {
      showNotification(`Error updating entity: ${error.message}`, 'error');
    }
  });

  const deleteMutation = useMutation<void, Error, string>({ 
    mutationFn: (id) => deleteEntity(id), 
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities'] });
      showNotification('Entity deleted successfully!', 'success');
    },
    onError: (error: any) => {
      console.error('Delete entity error:', error);
      // Extract detailed error message from backend
      let errorMessage = 'Failed to delete entity';
      if (error.response?.data) {
        errorMessage = error.response.data.details || error.response.data.error || error.response.data.message || errorMessage;
      } else if (error.message) {
        errorMessage = error.message;
      }
      showNotification(errorMessage, 'error');
    }
  });

  const [newEntity, setNewEntity] = useState<EntityCreate>({ 
    Name: '', 
    CurrencyCode: '', 
    SSAccCode: '', 
    TaxAccCode: '',
    SSExpCode: '',
    TaxExpCode: '',
    SalExpCode: ''
  });

  const entities = entitiesData ?? [];

  // Filter entities based on search
  const filteredEntities = useMemo(() => {
    return entities
      .filter(entity => {
        const matchesSearch = entity.Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             entity.CurrencyCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             entity.SSAccCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             entity.TaxAccCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             (entity.SSExpCode && entity.SSExpCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
                             (entity.TaxExpCode && entity.TaxExpCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
                             (entity.SalExpCode && entity.SalExpCode.toLowerCase().includes(searchTerm.toLowerCase()));
        
        return matchesSearch;
      })
      .sort((a, b) => {
        // Sort by Name alphabetically
        return a.Name.localeCompare(b.Name);
      });
  }, [entities, searchTerm]);

  const handleCreate = () => {
    if (!newEntity.Name || !newEntity.CurrencyCode) {
      showNotification('Please fill in required fields!', 'error');
      return;
    }
    createMutation.mutate(newEntity);
    setNewEntity({ 
      Name: '', 
      CurrencyCode: '', 
      SSAccCode: '', 
      TaxAccCode: '',
      SSExpCode: '',
      TaxExpCode: '',
      SalExpCode: ''
    });
  };

  const handleEntityEditClick = (entity: Entity) => {
    setEditingEntity(entity.ID);
    setEditEntityData({
      Name: entity.Name,
      CurrencyCode: entity.CurrencyCode,
      SSAccCode: entity.SSAccCode,
      TaxAccCode: entity.TaxAccCode,
      SSExpCode: entity.SSExpCode || '',
      TaxExpCode: entity.TaxExpCode || '',
      SalExpCode: entity.SalExpCode || ''
    });
  };

  const handleEntityEditSave = () => {
    if (editingEntity && editEntityData) {
      updateMutation.mutate({ id: editingEntity, payload: editEntityData as EntityUpdate });
      setEditingEntity(null);
      setEditEntityData({});
    }
  };

  const handleEntityEditCancel = () => {
    setEditingEntity(null);
    setEditEntityData({});
  };

  const handleEntityEditFieldChange = (field: keyof Entity, value: string) => {
    setEditEntityData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <>
      {/* Compact Header */}
      <Card sx={{ mb: 2, boxShadow: 1 }}>
        <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'action.hover' }
            }}
            onClick={() => setEntitiesSectionCollapsed(!entitiesSectionCollapsed)}
          >
            <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold', color: '#333' }}>
              Entities
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip 
                label={`${filteredEntities.length}/${entities.length} Entities`} 
                color="primary" 
                variant="outlined" 
                size="small"
              />
              {entitiesSectionCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {!entitiesSectionCollapsed && (
        <>

      {/* Search Filter */}
      <Card sx={{ mb: 2, boxShadow: 1 }}>
        <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search entities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 200, '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Compact Add Entity Form */}
      <Card sx={{ mb: 2, boxShadow: 1 }}>
        <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 1, display: 'block', color: '#666' }}>
            ADD NEW ENTITY
          </Typography>
          
          {/* Header Row */}
          <Box sx={{ display: 'flex', gap: 1, mb: 0.5, alignItems: 'center' }}>
            <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>NAME *</Typography>
            </Box>
            <Box sx={{ flex: '0 1 100px', minWidth: '100px' }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>CURRENCY *</Typography>
            </Box>
            <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>SS ACC CODE</Typography>
            </Box>
            <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>TAX ACC CODE</Typography>
            </Box>
            <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>SS EXP CODE</Typography>
            </Box>
            <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>TAX EXP CODE</Typography>
            </Box>
            <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>SAL EXP CODE</Typography>
            </Box>
            <Box sx={{ flex: '0 1 60px', minWidth: '60px' }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#666' }}>ACTION</Typography>
            </Box>
          </Box>
          
          {/* Input Row */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Entity name"
                value={newEntity.Name || ''}
                onChange={(e) => setNewEntity({ ...newEntity, Name: e.target.value })}
                sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
              />
            </Box>
            <Box sx={{ flex: '0 1 100px', minWidth: '100px' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Currency"
                value={newEntity.CurrencyCode || ''}
                onChange={(e) => setNewEntity({ ...newEntity, CurrencyCode: e.target.value })}
                sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
              />
            </Box>
            <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="SS account code"
                value={newEntity.SSAccCode || ''}
                onChange={(e) => setNewEntity({ ...newEntity, SSAccCode: e.target.value })}
                sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
              />
            </Box>
            <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Tax account code"
                value={newEntity.TaxAccCode || ''}
                onChange={(e) => setNewEntity({ ...newEntity, TaxAccCode: e.target.value })}
                sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
              />
            </Box>
            <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="SS expense code"
                value={newEntity.SSExpCode || ''}
                onChange={(e) => setNewEntity({ ...newEntity, SSExpCode: e.target.value })}
                sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
              />
            </Box>
            <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Tax expense code"
                value={newEntity.TaxExpCode || ''}
                onChange={(e) => setNewEntity({ ...newEntity, TaxExpCode: e.target.value })}
                sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
              />
            </Box>
            <Box sx={{ flex: '0 1 120px', minWidth: '120px' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Salary expense code"
                value={newEntity.SalExpCode || ''}
                onChange={(e) => setNewEntity({ ...newEntity, SalExpCode: e.target.value })}
                sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
              />
            </Box>
            <Box sx={{ flex: '0 1 60px', minWidth: '60px' }}>
              <Button 
                variant="contained" 
                size="small" 
                onClick={handleCreate} 
                disabled={createMutation.status === 'pending'}
                sx={{ fontSize: '0.7rem', minWidth: '50px' }}
              >
                Add
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Entities Table */}
      <Card sx={{ boxShadow: 1 }}>
        <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 1, display: 'block', color: '#666' }}>
            ENTITIES
          </Typography>
          
          {entitiesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : entitiesError ? (
            <Box sx={{ p: 4 }}>
              <Typography color="error">Failed to load entities</Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} sx={{ boxShadow: 'none' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 1 }}><strong>NAME</strong></TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 1 }}><strong>CURRENCY</strong></TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 1 }}><strong>SS ACC CODE</strong></TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 1 }}><strong>TAX ACC CODE</strong></TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 1 }}><strong>SS EXP CODE</strong></TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 1 }}><strong>TAX EXP CODE</strong></TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 1 }}><strong>SAL EXP CODE</strong></TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 1 }}><strong>ACTIONS</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredEntities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ fontSize: '0.75rem', p: 2 }}>
                        No entities found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEntities.map((entity: Entity) => (
                      <TableRow key={entity.ID} hover sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
                        <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>
                          {editingEntity === entity.ID ? (
                            <TextField 
                              size="small" 
                              value={editEntityData.Name || ''}
                              onChange={(e) => handleEntityEditFieldChange('Name', e.target.value)}
                              sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
                            />
                          ) : (
                            <Typography sx={{ fontSize: '0.75rem' }}>
                              {entity.Name}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>
                          {editingEntity === entity.ID ? (
                            <TextField 
                              size="small" 
                              value={editEntityData.CurrencyCode || ''}
                              onChange={(e) => handleEntityEditFieldChange('CurrencyCode', e.target.value)}
                              sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
                            />
                          ) : (
                            <Typography sx={{ fontSize: '0.75rem' }}>
                              {entity.CurrencyCode}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>
                          {editingEntity === entity.ID ? (
                            <TextField 
                              size="small" 
                              value={editEntityData.SSAccCode || ''}
                              onChange={(e) => handleEntityEditFieldChange('SSAccCode', e.target.value)}
                              sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
                            />
                          ) : (
                            <Typography sx={{ fontSize: '0.75rem' }}>
                              {entity.SSAccCode}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>
                          {editingEntity === entity.ID ? (
                            <TextField 
                              size="small" 
                              value={editEntityData.TaxAccCode || ''}
                              onChange={(e) => handleEntityEditFieldChange('TaxAccCode', e.target.value)}
                              sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
                            />
                          ) : (
                            <Typography sx={{ fontSize: '0.75rem' }}>
                              {entity.TaxAccCode}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>
                          {editingEntity === entity.ID ? (
                            <TextField 
                              size="small" 
                              value={editEntityData.SSExpCode || ''}
                              onChange={(e) => handleEntityEditFieldChange('SSExpCode', e.target.value)}
                              sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
                            />
                          ) : (
                            <Typography sx={{ fontSize: '0.75rem' }}>
                              {entity.SSExpCode || ''}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>
                          {editingEntity === entity.ID ? (
                            <TextField 
                              size="small" 
                              value={editEntityData.TaxExpCode || ''}
                              onChange={(e) => handleEntityEditFieldChange('TaxExpCode', e.target.value)}
                              sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
                            />
                          ) : (
                            <Typography sx={{ fontSize: '0.75rem' }}>
                              {entity.TaxExpCode || ''}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>
                          {editingEntity === entity.ID ? (
                            <TextField 
                              size="small" 
                              value={editEntityData.SalExpCode || ''}
                              onChange={(e) => handleEntityEditFieldChange('SalExpCode', e.target.value)}
                              sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
                            />
                          ) : (
                            <Typography sx={{ fontSize: '0.75rem' }}>
                              {entity.SalExpCode || ''}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>
                          {editingEntity === entity.ID ? (
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <IconButton 
                                size="small" 
                                color="primary" 
                                onClick={handleEntityEditSave}
                                sx={{ p: 0.5 }}
                              >
                                <SaveIcon fontSize="small" />
                              </IconButton>
                              <IconButton 
                                size="small" 
                                color="secondary" 
                                onClick={handleEntityEditCancel}
                                sx={{ p: 0.5 }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          ) : (
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <IconButton 
                                size="small" 
                                color="primary" 
                                onClick={() => handleEntityEditClick(entity)}
                                sx={{ p: 0.5 }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton 
                                size="small" 
                                color="error" 
                                onClick={() => deleteMutation.mutate(entity.ID)}
                                sx={{ p: 0.5 }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
        </>
      )}

      {/* Entity Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={notification.severity === 'error' ? 10000 : 6000}
        onClose={() => setNotification({ ...notification, open: false })}
      >
        <Alert 
          severity={notification.severity} 
          onClose={() => setNotification({ ...notification, open: false })}
          sx={{ fontSize: '0.75rem' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </>
  );
}
