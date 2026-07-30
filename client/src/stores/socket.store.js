import { create } from 'zustand';

// The one socket connection for the whole app. See ARCHITECTURE.md §3.2, FRONTEND.md §6.
export const useSocketStore = create(() => ({
  connected: false,
  // TODO: socket instance, connect(), disconnect()
}));
