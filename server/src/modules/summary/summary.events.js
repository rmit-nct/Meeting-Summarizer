// Subscribes to transcript:created and triggers summarization. See ARCHITECTURE.md §4.
import { eventBus } from '../../shared/eventBus.js';
import { logger } from '../../shared/logger.js';
import { summaryService } from './summary.service.js';

export function register() {
  eventBus.on('transcript:created', ({ meetingId, userId }) => {
    // Fire-and-forget: mirrors transcript.events.js's own listener. Failures
    // are reported through pipeline:failed inside generateSummary itself,
    // never as an unhandled rejection here.
    summaryService.generateSummary(meetingId, userId).catch((err) => {
      logger.error(`unhandled error summarizing meeting ${meetingId}`, err);
    });
  });
}
