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

export const ACCEPTED_TEXT = ['text/plain', 'text/vtt', 'application/x-subrip'];

export const ACCEPTED_MIME = [...ACCEPTED_AUDIO, ...ACCEPTED_VIDEO, ...ACCEPTED_TEXT];

// For <input accept="..."> — MIME groups + extensions for broadest picker compat.
export const ACCEPT_ATTR = 'audio/*,video/*,.srt,.vtt,.txt';

// 500 MB — matches server MAX_UPLOAD_BYTES default.
export const MAX_UPLOAD_BYTES = 524_288_000;

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
