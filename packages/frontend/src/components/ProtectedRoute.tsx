import { Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import useAuth from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { subject, initializing } = useAuth();

  if (initializing) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!subject) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
