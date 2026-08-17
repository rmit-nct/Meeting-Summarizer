// The ONLY way other modules may reach into meeting. See ARCHITECTURE.md §2.1.
// Status transitions from 'uploaded' onward are written here on processing's
// (and summary's) behalf, but neither module ever touches meeting.repository
// directly. Every transition is checked against isValidTransition() first —
// OOP_PATTERNS_GUIDE.md §3: one guard function, not a class-based State
// pattern, kept in the one place shared/constants.js defines the map.
import { meetingRepository } from './meeting.repository.js';
import { notFound } from '../../shared/errors.js';
import { MEETING_STATUS, isValidTransition } from '../../shared/constants.js';

async function getMeetingForOwner(meetingId, userId) {
  const meeting = await meetingRepository.findById(meetingId, userId);
  if (!meeting) throw notFound('Meeting not found');
  return meeting;
}

async function assertOwnership(meetingId, userId) {
  await getMeetingForOwner(meetingId, userId);
}

async function transition(meetingId, userId, to, extraPatch = {}) {
  const meeting = await getMeetingForOwner(meetingId, userId);
  if (!isValidTransition(meeting.status, to)) {
    throw notFound(`Cannot move meeting from "${meeting.status}" to "${to}"`);
  }
  const patch = { status: to, ...extraPatch };
  if (to !== MEETING_STATUS.FAILED) patch.error_message = null;
  const updated = await meetingRepository.update(meetingId, userId, patch);
  if (!updated) throw notFound('Meeting not found');
  return updated;
}

async function markTranscribing(meetingId, userId) {
  return transition(meetingId, userId, MEETING_STATUS.TRANSCRIBING);
}

async function markTranscribed(meetingId, userId, { durationSeconds } = {}) {
  const extra = {};
  if (durationSeconds != null) extra.duration_seconds = Math.round(durationSeconds);
  return transition(meetingId, userId, MEETING_STATUS.TRANSCRIBED, extra);
}

async function markSummarizing(meetingId, userId) {
  return transition(meetingId, userId, MEETING_STATUS.SUMMARIZING);
}

async function markCompleted(meetingId, userId) {
  return transition(meetingId, userId, MEETING_STATUS.COMPLETED);
}

async function markFailed(meetingId, userId, errorMessage) {
  return transition(meetingId, userId, MEETING_STATUS.FAILED, { error_message: errorMessage });
}

export const meetingInterface = {
  getMeetingForOwner,
  assertOwnership,
  markTranscribing,
  markTranscribed,
  markSummarizing,
  markCompleted,
  markFailed,
};
