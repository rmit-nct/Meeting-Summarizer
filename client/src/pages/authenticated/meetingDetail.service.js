// API calls scoped to the MeetingDetail page. Uses utils/http.js and
// config/endpoints.js — never a bare fetch. Mirrors the component-package
// convention (FRONTEND.md §3) even though this is a page, since it's the
// only place that owns fetching the composed GET /:id aggregate.
import { http } from '../../utils/http.js';
import { ENDPOINTS } from '../../config/endpoints.js';

export function fetchMeetingDetail(id) {
  return http.get(ENDPOINTS.meetings.detail(id));
}
