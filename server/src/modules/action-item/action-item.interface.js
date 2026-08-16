// The ONLY way other modules may reach into action-item. See ARCHITECTURE.md §2.1.
import { actionItemService } from './action-item.service.js';

// Used by the overview aggregator to compose the meeting-detail payload.
async function listForMeeting(meetingId, userId) {
  return actionItemService.listByMeeting(userId, meetingId);
}

export const actionItemInterface = { listForMeeting };