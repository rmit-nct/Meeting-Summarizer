import { useRef } from 'react';
import { ACCEPT_ATTR, formatBytes, MAX_UPLOAD_BYTES } from '../../utils/constants.js';
import UploadProgress from '../UploadProgress/index.jsx';
import { useDropzone } from './useDropzone.hook.js';

// Dropzone — drag/pick + validate + upload orchestration.
// Rendered on MeetingDetail while status === 'draft'.
// The uploading state is delegated to <UploadProgress /> so Recorder can
// render the same progress card without duplication.
export default function Dropzone({ meetingId, onUploaded }) {
  const inputRef = useRef(null);
  const {
    status, file, progress, error,
    handleSelect, handleDrop, handleDragOver, handleDragLeave,
    cancel, retry, reset,
  } = useDropzone({ meetingId, onUploaded });

  const openPicker = () => inputRef.current?.click();

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => handleSelect(e.target.files?.[0])}
      />

      {(status === 'idle' || status === 'dragging' || status === 'rejected') && (
        <IdleZone
          status={status}
          error={status === 'rejected' ? error : null}
          onClick={openPicker}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDismissError={reset}
        />
      )}

      {(status === 'validating' || status === 'uploading') && (
        <UploadProgress
          filename={file?.name}
          mimeType={file?.type}
          sizeBytes={file?.size}
          progress={progress}
          label={status === 'validating' ? 'Checking file…' : undefined}
          onCancel={cancel}
        />
      )}

      {status === 'error' && (
        <ErrorCard file={file} error={error} onRetry={retry} onCancel={reset} />
      )}

      {status === 'uploaded' && <SuccessCard file={file} />}
    </div>
  );
}

/* ---------- Idle / Dragging / Rejected ---------- */

function IdleZone({ status, error, onClick, onDrop, onDragOver, onDragLeave, onDismissError }) {
  const active = status === 'dragging';
  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={[
          'block w-full rounded-(--radius-card) border-2 border-dashed p-10 sm:p-14 text-center transition',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
          active
            ? 'border-accent bg-accent/10'
            : 'border-fg/15 bg-surface hover:border-accent/60 hover:bg-elevated',
        ].join(' ')}
      >
        <UploadIcon className={active ? 'text-accent' : 'text-accent/80'} />
        <p className="mt-4 text-lg font-medium text-fg">Drop a file to summarize</p>
        <p className="mt-1 text-sm text-fg-muted">or click to browse</p>
        <p className="mt-6 text-xs text-fg-subtle">
          Audio · Video · Transcript (.srt / .vtt) · Up to {formatBytes(MAX_UPLOAD_BYTES)}
        </p>
      </button>

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-(--radius-lg) border border-danger/40 bg-danger/10 p-4 text-sm text-danger"
        >
          <AlertIcon className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">{error}</p>
            <button
              type="button"
              onClick={onDismissError}
              className="mt-1 underline underline-offset-2 hover:no-underline"
            >
              Try another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Error / Success ---------- */

function ErrorCard({ file, error, onRetry, onCancel }) {
  return (
    <div className="rounded-(--radius-card) border border-danger/40 bg-danger/10 p-6">
      <div className="flex items-start gap-4">
        <AlertIcon className="mt-1 shrink-0 text-danger" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-fg">Upload failed</p>
          <p className="mt-1 text-sm text-fg-muted">{error}</p>
          <p className="mt-2 truncate text-xs text-fg-subtle">{file?.name}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-(--radius-md) bg-fg px-4 py-2 text-sm font-medium text-fg-inverse hover:bg-fg/90"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-(--radius-md) border border-fg/10 px-4 py-2 text-sm text-fg-muted hover:border-fg/20 hover:text-fg"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function SuccessCard({ file }) {
  return (
    <div className="rounded-(--radius-card) border border-success/40 bg-success/10 p-6">
      <div className="flex items-center gap-4">
        <CheckIcon className="shrink-0 text-success" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-fg">Upload complete</p>
          <p className="truncate text-xs text-fg-muted">
            {file?.name} · Starting summarization…
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Icons ---------- */

function UploadIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round"
         className={`mx-auto h-10 w-10 ${className}`} aria-hidden="true">
      <path d="M12 3v13" />
      <path d="m7 8 5-5 5 5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

function AlertIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round"
         className={`h-5 w-5 ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </svg>
  );
}

function CheckIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round"
         className={`h-6 w-6 ${className}`} aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
