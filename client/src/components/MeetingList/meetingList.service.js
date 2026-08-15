import { http } from '../../utils/http.js';
import { ENDPOINTS } from '../../config/endpoints.js';

// Not called yet — useMeetingList.hook.js reads from utils/mockData.js until the backend is
// live (ENDPOINTS.md §9 / §2 `GET /api/meetings`). Swapping the hook's data source to this
// function is the whole integration step; the query params already match the documented
// contract.
export function fetchMeetings({ q, from, to, status, page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (status) params.set('status', status);
  params.set('page', String(page));
  params.set('limit', String(limit));
  return http.get(`${ENDPOINTS.meetings.list()}?${params.toString()}`);
}
