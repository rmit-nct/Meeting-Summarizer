import { ENDPOINTS } from '../../config/endpoints.js';
import { env } from '../../config/env.js';
import { useAuthStore } from '../../stores/auth.store.js';
import { HttpError } from '../../utils/http.js';

// GET /api/meetings/:id/export is a raw file download (ENDPOINTS.md §6), not
// the JSON envelope utils/http.js's request() expects — so this fetches
// directly rather than going through http.get(). A plain <a href> can't
// carry the Authorization header this API requires (there's no cookie
// session, per ARCHITECTURE.md's Supabase-Auth-then-custom-JWT design), so
// an authenticated fetch + Blob download is the only way this actually
// works — mirrors http.js's single-retry-after-refresh handling for an
// access token that expired since the page loaded.
export async function downloadExport(meetingId, format, retried = false) {
  const accessToken = useAuthStore.getState().accessToken;
  const res = await fetch(`${env.VITE_API_URL}${ENDPOINTS.meetings.export(meetingId, format)}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  if (res.status === 401 && !retried) {
    await useAuthStore.getState().refresh();
    return downloadExport(meetingId, format, true);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new HttpError(
      body?.error?.code ?? 'internal_error',
      body?.error?.message ?? res.statusText,
      res.status,
      body?.error?.details,
    );
  }

  const disposition = res.headers.get('Content-Disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `meeting.${format}`;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
