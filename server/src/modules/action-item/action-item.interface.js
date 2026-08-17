// Exposes seedFromSummary(), mergeOnResummarize(). See ARCHITECTURE.md §2.1.
// Both point at the same additive insert (action-item.service.js's
// insertFromSummary) — see the comment there for why "seed" and "merge" are
// the same operation in this schema.
import { actionItemService } from './action-item.service.js';

async function listForOwner(meetingId, userId) {
  const { items } = await actionItemService.list(userId, { meetingId, page: 1, limit: 50 });
  return items;
}

async function countByMeetingIds(userId, meetingIds) {
  return actionItemService.countByMeetingIds(userId, meetingIds);
}

export const actionItemInterface = {
  listForOwner,
  countByMeetingIds,
  seedFromSummary: actionItemService.insertFromSummary,
  mergeOnResummarize: actionItemService.insertFromSummary,
};
