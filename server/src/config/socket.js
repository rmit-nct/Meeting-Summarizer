import { Server } from 'socket.io';
import { env } from './env.js';

// Bootstraps the single /rt namespace. Per-connection auth verification and
// module handler registration happen in index.js. See ARCHITECTURE.md §3.2.
export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL.split(',') },
  });
  return io.of('/rt');
}
