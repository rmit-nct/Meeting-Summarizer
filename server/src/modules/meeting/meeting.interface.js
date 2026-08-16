// The ONLY way other modules may reach into meeting. See ARCHITECTURE.md §2.1.
// Status transitions from 'uploaded' onward are written here on processing's
// behalf, but processing never touches meeting.repository directly.
import { meetingRepository } from './meeting.repository.js';
import { notFound } from '../../shared/errors.js';
import { MEETING_STATUS } from '../../shared/constants.js';

async function getMeetingForOwner(meetingId, userId) {
  const meeting = await meetingRepository.findById(meetingId, userId);
  if (!meeting) throw notFound('Meeting not found');
  return meeting;
}

async function assertOwnership(meetingId, userId) {
  await getMeetingForOwner(meetingId, userId);
}

async function markTranscribing(meetingId, userId) {
  const meeting = await meetingRepository.update(meetingId, userId, {
    status: MEETING_STATUS.TRANSCRIBING,
    error_message: null,
  });
  if (!meeting) throw notFound('Meeting not found');
  return meeting;
}

async function markTranscribed(meetingId, userId, { durationSeconds } = {}) {
  const patch = { status: MEETING_STATUS.TRANSCRIBED };
  if (durationSeconds != null) patch.duration_seconds = Math.round(durationSeconds);
  const meeting = await meetingRepository.update(meetingId, userId, patch);
  if (!meeting) throw notFound('Meeting not found');
  return meeting;
}

async function markFailed(meetingId, userId, errorMessage) {
  const meeting = await meetingRepository.update(meetingId, userId, {
    status: MEETING_STATUS.FAILED,
    error_message: errorMessage,
  });
  if (!meeting) throw notFound('Meeting not found');
  return meeting;
}

export const meetingInterface = {
  getMeetingForOwner,
  assertOwnership,
  markTranscribing,
  markTranscribed,
  markFailed,
};