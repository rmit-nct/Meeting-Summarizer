import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { DesktopSidebar, MobileSidebar } from './sub-components/Sidebar.jsx';
import { Topbar } from './sub-components/Topbar.jsx';

// Persistent shell for every authenticated route: sidebar + topbar stay mounted across
// navigation (no flash/remount), only the routed page content swaps — this is what makes
// navigation between authenticated pages feel instant rather than like a fresh page load.
// The content area gets a quiet fade-in keyed by pathname (MOTION_INTENSITY: 3 — functional,
// not choreographed) so a route change still registers as *something happened*.
export function AppShell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-dvh overflow-hidden bg-surface">
      <DesktopSidebar />
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setMobileOpen(true)} />
        <main key={location.pathname} className="animate-fade-in-up flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppShell;
