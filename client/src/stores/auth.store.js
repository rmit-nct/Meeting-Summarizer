import { create } from 'zustand';

// Supabase session, current user, signIn/signUp/signOut. The only place that talks to the
// Supabase auth client. See FRONTEND.md §6.
//
// PLACEHOLDER IMPLEMENTATION: signIn/signUp/signOut below simulate the real flow (latency +
// failure path) against an in-memory fake instead of calling `supabase.auth.*`. The public
// shape (status/session/user/signIn/signUp/signOut) is the real, final shape — swapping in
// `supabase` from utils/supabase.js at the three marked TODOs is the only change needed to
// connect the real API. Every page built against this store already reads `status`/`user`,
// never "did signIn resolve", so nothing downstream needs to change either.

const MOCK_LATENCY_MS = 550;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const useAuthStore = create((set) => ({
  status: 'unauthenticated', // 'unauthenticated' | 'authenticating' | 'authenticated'
  session: null,
  user: null,
  error: null,

  async signIn({ email, password }) {
    set({ status: 'authenticating', error: null });
    await delay(MOCK_LATENCY_MS);

    // TODO: replace with `const { data, error } = await supabase.auth.signInWithPassword({ email, password })`
    if (!email || password.length < 6) {
      const message = 'Invalid email or password.';
      set({ status: 'unauthenticated', error: message });
      throw new Error(message);
    }

    const user = { id: 'mock-user', email, name: email.split('@')[0] };
    set({ status: 'authenticated', session: { access_token: 'mock-token' }, user, error: null });
    return user;
  },

  async signUp({ username, email, password }) {
    set({ status: 'authenticating', error: null });
    await delay(MOCK_LATENCY_MS);

    // TODO: replace with `const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username } } })`
    if (!email || password.length < 6) {
      const message = 'Please check your details and try again.';
      set({ status: 'unauthenticated', error: message });
      throw new Error(message);
    }

    const user = { id: 'mock-user', email, name: username };
    set({ status: 'authenticated', session: { access_token: 'mock-token' }, user, error: null });
    return user;
  },

  async signOut() {
    // TODO: replace with `await supabase.auth.signOut()`
    set({ status: 'unauthenticated', session: null, user: null, error: null });
  },

  clearError() {
    set({ error: null });
  },
}));

// Convenience selector used by RouteGuard and the app shell.
export const selectIsAuthenticated = (state) => state.status === 'authenticated';
