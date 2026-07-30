import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { createSocketServer } from './config/socket.js';
import { logger } from './shared/logger.js';

// Event-bus subscribers, registered once at boot. See ARCHITECTURE.md §4.
import { register as registerTranscriptEvents } from './modules/transcript/transcript.events.js';
import { register as registerSummaryEvents } from './modules/summary/summary.events.js';
import { register as registerActionItemEvents } from './modules/action-item/action-item.events.js';
import { register as registerProcessingEvents } from './modules/processing/processing.events.js';

// WebSocket handlers, registered per connection on the /rt namespace.
import { register as registerProcessingSocket } from './modules/processing/processing.socket.js';
import { register as registerLiveSessionSocket } from './modules/live-session/live-session.socket.js';
import { startSweeper } from './modules/live-session/live-session.sweeper.js';

const app = createApp();
const httpServer = http.createServer(app);
const rt = createSocketServer(httpServer);

registerTranscriptEvents();
registerSummaryEvents();
registerActionItemEvents();
registerProcessingEvents(rt);

rt.on('connection', (socket) => {
  registerProcessingSocket(socket, rt);
  registerLiveSessionSocket(socket, rt);
});

startSweeper();

httpServer.listen(env.PORT, () => {
  logger.info(`NCT Meeting Summarizer server listening on port ${env.PORT}`);
});
