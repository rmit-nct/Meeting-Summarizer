import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, selectIsAuthenticated } from '../stores/auth.store.js';

// Enforces the tier before a page renders. UX affordance, not security — every
// rule here is enforced again by the server's middleware/authorize.js.
// See FRONTEND.md §2, ARCHITECTURE.md §5.4.
export function RouteGuard({ tier, children }) {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const location = useLocation();

  if (tier === 'authenticated' && !isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (tier === 'public' && isAuthenticated && (location.pathname === '/login' || location.pathname === '/signup')) {
    return <Navigate to="/meetings" replace />;
  }

  return children;
}

export default RouteGuard;
