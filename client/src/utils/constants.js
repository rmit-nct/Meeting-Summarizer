// Upload allowlist. Mirrors server/src/shared/constants.js and ENDPOINTS.md §7.
// This is a client-side courtesy check — the server check is authoritative.

export const ACCEPTED_AUDIO = [
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/webm',
  'audio/flac',
  'audio/ogg',
];

export const ACCEPTED_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime'];

export const ACCEPTED_TEXT = ['text/plain', 'text/vtt', 'application/x-subrip', 'text/markdown'];

export const ACCEPTED_MIME = [...ACCEPTED_AUDIO, ...ACCEPTED_VIDEO, ...ACCEPTED_TEXT];

// For <input accept="..."> — MIME groups + extensions for broadest picker compat.
export const ACCEPT_ATTR = 'audio/*,video/*,.srt,.vtt,.txt,.md';

// This Supabase project's bucket is capped at 50 MB. Keep browser validation
// aligned so oversized uploads are rejected before processing can get stuck.
export const MAX_UPLOAD_BYTES = 52_428_800;

export function categorizeMime(mime) {
  if (ACCEPTED_AUDIO.includes(mime)) return 'audio';
  if (ACCEPTED_VIDEO.includes(mime)) return 'video';
  if (ACCEPTED_TEXT.includes(mime)) return 'text';
  return null;
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// Summary-point categories. Colors live in index.css (--color-cat-*) — see the comment there
// for why this is a separate, bounded palette from the two brand accents. Never color alone:
// every usage pairs this with `label`.
export const CATEGORY_META = {
  decision: { label: 'Decision', className: 'bg-cat-decision/10 text-cat-decision' },
  action: { label: 'Action', className: 'bg-cat-action/10 text-cat-action' },
  question: { label: 'Question', className: 'bg-cat-question/10 text-cat-question' },
  blocker: { label: 'Blocker', className: 'bg-cat-blocker/10 text-cat-blocker' },
  risk: { label: 'Risk', className: 'bg-cat-risk/10 text-cat-risk' },
  discussion: { label: 'Discussion', className: 'bg-cat-discussion/10 text-cat-discussion' },
};

// meeting.status → step label, drives StatusStepper and MeetingList badges.
export const STATUS_STEPS = ['uploaded', 'transcribing', 'summarizing', 'completed'];

export const STATUS_META = {
  draft: { label: 'Draft', tone: 'secondary' },
  uploaded: { label: 'Queued', tone: 'neutral' },
  transcribing: { label: 'Transcribing', tone: 'primary' },
  transcribed: { label: 'Transcribed', tone: 'neutral' },
  summarizing: { label: 'Summarizing', tone: 'primary' },
  completed: { label: 'Completed', tone: 'success' },
  failed: { label: 'Failed', tone: 'error' },
};

// Falling back to `draft` for an unknown status makes a pipeline failure look
// like an unstarted meeting. Better to render something obviously wrong.
export const UNKNOWN_STATUS_META = { label: 'Unknown', tone: 'neutral' };
