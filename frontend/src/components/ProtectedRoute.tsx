import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { Box, CircularProgress, Typography } from '@mui/material';

interface ProtectedRouteProps {
  children: React.ReactNode;
  page?: string;
}

export default function ProtectedRoute({ children, page }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { hasAccess, isLoadingPermissions, getPagePermissions } = usePermissions();

  if (authLoading || isLoadingPermissions) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading...</Typography>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If user has no role assigned, redirect to no-access page
  if (!hasAccess) {
    return <Navigate to="/no-access" replace />;
  }

  // Check page-specific permissions
  if (page) {
    const permissions = getPagePermissions(page);
    if (!permissions.canView) {
      return <Navigate to="/permission-denied" replace />;
    }
  }

  return <>{children}</>;
}
