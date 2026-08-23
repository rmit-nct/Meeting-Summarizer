import { useAuthStore } from '../stores/auth.store.js';
import { env } from '../config/env.js';

// The only module that knows the response envelope shape and the 401 rule.
// See FRONTEND.md §7, ENDPOINTS.md §0.
//
// The server always replies with { success, data, meta? }. We unwrap to `data`
// so call sites don't repeat `.data` everywhere — but paginated endpoints put
// page/limit/total/totalPages in `meta`, OUTSIDE `data`. Returning `data` alone
// silently loses pagination, so `meta` is merged onto the returned object when
// present. (Safe as long as no endpoint has a `data.meta` field of its own.)
async function request(path, init = {}) {
  const session = useAuthStore.getState().session;

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
    throw new HttpError('unauthorized', 'Your session has expired', 401);
  }

  if (!res.ok || body.success === false) {
    throw new HttpError(
      body?.error?.code ?? 'internal_error',
      body?.error?.message ?? res.statusText,
      res.status,
      body?.error?.details,
    );
  }

  const data = body.data;
  if (body.meta && data && typeof data === 'object' && !Array.isArray(data)) {
    return { ...data, meta: body.meta };
  }
  return data;
}

// Typed so components can branch on `err.code` ('not_found', 'invalid_state',
// 'validation_failed', …) instead of string-matching messages.
export class HttpError extends Error {
  constructor(code, message, status, details) {
    super(message);
    this.name = 'HttpError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// `signal` lets callers cancel in-flight requests — needed by debounced search,
// where a stale response could otherwise land after a newer one and overwrite it.
export const http = {
  get:    (path, { signal } = {}) => request(path, { signal }),
  post:   (path, body, { signal } = {}) =>
            request(path, { method: 'POST', body: JSON.stringify(body), signal }),
  patch:  (path, body, { signal } = {}) =>
            request(path, { method: 'PATCH', body: JSON.stringify(body), signal }),
  delete: (path, { signal } = {}) => request(path, { method: 'DELETE', signal }),
};