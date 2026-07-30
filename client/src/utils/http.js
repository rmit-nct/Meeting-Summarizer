import { useAuthStore } from '../stores/auth.store.js';
import { env } from '../config/env.js';

// The only module that knows the response envelope shape and the 401 rule.
// See FRONTEND.md §7, ENDPOINTS.md §0.
async function request(path, init = {}) {
  const session = useAuthStore.getState().session; // TODO: once auth.store is implemented
  const res = await fetch(`${env.VITE_API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...init.headers,
    },
  });

  const body = await res.json().catch(() => ({}));

  if (res.status === 401) {
    // TODO: sign the user out via auth.store.js and redirect to /login
    throw new Error('unauthorized');
  }
  if (!res.ok || body.success === false) {
    throw new Error(body?.error?.message ?? res.statusText);
  }
  return body.data;
}

export const http = {
  get:    (path) => request(path),
  post:   (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  patch:  (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
