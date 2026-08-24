import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store.js';

// Enforces the tier before a page renders. UX affordance, not security — every
// rule here is enforced again by the server's middleware/authorize.js.
// See FRONTEND.md §2, ARCHITECTURE.md §5.4.
//
// `hydrate()` exchanges a stored refresh token for a fresh session on first
// load — without it, a page reload always looks signed-out until the first
// API call happens to 401 and trigger a refresh via utils/http.js.
export function RouteGuard({ tier, children }) {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const location = useLocation();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) return null;

  if (tier === 'authenticated' && !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (tier === 'public' && user && (location.pathname === '/login' || location.pathname === '/signup')) {
    return <Navigate to="/meetings" replace />;
  }

  return children;
}

export default RouteGuard;
