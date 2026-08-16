import { create } from 'zustand';
import { env } from '../config/env.js';

const REFRESH_KEY = 'meeting-summarizer-refresh-token';
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
  user: null, accessToken: null, refreshToken: localStorage.getItem(REFRESH_KEY), hydrated: false,
  async signIn(email, password) {
    const session = await authRequest('/api/auth/login', { email, password });
    localStorage.setItem(REFRESH_KEY, session.refreshToken); set({ ...session, hydrated: true }); return session;
  },
  async signUp(email, password, name) {
    const session = await authRequest('/api/auth/register', { email, password, name });
    localStorage.setItem(REFRESH_KEY, session.refreshToken); set({ ...session, hydrated: true }); return session;
  },
  async refresh() {
    const refreshToken = get().refreshToken ?? localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) throw new Error('No refresh token');
    const session = await authRequest('/api/auth/refresh', { refreshToken });
    localStorage.setItem(REFRESH_KEY, session.refreshToken); set({ ...session, hydrated: true }); return session.accessToken;
  },
  async hydrate() {
    if (get().hydrated) return;
    try { await get().refresh(); } catch { localStorage.removeItem(REFRESH_KEY); set({ user: null, accessToken: null, refreshToken: null, hydrated: true }); }
  },
  async signOut() {
    const refreshToken = get().refreshToken;
    set({ user: null, accessToken: null, refreshToken: null, hydrated: true }); localStorage.removeItem(REFRESH_KEY);
    if (refreshToken) await authRequest('/api/auth/logout', { refreshToken }).catch(() => {});
  },
}));
