import { create } from 'zustand';
import { io } from 'socket.io-client';
import { env } from '../config/env.js';
import { useAuthStore } from './auth.store.js';

// The one socket connection for the whole app. See ARCHITECTURE.md §3.2,
// FRONTEND.md §6. Created after authentication, torn down on sign-out —
// driven by subscribing to auth.store.js rather than auth.store.js knowing
// about sockets, so the two stores stay decoupled.
let socket = null;

export const useSocketStore = create(() => ({
  connected: false,
}));

function connect(accessToken) {
  if (socket || !accessToken) return;
  socket = io(`${env.VITE_SOCKET_URL}/rt`, { path: '/socket.io', auth: { token: accessToken } });
  socket.on('connect', () => useSocketStore.setState({ connected: true }));
  socket.on('disconnect', () => useSocketStore.setState({ connected: false }));
  socket.on('connect_error', () => useSocketStore.setState({ connected: false }));
}

function disconnect() {
  socket?.disconnect();
  socket = null;
  useSocketStore.setState({ connected: false });
}

useAuthStore.subscribe((state, prevState) => {
  const wasAuthenticated = prevState.status === 'authenticated';
  const isAuthenticated = state.status === 'authenticated';
  if (isAuthenticated && !wasAuthenticated) connect(state.session?.access_token);
  if (!isAuthenticated && wasAuthenticated) disconnect();
});

// Internal accessor for hooks/useSocketEvent.js — components never construct
// their own socket (FRONTEND.md §6); this is the one place that hands out
// the live instance so a hook can attach/detach a listener.
export function getSocketInstance() {
  return socket;
}
