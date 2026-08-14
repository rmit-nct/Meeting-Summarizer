import { useMemo } from 'react';
import { formatBytes } from '../../utils/constants.js';
import UploadProgress from '../UploadProgress/index.jsx';
import { useRecorder } from './useRecorder.hook.js';

// Recorder — in-browser audio capture, uploads via the same shared flow as Dropzone.
// States: idle → requesting → recording → preview → uploading → uploaded | error | permission-denied
export default function Recorder({ meetingId, onUploaded }) {
  const {
    status, error, elapsedMs, blob, mimeType, progress,
    start, stop, discard, submit, cancelUpload,
  } = useRecorder({ meetingId, onUploaded });

  const previewUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);

  if (status === 'uploading') {
    return (
      <UploadProgress
        filename={`Recording · ${formatMmSs(elapsedMs)}`}
        mimeType={mimeType}
        sizeBytes={blob?.size}
        progress={progress}
        onCancel={cancelUpload}
      />
    );
  }

  if (status === 'uploaded') {
    return (
      <div className="rounded-(--radius-card) border border-success/40 bg-success/10 p-6">
        <p className="text-sm font-medium text-fg">Recording uploaded</p>
        <p className="mt-1 text-xs text-fg-muted">Starting summarization…</p>
      </div>
    );
  }

  return (
    <div className="rounded-(--radius-card) border border-fg/10 bg-surface p-6">
      {status === 'idle' && <IdleView onStart={start} />}
      {status === 'requesting' && <RequestingView />}
      {status === 'recording' && <RecordingView elapsedMs={elapsedMs} onStop={stop} />}
      {status === 'preview' && (
        <PreviewView
          previewUrl={previewUrl}
          durationLabel={formatMmSs(elapsedMs)}
          sizeLabel={formatBytes(blob?.size ?? 0)}
          onDiscard={discard}
          onSubmit={submit}
        />
      )}
      {status === 'permission-denied' && <PermissionDeniedView error={error} onRetry={start} />}
      {status === 'error' && <ErrorView error={error} onRetry={start} />}
    </div>
  );
}

/* ---------- Sub-views ---------- */

function IdleView({ onStart }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <MicIcon className="text-accent" />
      <div>
        <p className="text-lg font-medium text-fg">Record in browser</p>
        <p className="mt-1 text-sm text-fg-muted">
          Capture the meeting live from your mic. We will summarize it when you stop.
        </p>
      </div>
      <button
        type="button"
        onClick={onStart}
        className="mt-2 inline-flex items-center gap-2 rounded-(--radius-md) bg-fg px-5 py-2.5 text-sm font-medium text-fg-inverse transition hover:bg-fg/90"
      >
        <span className="h-2 w-2 rounded-full bg-danger" />
        Start recording
      </button>
    </div>
  );
}

function RequestingView() {
  return (
    <div className="flex items-center justify-center gap-3 py-6 text-sm text-fg-muted">
      <Spinner />
      Waiting for microphone permission…
    </div>
  );
}

function RecordingView({ elapsedMs, onStop }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-danger" />
        </span>
        <span className="text-xs font-medium uppercase tracking-wider text-danger">Recording</span>
      </div>

      <div className="font-mono text-5xl font-semibold tabular-nums text-fg">
        {formatMmSs(elapsedMs)}
      </div>

      <button
        type="button"
        onClick={onStop}
        className="inline-flex items-center gap-2 rounded-(--radius-md) border border-fg/15 bg-elevated px-5 py-2.5 text-sm font-medium text-fg transition hover:border-fg/30"
      >
        <StopIcon />
        Stop
      </button>
    </div>
  );
}

function PreviewView({ previewUrl, durationLabel, sizeLabel, onDiscard, onSubmit }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium text-fg">Recording ready</p>
        <p className="mt-0.5 text-xs text-fg-muted">
          {durationLabel} · {sizeLabel}
        </p>
      </div>

      <audio controls src={previewUrl} className="w-full">
        <track kind="captions" />
      </audio>

      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-(--radius-md) border border-fg/10 px-4 py-2 text-sm text-fg-muted transition hover:border-fg/20 hover:text-fg"
        >
          Re-record
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="rounded-(--radius-md) bg-fg px-4 py-2 text-sm font-medium text-fg-inverse transition hover:bg-fg/90"
        >
          Use this recording
        </button>
      </div>
    </div>
  );
}

function PermissionDeniedView({ error, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <MicOffIcon className="text-danger" />
      <p className="text-sm font-medium text-fg">Microphone blocked</p>
      <p className="max-w-sm text-sm text-fg-muted">{error}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-(--radius-md) border border-fg/15 px-4 py-2 text-sm text-fg transition hover:border-fg/30"
      >
        Try again
      </button>
    </div>
  );
}

function ErrorView({ error, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-sm font-medium text-danger">Recording failed</p>
      <p className="max-w-sm text-sm text-fg-muted">{error}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-(--radius-md) border border-fg/15 px-4 py-2 text-sm text-fg transition hover:border-fg/30"
      >
        Try again
      </button>
    </div>
  );
}

/* ---------- Utilities + icons ---------- */

function formatMmSs(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function MicIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round"
         className={`h-10 w-10 ${className}`} aria-hidden="true">
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 18v3" />
      <path d="M9 21h6" />
    </svg>
  );
}

function MicOffIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round"
         className={`h-10 w-10 ${className}`} aria-hidden="true">
      <path d="m2 2 20 20" />
      <path d="M15 9V6a3 3 0 0 0-5.94-.6" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <path d="M19 11a7 7 0 0 1-11 5.7" />
      <path d="M5 11a7 7 0 0 0 .8 3.25" />
      <path d="M12 18v3" />
      <path d="M9 21h6" />
    </svg>
  );
}

function StopIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor"
         className={`h-3.5 w-3.5 ${className}`} aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 animate-spin" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
