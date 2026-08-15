import { NavLink } from 'react-router-dom';
import { House, Broadcast, Gear, X } from '@phosphor-icons/react';
import Logo from '../../../ui/Logo/index.jsx';

const NAV_ITEMS = [
  { to: '/meetings', label: 'Meetings', icon: House, end: true },
  { to: '/live', label: 'Live session', icon: Broadcast },
  { to: '/settings', label: 'Settings', icon: Gear },
];

function NavItems({ onNavigate }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            [
              'flex items-center gap-3 rounded-(--radius-md) px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-secondary-container/40 text-on-secondary-container'
                : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface',
            ].join(' ')
          }
        >
          <Icon size={20} weight="regular" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function DesktopSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-outline-variant/60 bg-surface-container-lowest md:flex">
      <div className="px-5 py-6">
        <Logo size="sm" />
      </div>
      <NavItems />
      <div className="px-5 py-5 text-xs text-outline">v0.1 · UI preview</div>
    </aside>
  );
}

export function MobileSidebar({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-on-surface/40"
      />
      <aside className="animate-fade-in-up absolute inset-y-0 left-0 flex w-72 flex-col bg-surface-container-lowest shadow-xl">
        <div className="flex items-center justify-between px-5 py-6">
          <Logo size="sm" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container-low"
          >
            <X size={20} weight="regular" />
          </button>
        </div>
        <NavItems onNavigate={onClose} />
      </aside>
    </div>
  );
}
