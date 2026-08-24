import { useEffect, useRef, useState } from 'react';
import { DotsThreeVertical, PencilSimple, Trash } from '@phosphor-icons/react';
import IconButton from '../../ui/IconButton/index.jsx';

// MeetingCardMenu — the "⋮" corner button on a meeting card. Same
// open/outside-click-close pattern as ExportMenu. Delete asks for
// confirmation inline (a second menu state) rather than a modal — this app
// has no modal system yet, and deleting a meeting is destructive enough to
// warrant one more click, unlike action items (useActionItemList.hook.js),
// which delete immediately.
export default function MeetingCardMenu({ onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setConfirming(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      await onDelete();
      // No need to reset state on success — the card unmounts with the row.
    } catch {
      setDeleting(false);
      setConfirming(false);
      setOpen(false);
    }
  }

  return (
    <div
      className="relative"
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <IconButton
        icon={DotsThreeVertical}
        size="sm"
        label="Meeting options"
        onClick={() => {
          setOpen((v) => !v);
          setConfirming(false);
        }}
        className="bg-surface-container-lowest/90 backdrop-blur-sm hover:bg-surface-container-low"
      />

      {open && (
        <div className="animate-fade-in-up absolute right-0 top-full z-10 mt-2 w-48 rounded-(--radius-lg) border border-outline-variant/60 bg-surface-container-lowest p-1.5 shadow-[0_8px_28px_-4px_rgba(27,27,27,0.14)]">
          {confirming ? (
            <div className="p-1.5">
              <p className="px-1.5 pb-2 text-xs text-on-surface-variant">
                Delete this meeting? This can&apos;t be undone.
              </p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setConfirming(false)}
                  className="flex-1 rounded-(--radius-md) px-2 py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleConfirmDelete}
                  className="flex-1 rounded-(--radius-md) bg-error px-2 py-1.5 text-xs font-medium text-on-error transition-colors hover:bg-error/90 disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <MenuItem
                icon={PencilSimple}
                label="Edit"
                onClick={() => {
                  onEdit();
                  setOpen(false);
                }}
              />
              <MenuItem
                icon={Trash}
                label="Delete"
                tone="danger"
                onClick={() => setConfirming(true)}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, tone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex w-full items-center gap-2 rounded-(--radius-md) px-3 py-2 text-left text-sm transition-colors',
        tone === 'danger'
          ? 'text-error hover:bg-error-container/30'
          : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface',
      ].join(' ')}
    >
      <Icon size={16} weight="regular" />
      {label}
    </button>
  );
}
