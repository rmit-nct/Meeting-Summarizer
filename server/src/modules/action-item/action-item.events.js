// Subscribes to summary:action-items-extracted and seeds rows. See ARCHITECTURE.md §4.
import { eventBus } from '../../shared/eventBus.js';
import { actionItemService } from './action-item.service.js';
import { logger } from '../../shared/logger.js';

// Fire-and-forget. The summary is already saved by the time this runs, so a
// failure here must not fail the pipeline — the user gets bullets without
// action items, plus a log line, rather than a failed meeting.
export function register() {
  eventBus.on('summary:action-items-extracted', async ({ meetingId, userId, items }) => {
    try {
      const seeded = await actionItemService.seedFromSummary(userId, meetingId, items);
      logger.info('Seeded action items', meetingId, seeded.length);
    } catch (err) {
      logger.error('Failed to seed action items', meetingId, err.message);
    }
  });
}