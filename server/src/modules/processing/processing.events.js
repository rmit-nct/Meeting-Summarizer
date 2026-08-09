// Subscribes to the pipeline's domain events and turns them into status
// transitions + socket progress emission. See ARCHITECTURE.md §4.
import { eventBus } from '../../shared/eventBus.js';
import { logger } from '../../shared/logger.js';
import { meetingInterface } from '../meeting/meeting.interface.js';
import { STATUS_PROGRESS, STATUS_STEP } from '../../shared/constants.js';

export function register(rt) {
  eventBus.on('transcript:created', async ({ meetingId, userId, durationSeconds }) => {
    try {
      const meeting = await meetingInterface.markTranscribed(meetingId, userId, { durationSeconds });
      emitProgress(rt, userId, meeting);
      // TODO: eventBus.emit('summary:created', ...) trigger belongs to the
      // summary module once it exists; markCompleted/meeting:completed wire
      // up there. See ARCHITECTURE.md §4.
    } catch (err) {
      logger.error(`failed to mark meeting ${meetingId} transcribed`, err);
    }
  });

  // TODO: eventBus.on('summary:created', ...) -> markCompleted, emit meeting:completed

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
