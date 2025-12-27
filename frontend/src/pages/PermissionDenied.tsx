/**
 * Permission Denied Page
 * 
 * Displayed when a user tries to access a page they don't have permission for.
 */

import { Box, Typography, Paper, Button } from '@mui/material';
import { Block as BlockIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

export default function PermissionDenied() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        p: 2,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          maxWidth: 500,
          textAlign: 'center',
        }}
      >
        <BlockIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
        
        <Typography variant="h4" gutterBottom>
          Permission Denied
        </Typography>
        
        <Typography variant="body1" color="text.secondary" paragraph>
          You don't have permission to access this page or perform this action.
        </Typography>
        
        <Typography variant="body2" color="text.secondary" paragraph>
          If you believe you should have access, please contact your administrator.
        </Typography>
        
        <Button
          variant="contained"
          onClick={() => navigate('/')}
          sx={{ mt: 2 }}
        >
          Go to Home
        </Button>
      </Paper>
    </Box>
  );
}
