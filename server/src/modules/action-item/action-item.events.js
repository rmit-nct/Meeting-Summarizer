// Subscribes to summary:action-items-extracted and seeds rows. See ARCHITECTURE.md §4.
import { eventBus } from '../../shared/eventBus.js';
import { logger } from '../../shared/logger.js';
import { actionItemService } from './action-item.service.js';

export function register() {
  eventBus.on('summary:action-items-extracted', async ({ meetingId, userId, items }) => {
    try {
      await actionItemService.insertFromSummary(userId, meetingId, items);
    } catch (err) {
      logger.error(`failed to insert action items for meeting ${meetingId}`, err);
    }
  });
}
