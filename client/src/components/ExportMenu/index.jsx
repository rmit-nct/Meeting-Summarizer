import { useEffect, useRef, useState } from 'react';
import { DownloadSimple, FileMd, FilePdf, CaretDown } from '@phosphor-icons/react';
import { useExportMenu } from './useExportMenu.hook.js';

// ExportMenu — Markdown and PDF download links. See FRONTEND.md §3.
export default function ExportMenu({ meetingId }) {
  const { exportAs } = useExportMenu(meetingId);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-2 rounded-(--radius-md) border border-outline-variant bg-surface-container-lowest px-4 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
      >
        <DownloadSimple size={16} weight="regular" />
        Export
        <CaretDown size={12} weight="bold" />
      </button>

      {open && (
        <div className="animate-fade-in-up absolute right-0 top-full z-10 mt-2 w-44 rounded-(--radius-lg) border border-outline-variant/60 bg-surface-container-lowest p-1.5 shadow-[0_8px_28px_-4px_rgba(27,27,27,0.14)]">
          <MenuItem icon={FileMd} label="Markdown (.md)" onClick={() => { exportAs('md'); setOpen(false); }} />
          <MenuItem icon={FilePdf} label="PDF" onClick={() => { exportAs('pdf'); setOpen(false); }} />
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-(--radius-md) px-3 py-2 text-left text-sm text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
    >
      <Icon size={16} weight="regular" />
      {label}
    </button>
  );
}
