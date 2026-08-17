// API call scoped to the NewMeeting page. Mirrors meetingDetail.service.js's
// pattern (FRONTEND.md §3 convention, applied to a page since there's no
// component package that owns meeting creation).
import { http } from '../../utils/http.js';
import { ENDPOINTS } from '../../config/endpoints.js';

export function createMeeting(data) {
  return http.post(ENDPOINTS.meetings.create(), data);
}
