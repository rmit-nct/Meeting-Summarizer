import { Routes, Route } from 'react-router-dom';
import { routeTable } from './routes/routeTable.js';
import { RouteGuard } from './routes/RouteGuard.jsx';
import { AppShell } from './components/layout/AppShell/index.jsx';
import { ToastViewport } from './components/ui/Toast/index.jsx';

// Composition root. See FRONTEND.md §2 — assembles routes only; no business
// logic and no API calls belong here.
//
// Authenticated pages render inside <AppShell> (sidebar + topbar) so the shell persists
// across navigation instead of remounting per page; public pages own their own layout
// (centered auth card, bare landing page).
export default function App() {
  return (
    <>
      <Routes>
        {routeTable.map(({ path, Page, tier }) => (
          <Route
            key={path}
            path={path}
            element={
              <RouteGuard tier={tier}>
                {tier === 'authenticated' ? (
                  <AppShell>
                    <Page />
                  </AppShell>
                ) : (
                  <Page />
                )}
              </RouteGuard>
            }
          />
        ))}
      </Routes>
      <ToastViewport />
    </>
  );
}
