import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store.js';

export function RouteGuard({ tier, children }) {
  const { user, hydrated, hydrate } = useAuthStore();
  const location = useLocation();
  useEffect(() => { hydrate(); }, [hydrate]);
  if (!hydrated) return <p>Loading…</p>;
  if (tier === 'authenticated' && !user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (tier === 'public' && user && ['/login', '/signup'].includes(location.pathname)) return <Navigate to="/meetings" replace />;
  return children;
}
