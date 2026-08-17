import { useEffect } from 'react';
import { useSocketStore, getSocketInstance } from '../stores/socket.store.js';

// Subscribes to a socket event for the component's lifecycle. See FRONTEND.md §6.
// Re-attaches whenever the store's `connected` flag flips, so a listener
// registered before the socket exists (e.g. right after sign-in, before the
// handshake resolves) still ends up attached once it does.
export function useSocketEvent(event, handler) {
  const connected = useSocketStore((s) => s.connected);

  useEffect(() => {
    const socket = getSocketInstance();
    if (!socket) return undefined;
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, [event, handler, connected]);
}
