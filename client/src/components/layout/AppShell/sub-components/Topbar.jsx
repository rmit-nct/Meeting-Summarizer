import { useEffect, useRef, useState } from 'react';
import { List, Bell, Question, SignOut, Gear, CaretDown } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import Avatar from '../../../ui/Avatar/index.jsx';
import IconButton from '../../../ui/IconButton/index.jsx';
import Button from '../../../ui/Button/index.jsx';
import { useAuth } from '../../../../hooks/useAuth.js';

export function Topbar({ onOpenMenu }) {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-outline-variant/60 bg-surface-container-lowest px-4 sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="rounded-(--radius-md) p-2 text-on-surface-variant hover:bg-surface-container-low md:hidden"
      >
        <List size={22} weight="regular" />
      </button>

      <div className="flex-1" />

      <Button to="/meetings/new" size="sm" className="hidden sm:inline-flex">
        New meeting
      </Button>

      <IconButton icon={Bell} label="Notifications" />
      <IconButton icon={Question} label="Help" />

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-surface-container-low"
        >
          <Avatar name={user?.name ?? 'You'} size="sm" />
          <CaretDown size={14} weight="bold" className="hidden text-on-surface-variant sm:block" />
        </button>

        {menuOpen && (
          <div className="animate-fade-in-up absolute right-0 top-full mt-2 w-56 rounded-(--radius-lg) border border-outline-variant/60 bg-surface-container-lowest p-1.5 shadow-[0_8px_28px_-4px_rgba(27,27,27,0.14)]">
            <div className="px-3 py-2">
              <p className="truncate text-sm font-medium text-on-surface">{user?.name ?? 'Signed in'}</p>
              <p className="truncate text-xs text-outline">{user?.email}</p>
            </div>
            <div className="my-1 h-px bg-outline-variant/60" />
            <Link
              to="/settings"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 rounded-(--radius-md) px-3 py-2 text-sm text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
            >
              <Gear size={18} weight="regular" />
              Settings
            </Link>
            <button
              type="button"
              onClick={() => signOut()}
              className="flex w-full items-center gap-2 rounded-(--radius-md) px-3 py-2 text-left text-sm text-error transition-colors hover:bg-error/10"
            >
              <SignOut size={18} weight="regular" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
