// Subscribes to the pipeline's domain events and turns them into status
// transitions + socket progress emission. See ARCHITECTURE.md §4. This is
// the single place that writes status AND emits sockets — transcript and
// summary only ever publish events, never touch meetingInterface's write
// methods or the socket themselves.
import { eventBus } from '../../shared/eventBus.js';
import { logger } from '../../shared/logger.js';
import { meetingInterface } from '../meeting/meeting.interface.js';
import { STATUS_PROGRESS, STATUS_STEP } from '../../shared/constants.js';

export function register(rt) {
  eventBus.on('transcript:created', async ({ meetingId, userId, durationSeconds }) => {
    try {
      await meetingInterface.markTranscribed(meetingId, userId, { durationSeconds });
      // Immediately hands off to summarizing — summary.events.js is
      // triggering its own work off this same transcript:created event in
      // parallel, so the status write here just keeps the visible state in
      // step with what's actually about to happen next.
      const summarizing = await meetingInterface.markSummarizing(meetingId, userId);
      emitProgress(rt, userId, summarizing);
    } catch (err) {
      logger.error(`failed to advance meeting ${meetingId} past transcription`, err);
    }
  });

  eventBus.on('summary:created', async ({ meetingId, userId }) => {
    try {
      const meeting = await meetingInterface.markCompleted(meetingId, userId);
      emitProgress(rt, userId, meeting);
      rt.to(`user:${userId}`).emit('meeting:completed', { meetingId });
    } catch (err) {
      logger.error(`failed to mark meeting ${meetingId} completed`, err);
    }
  });

  eventBus.on('pipeline:failed', async ({ meetingId, userId, code, message }) => {
    try {
      await meetingInterface.markFailed(meetingId, userId, message);
    } catch (err) {
      logger.error(`failed to mark meeting ${meetingId} failed`, err);
    }
    rt.to(`user:${userId}`).emit('meeting:failed', { meetingId, code, message });
  });
}

function emitProgress(rt, userId, meeting) {
  rt.to(`user:${userId}`).emit('meeting:progress', {
    meetingId: meeting.id,
    status: meeting.status,
    step: STATUS_STEP[meeting.status] ?? null,
    progress: STATUS_PROGRESS[meeting.status] ?? 0,
  });
}
