import { create } from 'zustand';
import { env } from '../config/env.js';

const REFRESH_KEY = 'meeting-summarizer-refresh-token';
const ACCESS_KEY = 'meeting-summarizer-access-token';

let refreshInFlight = null;

function persistSession(session) {
  localStorage.setItem(ACCESS_KEY, session.accessToken);
  localStorage.setItem(REFRESH_KEY, session.refreshToken);
}

function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function authRequest(path, body, accessToken) {
  const response = await fetch(`${env.VITE_API_URL}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = response.status === 204 ? { success: true } : await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const error = new Error(payload?.error?.message ?? 'Authentication failed');
    error.code = payload?.error?.code;
    throw error;
  }
  return payload.data;
}

export const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: localStorage.getItem(ACCESS_KEY),
  refreshToken: localStorage.getItem(REFRESH_KEY),
  hydrated: false,
  async signIn(email, password) {
    const session = await authRequest('/api/auth/login', { email, password });
    persistSession(session); set({ ...session, hydrated: true }); return session;
  },
  async signUp(email, password, name) {
    const session = await authRequest('/api/auth/register', { email, password, name });
    persistSession(session); set({ ...session, hydrated: true }); return session;
  },
  // Shares one in-flight request across concurrent callers (StrictMode's
  // double-effect on RouteGuard's hydrate(), or two API calls 401ing at
  // once) instead of firing the refresh twice — the server tolerates that
  // race (each refresh call gets its own unique token), but there's no
  // reason to spend two round trips and two token rotations on it.
  async refresh() {
    if (refreshInFlight) return refreshInFlight;
    const refreshToken = get().refreshToken ?? localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) throw new Error('No refresh token');
    refreshInFlight = (async () => {
      const session = await authRequest('/api/auth/refresh', { refreshToken });
      persistSession(session); set({ ...session, hydrated: true }); return session.accessToken;
    })();
    try { return await refreshInFlight; }
    finally { refreshInFlight = null; }
  },
  async hydrate() {
    if (get().hydrated) return;
    try { await get().refresh(); } catch { clearSession(); set({ user: null, accessToken: null, refreshToken: null, hydrated: true }); }
  },
  async signOut() {
    const refreshToken = get().refreshToken;
    set({ user: null, accessToken: null, refreshToken: null, hydrated: true }); clearSession();
    if (refreshToken) await authRequest('/api/auth/logout', { refreshToken }).catch(() => {});
  },
}));
