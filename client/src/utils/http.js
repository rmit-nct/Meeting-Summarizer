import { useAuthStore } from '../stores/auth.store.js';
import { env } from '../config/env.js';

export class HttpError extends Error {
  constructor(message, code, status, details) { super(message); this.code = code; this.status = status; this.details = details; }
}
async function request(path, init = {}, retried = false) {
  const accessToken = useAuthStore.getState().accessToken;
  const res = await fetch(`${env.VITE_API_URL}${path}`, { ...init, headers: {
    'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...init.headers,
  } });
  const body = res.status === 204 ? { success: true } : await res.json().catch(() => ({}));
  if (res.status === 401 && !retried) {
    try { await useAuthStore.getState().refresh(); return request(path, init, true); }
    catch { await useAuthStore.getState().signOut(); window.location.assign('/login'); }
  }
  if (!res.ok || body.success === false) throw new HttpError(body?.error?.message ?? res.statusText, body?.error?.code, res.status, body?.error?.details);
  return body.data;
}
export const http = {
  get: (path) => request(path), post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }), delete: (path) => request(path, { method: 'DELETE' }),
};
