// Business rules for meetings. Status is owned by the processing module from
// `uploaded` onward — `meeting` only ever writes `draft -> uploaded` itself,
// when a file is attached. See ARCHITECTURE.md §2.2, §4.1.
import { meetingRepository } from './meeting.repository.js';
import { actionItemInterface } from '../action-item/action-item.interface.js';
import { supabase } from '../../config/supabase.js';
import { env } from '../../config/env.js';
import { notFound, invalidState } from '../../shared/errors.js';
import { MEETING_STATUS, isValidTransition } from '../../shared/constants.js';
import { createSignedUploadUrl } from '../../config/upload.js';
import { toMeetingDto, toMeetingSummaryDto } from './meeting.dto.js';

async function createMeeting(userId, input) {
  const meeting = await meetingRepository.create(userId, input);
  return toMeetingDto(meeting);
}

async function listMeetings(userId, query) {
  const { rows, total } = await meetingRepository.list(userId, query);
  const counts = await actionItemInterface.countByMeetingIds(userId, rows.map((r) => r.id));
  return {
    items: rows.map((row) => toMeetingSummaryDto(row, counts[row.id] ?? 0)),
    total,
  };
}

async function updateMeeting(meetingId, userId, patch) {
  const dbPatch = {};
  if ('title' in patch) dbPatch.title = patch.title;
  if ('description' in patch) dbPatch.description = patch.description;
  if ('meetingDate' in patch) dbPatch.meeting_date = patch.meetingDate;

  const meeting = await meetingRepository.update(meetingId, userId, dbPatch);
  if (!meeting) throw notFound('Meeting not found');
  return toMeetingDto(meeting);
}

async function removeMeeting(meetingId, userId) {
  const meeting = await meetingRepository.findById(meetingId, userId);
  if (!meeting) throw notFound('Meeting not found');

  await meetingRepository.remove(meetingId, userId);
  // transcripts/summaries/summary_points/speakers/action_items all cascade
  // from meetings via FK (MODELS.md §2) — the one thing Postgres cascade
  // can't reach is the Storage object, so that's the only cleanup left here.
  if (meeting.storage_path) {
    await supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).remove([meeting.storage_path]);
  }
  return { id: meetingId };
}

// The one status transition `meeting` is allowed to make on its own
// (ENDPOINTS.md §2). Validates the MIME/size allowlist, issues a signed
// upload URL, and records the file metadata — all before processing ever
// sees this meeting.
async function attachUpload(meetingId, userId, input) {
  const meeting = await meetingRepository.findById(meetingId, userId);
  if (!meeting) throw notFound('Meeting not found');
  if (!isValidTransition(meeting.status, MEETING_STATUS.UPLOADED)) {
    throw invalidState(`A meeting only gets one file — this one is already "${meeting.status}"`);
  }

  const { signedUrl, path, token } = await createSignedUploadUrl(
    userId,
    meetingId,
    input.originalFilename,
  );

  const updated = await meetingRepository.update(meetingId, userId, {
    source_type: input.sourceType,
    original_filename: input.originalFilename,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    storage_path: path,
    status: MEETING_STATUS.UPLOADED,
  });
  if (!updated) throw notFound('Meeting not found');

  return {
    meeting: toMeetingDto(updated),
    upload: { signedUrl, path, token },
  };
}

export const meetingService = {
  createMeeting,
  listMeetings,
  updateMeeting,
  removeMeeting,
  attachUpload,
};
