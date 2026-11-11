import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function ProtectedRoute() {
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated && !user?.isLoggedIn) {
    const target = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?redirect=${target}`} replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
