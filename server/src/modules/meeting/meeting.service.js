// Business rules for meetings. Status is owned by the processing module, not here. See ARCHITECTURE.md §2.2, §4.1. Publishes meeting:deleted on removal.
import { meetingRepository } from './meeting.repository.js';
import { toApi, toApiList } from './meeting.dto.js';
import { notFound, invalidState } from '../../shared/errors.js';
import { MEETING_STATUS } from '../../shared/constants.js';

// This layer speaks camelCase (API words) and translates to snake_case on the
// way down. The repository never sees a camelCase key; the controller never
// sees a snake_case one.

async function create(userId, { title, description, meetingDate }) {
  const row = await meetingRepository.insert(userId, {
    title,
    description: description ?? null,
    meeting_date: meetingDate ?? null,
    status: MEETING_STATUS.DRAFT,
  });
  return toApi(row);
}

async function list(userId, query) {
  const { rows, total } = await meetingRepository.list(userId, query);
  return { meetings: toApiList(rows), total };
}

async function getById(userId, id) {
  const row = await meetingRepository.findById(id, userId);
  if (!row) throw notFound('Meeting not found');
  return toApi(row);
}

async function update(userId, id, patch) {
  // Read first so a missing row is a clean 404 rather than an empty update.
  const existing = await meetingRepository.findById(id, userId);
  if (!existing) throw notFound('Meeting not found');

  // Only metadata is patchable. The validator already rejects unknown keys, so
  // this maps the three it allows and nothing else — a client cannot smuggle
  // `status` or `storage_path` through this endpoint.
  const fields = {};
  if (patch.title !== undefined) fields.title = patch.title;
  if (patch.description !== undefined) fields.description = patch.description;
  if (patch.meetingDate !== undefined) fields.meeting_date = patch.meetingDate;

  const row = await meetingRepository.update(id, userId, fields);
  return toApi(row);
}

async function remove(userId, id) {
  const existing = await meetingRepository.findById(id, userId);
  if (!existing) throw notFound('Meeting not found');

  // Deleting mid-pipeline would leave the transcription job writing to a row
  // that no longer exists. Make the user wait or fail it first.
  const busy = [MEETING_STATUS.TRANSCRIBING, MEETING_STATUS.SUMMARIZING];
  if (busy.includes(existing.status)) {
    throw invalidState('Cannot delete a meeting while it is being processed');
  }

  await meetingRepository.remove(id, userId);

  // TODO (card #11): publish 'meeting:deleted' so the storage object is removed
  // too. Postgres ON DELETE CASCADE cleans up the child tables, but it knows
  // nothing about the file in the `recordings` bucket — without this, every
  // deleted meeting leaks its recording against a 1 GB free-tier quota.
  //   events.publish('meeting:deleted', { meetingId: id, userId,
  //                                       storagePath: existing.storage_path });

  return { id };
}

export const meetingService = { create, list, getById, update, remove };