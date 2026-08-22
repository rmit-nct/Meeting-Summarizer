import { create } from 'zustand';

// Theme, toasts, global modals. See FRONTEND.md §6.
// Toasts are for transient failures only (DESIGN.md "States") — form errors stay inline.
let nextId = 1;

export const useUiStore = create((set) => ({
  toasts: [],

  pushToast: ({ tone = 'neutral', message, duration = 4000 }) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, tone, message }] }));
    if (duration) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
    return id;
  },

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
