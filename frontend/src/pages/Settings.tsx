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
  Search as SearchIcon
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

export default function Settings() {
  const queryClient = useQueryClient();
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterActive, setFilterActive] = useState<string>('all');

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
  const roleOptions = useMemo(() => ['Admin', 'Budget Manager', 'Viewer', 'Editor'], []);

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

  const handleActiveChange = (id: string, value: boolean) => {
    mutation.mutate({ id, payload: { Active: value } });
  };

  const handleRoleChange = (id: string, value: string) => {
    mutation.mutate({ id, payload: { Role: value } });
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 2, backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
        {/* Compact Header */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold', color: '#333' }}>
            Settings
          </Typography>
          <Chip 
            label={`${filteredUsers.length}/${users.length} Users`} 
            color="primary" 
            variant="outlined" 
            size="small"
          />
        </Box>

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
                          <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>{user.Name}</TableCell>
                          <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>{user.EmailAddress}</TableCell>
                          <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>
                            {user.StartDate ? format(new Date(user.StartDate), 'yyyy-MM-dd') : '-'}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>
                            {user.EndDate ? format(new Date(user.EndDate), 'yyyy-MM-dd') : '-'}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>
                            <FormControl size="small">
                              <Select 
                                value={String(user.Active)} 
                                onChange={(e) => handleActiveChange(user.ID, e.target.value === 'true')}
                                sx={{ fontSize: '0.75rem' }}
                              >
                                <MenuItem value="true" sx={{ fontSize: '0.75rem' }}>Yes</MenuItem>
                                <MenuItem value="false" sx={{ fontSize: '0.75rem' }}>No</MenuItem>
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>
                            <FormControl size="small">
                              <Select 
                                value={user.Role ?? ''} 
                                onChange={(e) => handleRoleChange(user.ID, String(e.target.value))}
                                sx={{ fontSize: '0.75rem' }}
                              >
                                {roleOptions.map((role) => (
                                  <MenuItem key={role} value={role} sx={{ fontSize: '0.75rem' }}>{role}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>
                            <IconButton 
                              size="small" 
                              color="error" 
                              onClick={() => deleteMutation.mutate(user.ID)}
                              sx={{ p: 0.5 }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
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
    onError: (error) => {
      showNotification(`Error deleting entity: ${error.message}`, 'error');
    }
  });

  const [newEntity, setNewEntity] = useState<EntityCreate>({ 
    Name: '', 
    CurrencyCode: '', 
    SSAccCode: '', 
    TaxAccCode: '' 
  });

  const entities = entitiesData ?? [];

  // Filter entities based on search
  const filteredEntities = useMemo(() => {
    return entities
      .filter(entity => {
        const matchesSearch = entity.Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             entity.CurrencyCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             entity.SSAccCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             entity.TaxAccCode.toLowerCase().includes(searchTerm.toLowerCase());
        
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
      TaxAccCode: '' 
    });
  };

  const handleUpdate = (id: string, field: keyof EntityUpdate, value: string) => {
    updateMutation.mutate({ id, payload: { [field]: value } });
  };

  return (
    <>
      {/* Compact Header */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold', color: '#333' }}>
          Entities
        </Typography>
        <Chip 
          label={`${filteredEntities.length}/${entities.length} Entities`} 
          color="primary" 
          variant="outlined" 
          size="small"
        />
      </Box>

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
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', p: 1 }}><strong>ACTIONS</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredEntities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ fontSize: '0.75rem', p: 2 }}>
                        No entities found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEntities.map((entity: Entity) => (
                      <TableRow key={entity.ID} hover sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
                        <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>
                          <TextField 
                            size="small" 
                            defaultValue={entity.Name} 
                            onBlur={(e) => handleUpdate(entity.ID, 'Name', e.target.value)}
                            sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>
                          <TextField 
                            size="small" 
                            defaultValue={entity.CurrencyCode} 
                            onBlur={(e) => handleUpdate(entity.ID, 'CurrencyCode', e.target.value)}
                            sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>
                          <TextField 
                            size="small" 
                            defaultValue={entity.SSAccCode} 
                            onBlur={(e) => handleUpdate(entity.ID, 'SSAccCode', e.target.value)}
                            sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>
                          <TextField 
                            size="small" 
                            defaultValue={entity.TaxAccCode} 
                            onBlur={(e) => handleUpdate(entity.ID, 'TaxAccCode', e.target.value)}
                            sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.75rem', p: 1 }}>
                          <IconButton 
                            size="small" 
                            color="error" 
                            onClick={() => deleteMutation.mutate(entity.ID)}
                            sx={{ p: 0.5 }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
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

      {/* Entity Notification Snackbar */}
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
    </>
  );
}
