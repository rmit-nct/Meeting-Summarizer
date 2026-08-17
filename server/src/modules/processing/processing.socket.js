// Handles meeting:subscribe / meeting:unsubscribe on the /rt namespace. See ENDPOINTS.md §8.
//
// config/socket.js already joins every connection to its private
// `user:{userId}` room, which is what meeting:progress/completed/failed
// actually broadcast to (processing.events.js) — one room per user is
// simpler than one per meeting and is enough for this app's scale. These two
// events exist to satisfy the documented client<->server contract and, more
// importantly, to re-check ownership per meetingId before acking: a socket
// handler is not a shortcut past the inbound boundary (ENDPOINTS.md §8).
import { meetingInterface } from '../meeting/meeting.interface.js';

export function register(socket) {
  socket.on('meeting:subscribe', async ({ meetingId }, ack) => {
    try {
      await meetingInterface.assertOwnership(meetingId, socket.data.user.id);
      ack?.({ ok: true });
    } catch {
      socket.emit('error', { code: 'forbidden', message: 'Not authorized for this meeting' });
    }
  });

  socket.on('meeting:unsubscribe', (_payload, ack) => {
    ack?.({ ok: true });
  });
}
