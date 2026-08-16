// Business rules for action items. Seeded from summary output, then user-owned. See ARCHITECTURE.md §2.2.
import { actionItemRepository } from './action-item.repository.js';
import { toApi, toApiList } from './action-item.dto.js';
import { notFound } from '../../shared/errors.js';
import { meetingInterface } from '../meeting/meeting.interface.js';

async function list(userId, query) {
  const { rows, total } = await actionItemRepository.list(userId, query);
  return { actionItems: toApiList(rows), total };
}

async function create(userId, { meetingId, content, ownerLabel, dueDate }) {
  // action_items has its own user_id, so the insert is already scoped. This
  // call is about the MEETING: without it a user could attach items to a
  // meeting id that isn't theirs, or one that doesn't exist. Goes through the
  // interface, never meeting.repository — see ARCHITECTURE.md §2.1.
  await meetingInterface.assertOwnership(meetingId, userId);

  const nextIndex = (await actionItemRepository.maxOrderIndex(meetingId, userId)) + 1;

  const row = await actionItemRepository.insert(userId, {
    meeting_id: meetingId,
    content,
    owner_label: ownerLabel ?? null,
    due_date: dueDate ?? null,
    is_done: false,
    order_index: nextIndex,
  });

  return toApi(row);
}

async function update(userId, id, patch) {
  const existing = await actionItemRepository.findById(id, userId);
  if (!existing) throw notFound('Action item not found');

  const fields = {};
  if (patch.content !== undefined) fields.content = patch.content;
  if (patch.ownerLabel !== undefined) fields.owner_label = patch.ownerLabel;
  if (patch.dueDate !== undefined) fields.due_date = patch.dueDate;
  if (patch.isDone !== undefined) fields.is_done = patch.isDone;
  if (patch.orderIndex !== undefined) fields.order_index = patch.orderIndex;

  const row = await actionItemRepository.update(id, userId, fields);
  return toApi(row);
}

async function remove(userId, id) {
  const existing = await actionItemRepository.findById(id, userId);
  if (!existing) throw notFound('Action item not found');
  await actionItemRepository.remove(id, userId);
  return { id };
}

// Called by action-item.events.js when the summary pipeline finishes. Not
// exposed over HTTP — the client never seeds items.
//
// dueDate is passed through as-is and may well be null. Do NOT default it to
// anything: a wrong deadline in a meeting summary is worse than a missing one
// (AI_INTEGRATION.md §3).
async function seedFromSummary(userId, meetingId, items) {
  if (!items?.length) return [];

  const rows = items.map((item, index) => ({
    meeting_id: meetingId,
    content: item.content,
    owner_id: item.ownerId ?? null,
    owner_label: item.ownerLabel ?? null,
    due_date: item.dueDate ?? null,
    is_done: false,
    order_index: index,
  }));

  const inserted = await actionItemRepository.insertMany(userId, rows);
  return toApiList(inserted);
}

async function listByMeeting(userId, meetingId) {
  const rows = await actionItemRepository.listByMeeting(meetingId, userId);
  return toApiList(rows);
}

export const actionItemService = {
  list,
  create,
  update,
  remove,
  seedFromSummary,
  listByMeeting,
};