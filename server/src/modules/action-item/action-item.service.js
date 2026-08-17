// Business rules for action items, including the merge-not-replace rule on resummarize. See ENDPOINTS.md §3.
import { actionItemRepository } from './action-item.repository.js';
import { meetingInterface } from '../meeting/meeting.interface.js';
import { notFound } from '../../shared/errors.js';
import { toActionItemDto, toActionItemListDto } from './action-item.dto.js';

async function list(userId, query) {
  const { rows, total } = await actionItemRepository.list(userId, query);
  return { items: toActionItemListDto(rows), total };
}

async function create(userId, input) {
  await meetingInterface.assertOwnership(input.meetingId, userId);
  const nextIndex = (await actionItemRepository.maxOrderIndex(input.meetingId, userId)) + 1;
  const row = await actionItemRepository.create(userId, { ...input, orderIndex: nextIndex });
  return toActionItemDto(row);
}

async function update(userId, id, patch) {
  const dbPatch = {};
  if ('content' in patch) dbPatch.content = patch.content;
  if ('ownerLabel' in patch) dbPatch.owner_label = patch.ownerLabel;
  if ('dueDate' in patch) dbPatch.due_date = patch.dueDate;
  if ('isDone' in patch) dbPatch.is_done = patch.isDone;
  if ('orderIndex' in patch) dbPatch.order_index = patch.orderIndex;

  const row = await actionItemRepository.update(id, userId, dbPatch);
  if (!row) throw notFound('Action item not found');
  return toActionItemDto(row);
}

async function remove(userId, id) {
  const existing = await actionItemRepository.findById(id, userId);
  if (!existing) throw notFound('Action item not found');
  await actionItemRepository.remove(id, userId);
  return { id };
}

// Called from action-item.events.js on summary:action-items-extracted. Always
// additive — see action-item.repository.js#bulkInsert for why this alone
// satisfies "merged, not replaced" for both first-time generation and
// resummarize without needing two separate code paths.
async function insertFromSummary(userId, meetingId, items) {
  const startIndex = (await actionItemRepository.maxOrderIndex(meetingId, userId)) + 1;
  return actionItemRepository.bulkInsert(userId, meetingId, items, startIndex);
}

async function countByMeetingIds(userId, meetingIds) {
  return actionItemRepository.countByMeetingIds(userId, meetingIds);
}

export const actionItemService = {
  list,
  create,
  update,
  remove,
  insertFromSummary,
  countByMeetingIds,
};
