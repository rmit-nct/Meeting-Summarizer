import { http } from '../../utils/http.js';
import { ENDPOINTS } from '../../config/endpoints.js';

// Not called yet — useProcessingStatus.hook.js simulates the pipeline client-side until the
// socket + polling fallback described in FRONTEND.md §5 are wired in. `retryProcessing` is the
// one real call already worth having: MeetingDetail's failed-state Retry button and this
// function share the same shape the real integration will use.
export function retryProcessing(meetingId) {
  return http.post(ENDPOINTS.meetings.process(meetingId));
}

export function fetchStatus(meetingId) {
  return http.get(ENDPOINTS.meetings.status(meetingId));
}
