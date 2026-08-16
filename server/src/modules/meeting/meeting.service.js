// Business rules for meetings. Status is owned by the processing module, not here. See ARCHITECTURE.md §2.2, §4.1. Publishes meeting:deleted on removal.
import { meetingRepository } from './meeting.repository.js';
import { toApi, toApiList } from './meeting.dto.js';
import { notFound, invalidState } from '../../shared/errors.js';
import { MEETING_STATUS } from '../../shared/constants.js';
import { eventBus } from '../../shared/eventBus.js';
import {
  buildStoragePath,
  createSignedUploadUrl,
  objectExists,
} from '../../config/upload.js';

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

// POST /api/meetings/:id/upload
//
// Attaches a file to a draft and hands back a signed URL. The browser PUTs the
// bytes straight to Supabase Storage; they never pass through this process.
async function attachUpload(userId, id, { sourceType, originalFilename, mimeType, sizeBytes }) {
  const existing = await meetingRepository.findById(id, userId);
  if (!existing) throw notFound('Meeting not found');

  await assertCanAttach(existing);

  const storagePath = buildStoragePath(userId, id, originalFilename);
  const upload = await createSignedUploadUrl(storagePath);

  // ONE update, not two. The `meeting_file_fields_consistent` check constraint
  // requires status != 'draft' AND storage_path IS NOT NULL to become true
  // together — splitting this into two statements fails on the first.
  const row = await meetingRepository.update(id, userId, {
    status: MEETING_STATUS.UPLOADED,
    source_type: sourceType,
    original_filename: originalFilename,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    storage_path: storagePath,
    error_message: null,
  });

  return { meeting: toApi(row), upload };
}

// A meeting gets one file (ENDPOINTS.md §5), so normally this requires 'draft'.
//
// The one exception: status flips to 'uploaded' when the URL is ISSUED, before
// any bytes exist. If the browser upload then failed, the meeting is stranded —
// it can never be processed and can never be re-uploaded. So if it claims to be
// 'uploaded' but the object isn't actually in the bucket, let them retry.
// Anything past 'uploaded' is genuinely one-shot.
async function assertCanAttach(meeting) {
  if (meeting.status === MEETING_STATUS.DRAFT) return;

  if (meeting.status === MEETING_STATUS.UPLOADED && meeting.storage_path) {
    const written = await objectExists(meeting.storage_path);
    if (!written) return; // previous attempt never landed — allow a retry
  }

  throw invalidState('This meeting already has a file');
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

  // ON DELETE CASCADE cleans the child tables but knows nothing about the file
  // in the `recordings` bucket. Without this, every deleted meeting leaks its
  // recording against a 1 GB free-tier quota. Fire-and-forget: the row is
  // already gone, so a storage hiccup must not fail the request.
  eventBus.emit('meeting:deleted', {
    meetingId: id,
    userId,
    storagePath: existing.storage_path ?? null,
  });

  return { id };
}

export const meetingService = { create, list, getById, update, attachUpload, remove };