import { http } from '../../utils/http.js';
import { ENDPOINTS } from '../../config/endpoints.js';

// GET /api/meetings — query params match the documented contract (ENDPOINTS.md §2).
// Returns { meetings: [...], meta: { page, limit, total, totalPages } }.
export function fetchMeetings(
  { q, from, to, status, page = 1, limit = 20 } = {},
  { signal } = {},
) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (status) params.set('status', status);
  params.set('page', String(page));
  params.set('limit', String(limit));

  return http.get(`${ENDPOINTS.meetings.list()}?${params.toString()}`, { signal });
}

export function updateMeetingTitle(id, title) {
  return http.patch(ENDPOINTS.meetings.update(id), { title });
}

export function deleteMeeting(id) {
  return http.delete(ENDPOINTS.meetings.remove(id));
}