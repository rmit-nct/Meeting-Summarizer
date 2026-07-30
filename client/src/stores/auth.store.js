import { create } from 'zustand';

// Supabase session, current user, signIn/signUp/signOut. The only place that
// talks to the Supabase auth client. See FRONTEND.md §6.
export const useAuthStore = create(() => ({
  // TODO: session, user, signIn, signUp, signOut
}));
