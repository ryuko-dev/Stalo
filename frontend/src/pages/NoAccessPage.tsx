/**
 * No Access Page
 * 
 * Displayed when a logged-in user doesn't have a role assigned yet.
 */

import { Box, Typography, Paper, Alert } from '@mui/material';
import { Lock as LockIcon } from '@mui/icons-material';

export default function NoAccessPage() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        bgcolor: 'background.default',
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
        <LockIcon sx={{ fontSize: 64, color: 'warning.main', mb: 2 }} />
        
        <Typography variant="h4" gutterBottom>
          Access Pending
        </Typography>
        
        <Typography variant="body1" color="text.secondary" paragraph>
          Your account has been created successfully, but you don't have access to the application yet.
        </Typography>
        
        <Alert severity="info" sx={{ mt: 2, textAlign: 'left' }}>
          <Typography variant="body2">
            <strong>Next Steps:</strong>
            <br />
            Please contact the administrator to grant you access. Once a role is assigned to your account, you will be able to access the application.
          </Typography>
        </Alert>
        
        <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
          Your user record has been automatically created. An administrator needs to assign you a role before you can proceed.
        </Typography>
      </Paper>
    </Box>
  );
}
