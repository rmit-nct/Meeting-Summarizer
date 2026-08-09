// Subscribes to meeting:uploaded and triggers transcription. See ARCHITECTURE.md §4.
import { eventBus } from '../../shared/eventBus.js';
import { logger } from '../../shared/logger.js';
import { transcriptService } from './transcript.service.js';

export function register() {
  eventBus.on('meeting:uploaded', ({ meetingId, userId }) => {
    // Fire-and-forget: the HTTP response already went out as 202. Failures
    // are reported through the pipeline:failed event, not a thrown promise.
    transcriptService.transcribeMeeting(meetingId, userId).catch((err) => {
      logger.error(`unhandled error transcribing meeting ${meetingId}`, err);
    });
  });
}
