import { useEffect } from 'react';

// Subscribes to a socket event for the component's lifecycle. See FRONTEND.md §6.
export function useSocketEvent(event, handler) {
  useEffect(() => {
    // TODO: socket.on(event, handler); return () => socket.off(event, handler);
  }, [event, handler]);
}
