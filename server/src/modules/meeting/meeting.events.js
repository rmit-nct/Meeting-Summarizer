// Fire-and-forget side effects for the meeting module. Registered once at boot
// from index.js. See ARCHITECTURE.md §4.
import { eventBus } from '../../shared/eventBus.js';
import { removeObject } from '../../config/upload.js';
import { logger } from '../../shared/logger.js';

// The row is already deleted by the time this runs, so nothing here may throw
// into the request path. A failure to clean up storage is a leaked object and a
// log line, not a failed API call — the user's delete already succeeded.
export function register() {
  eventBus.on('meeting:deleted', async ({ meetingId, storagePath }) => {
    if (!storagePath) return;
    try {
      await removeObject(storagePath);
      logger.info('Removed storage object for deleted meeting', meetingId, storagePath);
    } catch (err) {
      logger.error('Failed to remove storage object', meetingId, storagePath, err.message);
    }
  });
}