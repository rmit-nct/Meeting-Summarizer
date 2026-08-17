import { Server } from 'socket.io';
import { env } from './env.js';
import { authInterface } from '../modules/auth/auth.interface.js';

// Bootstraps the single /rt namespace. Verifies the handshake token and joins
// every socket to its private user:{userId} room here, since that's true for
// every connection regardless of which module's handlers run on it — an
// unverified socket is disconnected immediately, no anonymous real-time
// surface. Per-connection module handler registration still happens in
// index.js. See ARCHITECTURE.md §3.2.
export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL.split(',') },
  });
  const rt = io.of('/rt');

  rt.use((socket, next) => {
    try {
      const user = authInterface.getUser(socket.handshake.auth?.token);
      socket.data.user = user;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  rt.on('connection', (socket) => {
    socket.join(`user:${socket.data.user.id}`);
  });

  return rt;
}
