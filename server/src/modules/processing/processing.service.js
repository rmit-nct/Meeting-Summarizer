// Owns meeting.status transitions via meeting.interface. See ARCHITECTURE.md §4.1.
import { meetingInterface } from '../meeting/meeting.interface.js';
import { eventBus } from '../../shared/eventBus.js';
import { invalidState } from '../../shared/errors.js';
import { MEETING_STATUS, STATUS_PROGRESS, STATUS_STEP } from '../../shared/constants.js';

// Starts the pipeline. Returns as soon as the status transition is written —
// the caller (controller) responds 202 immediately; transcription runs on
// the event bus. See ENDPOINTS.md §3.
async function startProcessing(meetingId, userId) {
  const meeting = await meetingInterface.getMeetingForOwner(meetingId, userId);

  if (meeting.status !== MEETING_STATUS.UPLOADED) {
    throw invalidState(`Cannot process a meeting in status "${meeting.status}"`);
  }

  const updated = await meetingInterface.markTranscribing(meetingId, userId);
  eventBus.emit('meeting:uploaded', { meetingId, userId });
  return updated;
}

// Cheap single-row snapshot — the fallback for a disconnected socket or a
// page refresh. See ENDPOINTS.md §3.
async function getStatus(meetingId, userId) {
  const meeting = await meetingInterface.getMeetingForOwner(meetingId, userId);
  return {
    status: meeting.status,
    progress: STATUS_PROGRESS[meeting.status] ?? 0,
    step: STATUS_STEP[meeting.status] ?? null,
    errorMessage: meeting.error_message ?? null,
  };
}

export const processingService = { startProcessing, getStatus };
