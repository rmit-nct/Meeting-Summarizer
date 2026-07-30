import { Routes, Route } from 'react-router-dom';
import { routeTable } from './routes/routeTable.js';
import { RouteGuard } from './routes/RouteGuard.jsx';

// Composition root. See FRONTEND.md §2 — assembles routes only; no business
// logic and no API calls belong here.
export default function App() {
  return (
    <Routes>
      {routeTable.map(({ path, Page, tier }) => (
        <Route
          key={path}
          path={path}
          element={
            <RouteGuard tier={tier}>
              <Page />
            </RouteGuard>
          }
        />
      ))}
    </Routes>
  );
}
