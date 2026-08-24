// Owns meeting.status transitions via meeting.interface. See ARCHITECTURE.md §4.1.
import { meetingInterface } from '../meeting/meeting.interface.js';
import { transcriptInterface } from '../transcript/transcript.interface.js';
import { summaryInterface } from '../summary/summary.interface.js';
import { eventBus } from '../../shared/eventBus.js';
import { logger } from '../../shared/logger.js';
import { invalidState } from '../../shared/errors.js';
import { MEETING_STATUS, STATUS_PROGRESS, STATUS_STEP, isValidTransition } from '../../shared/constants.js';
import { objectExists } from '../../config/upload.js';

// Starts the pipeline. Returns as soon as the status transition is written —
// the caller (controller) responds 202 immediately; transcription runs on
// the event bus. See ENDPOINTS.md §3.
//
// Retry re-enters at the earliest incomplete stage (ARCHITECTURE.md §4.1): a
// `failed` meeting with a transcript already on file only needs
// resummarize(); one without a transcript needs the whole pipeline again.
// isValidTransition() already encodes both `failed` edges (shared/constants.js)
// so the guard below needs no special-casing beyond the resummarize redirect.
async function startProcessing(meetingId, userId) {
  const meeting = await meetingInterface.getMeetingForOwner(meetingId, userId);

  if (meeting.status === MEETING_STATUS.FAILED) {
    const transcript = await transcriptInterface.getTranscriptForOwner(meetingId, userId);
    if (transcript) return resummarize(meetingId, userId);
  }

  if (!isValidTransition(meeting.status, MEETING_STATUS.TRANSCRIBING)) {
    throw invalidState(`Cannot process a meeting in status "${meeting.status}"`);
  }

  // attachUpload() marks the meeting 'uploaded' the moment it issues the
  // signed URL — before the browser has actually PUT any bytes to Storage.
  // If that PUT then failed (bad bucket config, network error, expired
  // token…), the meeting is stuck claiming a file that was never written.
  // Catch that here rather than silently starting a transcription job that
  // can only fail once it tries to download a nonexistent object.
  if (meeting.status === MEETING_STATUS.UPLOADED && !(await objectExists(meeting.storage_path))) {
    throw invalidState(
      'No file was found for this meeting — the upload may not have completed. Delete this meeting and try uploading again.',
    );
  }

  const updated = await meetingInterface.markTranscribing(meetingId, userId);
  eventBus.emit('meeting:uploaded', { meetingId, userId });
  return updated;
}

// Re-runs summarization only. Requires an existing transcript. Used after a
// speaker rename or a failed retry (ENDPOINTS.md §3).
async function resummarize(meetingId, userId) {
  const meeting = await meetingInterface.getMeetingForOwner(meetingId, userId);
  const transcript = await transcriptInterface.getTranscriptForOwner(meetingId, userId);
  if (!transcript) throw invalidState('Cannot resummarize before a transcript exists');
  if (!isValidTransition(meeting.status, MEETING_STATUS.SUMMARIZING)) {
    throw invalidState(`Cannot resummarize a meeting in status "${meeting.status}"`);
  }

  const updated = await meetingInterface.markSummarizing(meetingId, userId);
  // Fire-and-forget, same shape as startProcessing's meeting:uploaded emit —
  // the HTTP response already went out; summary:created/pipeline:failed
  // report the outcome asynchronously.
  summaryInterface.generateSummary(meetingId, userId).catch((err) => {
    logger.error(`unhandled error resummarizing meeting ${meetingId}`, err);
  });
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

export const processingService = { startProcessing, resummarize, getStatus };
