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
  const label = kind === 'video' ? '🎬' : kind === 'audio' ? '🎧' : kind === 'text' ? '📄' : '📁';
  const ring =
    kind === 'video' ? 'ring-accent-pink/40 bg-accent-pink/10' :
    kind === 'audio' ? 'ring-accent/40 bg-accent/10' :
    kind === 'text'  ? 'ring-accent-warm/40 bg-accent-warm/10' :
                       'ring-fg/10 bg-elevated';
  return (
    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ring-1 ${ring}`}>
      <span aria-hidden="true">{label}</span>
    </div>
  );
}
