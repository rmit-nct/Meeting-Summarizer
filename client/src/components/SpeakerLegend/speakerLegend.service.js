import { http } from '../../utils/http.js';
import { ENDPOINTS } from '../../config/endpoints.js';

// Not called yet — see useSpeakerLegend.hook.js. Bulk rename per ENDPOINTS.md §5.
export const renameSpeakers = (meetingId, speakers) =>
  http.patch(ENDPOINTS.meetings.speakers(meetingId), { speakers });
