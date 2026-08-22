import { categorizeMime, formatBytes } from '../../utils/constants.js';

// UploadProgress — filename + kind + size + progress bar + cancel.
// Rendered by both Dropzone (uploading a File) and Recorder (uploading a Blob).
//
// Props:
//   filename   string
//   mimeType   string
//   sizeBytes  number
//   progress   0..1
//   label?     string  — override the "Uploading… X%" caption (e.g. "Checking file…")
//   onCancel?  () => void
export default function UploadProgress({ filename, mimeType, sizeBytes, progress, label, onCancel }) {
  const pct = Math.round((progress ?? 0) * 100);
  const kind = categorizeMime(mimeType) ?? 'file';

  return (
    <div className="rounded-(--radius-card) border border-fg/10 bg-surface p-6">
      <div className="flex items-center gap-4">
        <FileGlyph kind={kind} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">{filename}</p>
          <p className="text-xs text-fg-muted">
            {kind} · {formatBytes(sizeBytes ?? 0)}
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-(--radius-md) border border-fg/10 px-3 py-1.5 text-sm text-fg-muted transition hover:border-fg/20 hover:text-fg"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-elevated">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-fg-muted">{label ?? `Uploading… ${pct}%`}</p>
    </div>
  );
}

function FileGlyph({ kind }) {
  const Icon = kind === 'video' ? FilmIcon : kind === 'audio' ? WaveIcon : kind === 'text' ? DocIcon : FolderIcon;
  const ring =
    kind === 'video' ? 'ring-cat-video/40 bg-cat-video/10 text-cat-video' :
    kind === 'audio' ? 'ring-cat-audio/40 bg-cat-audio/10 text-cat-audio' :
    kind === 'text'  ? 'ring-cat-text/40 bg-cat-text/10 text-cat-text' :
                       'ring-fg/10 bg-elevated text-fg-subtle';
  return (
    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1 ${ring}`}>
      <Icon className="h-5 w-5" />
    </div>
  );
}

function FilmIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 5v14M17 5v14M3 10h4M17 10h4M3 15h4M17 15h4" />
    </svg>
  );
}

function WaveIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 12h2l2-6 3 15 3-11 2 4h5" />
    </svg>
  );
}

function DocIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4M9 13h6M9 17h6" />
    </svg>
  );
}

function FolderIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 7a1 1 0 0 1 1-1h4l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z" />
    </svg>
  );
}
