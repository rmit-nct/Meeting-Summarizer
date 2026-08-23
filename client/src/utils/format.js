// Duration, date, and timestamp formatting helpers. See FRONTEND.md §7.

export function formatDate(input, opts = {}) {
  if (!input) return '—';
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', ...opts,
  });
}

export function formatDateLong(input) {
  return formatDate(input, { month: 'long' });
}

export function formatTime(input) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(input) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  return `${formatDate(date)} · ${formatTime(date)}`;
}

// 1h 30m / 45m / 12h — for meeting duration summaries.
export function formatDurationMinutes(totalMinutes) {
  const mins = Math.round(totalMinutes ?? 0);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// 0:00 / 12:34 / 1:02:03 — for transcript timestamps and the recorder clock.
export function formatTimestamp(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds ?? 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// "3 days ago" / "in 2 hours" — coarse relative time for dashboard/list rows.
export function formatRelativeTime(input) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = date.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const abs = Math.abs(diffMin);
  if (abs < 60) return rtf.format(diffMin, 'minute');
  if (abs < 60 * 24) return rtf.format(Math.round(diffMin / 60), 'hour');
  if (abs < 60 * 24 * 30) return rtf.format(Math.round(diffMin / (60 * 24)), 'day');
  return formatDate(date);
}
