# ENDPOINTS.md

The API contract: REST routes and WebSocket events.
**If you change either, change this file in the same commit.**

Base URL: `${SERVER_URL}/api`. Real-time namespace: `${SERVER_URL}/rt`.
Protocol split rationale: `ARCHITECTURE.md` §3.

---

## 0. Conventions

### Response envelope
Exactly two shapes, produced by `shared/response.js` and `middleware/errorHandler.js`:

```jsonc
// success
{ "success": true, "data": { }, "meta": { } }

// failure — only errorHandler.js emits this
{ "success": false, "error": { "code": "validation_failed", "message": "…", "details": { } } }
```

### Pagination
Every list endpoint, identically:

```jsonc
{ "success": true, "data": [ ],
  "meta": { "page": 1, "limit": 20, "total": 37, "totalPages": 2 } }
```

### Casing
The API speaks **camelCase**. The database is snake_case. `shared/dto.js` converts, along
with stripping `userId`, `storagePath`, `rawResponse`, and error internals. No module
hand-maps fields.

### Auth
`Authorization: Bearer <access_token>` on every route except the health check and
`/api/auth/{register,login,refresh,logout}`. `middleware/authenticate.js` verifies the
token via `modules/auth` and sets `req.user`. The server issues and owns its own tokens —
see §10 — not Supabase Auth. (The database still runs on Supabase Postgres/Storage,
accessed with the service-role key; only *identity* is custom.)

### Error codes

| Status | `error.code` |
| --- | --- |
| 400 | `validation_failed`, `unsupported_media_type`, `file_too_large` |
| 401 | `unauthorized`, `token_expired` |
| 403 | `forbidden` |
| 404 | `not_found` |
| 409 | `invalid_state` (e.g. summarize before a transcript exists) |
| 429 | `rate_limited` (include `details.retryAfterMs`) |
| 500 | `internal_error` |
| 502 | `ai_provider_error`, `transcription_failed`, `summarization_failed` |

Controllers throw `AppError`; they never format a failure response themselves.

---

## 1. `user` module — `/api/users`

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/me` | Current profile |
| `PATCH` | `/me` | Update `displayName`, `avatarUrl` |

---

## 2. `meeting` module — `/api/meetings`

### `POST /api/meetings`
Creates an empty meeting **card** — no file yet. The user creates this first, then attaches
a recording later from the meeting's own page. See `FRONTEND.md` §2 for the flow.

Request:
```json
{ "title": "Weekly sync", "description": "…", "meetingDate": "2026-08-03" }
```

Response `201`:
```json
{
  "success": true,
  "data": { "meeting": { "id": "…", "title": "Weekly sync", "status": "draft", "…": "…" } }
}
```

No `upload` object here — there's no file to upload to yet. `status` is always `draft`.

### `POST /api/meetings/:id/upload`
Attaches a file to an existing draft and returns a signed URL for the browser to upload to.
This is the step that used to be folded into `POST /api/meetings`.

Requires `status === 'draft'`, else `409 invalid_state` — a meeting only gets one file;
re-recording means deleting the meeting and starting over, not re-calling this endpoint.

Request:
```json
{
  "sourceType": "upload",
  "originalFilename": "sync.m4a",
  "mimeType": "audio/mp4",
  "sizeBytes": 18432000
}
```

Response `200`:
```json
{
  "success": true,
  "data": {
    "meeting": { "id": "…", "status": "uploaded", "…": "…" },
    "upload": { "signedUrl": "https://…", "path": "uid/mid/sync.m4a", "token": "…" }
  }
}
```

Validator checks `mimeType` against the allowlist (§7) and `sizeBytes` against
`MAX_UPLOAD_BYTES` before the service runs. On success, `meeting.service.js` writes
`source_type`, `original_filename`, `mime_type`, `size_bytes`, `storage_path`, and moves
`status` from `draft` to `uploaded` — all within the `meeting` module itself. This is the
one status transition `meeting` is allowed to make on its own; every transition from
`uploaded` onward belongs to `processing` (`ARCHITECTURE.md` §4.1).

### `GET /api/meetings`
History list with keyword search and date filter (both required by the brief).

| Query | Type | Default |
| --- | --- | --- |
| `q` | string | — keyword over title + transcript + summary |
| `from`, `to` | `YYYY-MM-DD` | — filter on `meetingDate` |
| `status` | enum | — |
| `page` | int ≥ 1 | 1 |
| `limit` | 1–50 | 20 |

Response: paginated envelope; each item is a summary row
(`id, title, status, meetingDate, durationSeconds, actionItemCount, createdAt`).

### `GET /api/meetings/:id`
Served by the **`overview`** module — the aggregator composes this from the `meeting`,
`transcript`, `summary`, and `action-item` interfaces. It is the only read a detail page
needs.

```json
{
  "success": true,
  "data": {
    "meeting": { },
    "transcript": { "fullText": "…", "segments": [ ], "language": "en" },
    "summary": { "overview": "…", "points": [
      { "id": "…", "content": "…", "category": "decision",
        "speaker": { "id": "…", "label": "Speaker 1", "displayName": "Minh" },
        "startMs": 412000, "orderIndex": 0 }
    ]},
    "actionItems": [
      { "id": "…", "content": "Send the deck", "ownerLabel": "Minh",
        "dueDate": "2026-08-07", "isDone": false }
    ],
    "speakers": [ ]
  }
}
```
`transcript` and `summary` are `null` until produced.

### `PATCH /api/meetings/:id`
Editable fields only: `title`, `description`, `meetingDate`. Anything else is ignored by
the validator.

### `DELETE /api/meetings/:id`
Deletes the row (children cascade), publishes `meeting:deleted` so the storage object is
removed. Response `200` with `data: { id }`.

---

## 3. `processing` module — `/api/meetings/:id`

### `POST /api/meetings/:id/process`
Starts the pipeline. Returns immediately; progress arrives over WebSocket.

Response `202`:
```json
{ "success": true, "data": { "meetingId": "…", "status": "transcribing" } }
```

`409 invalid_state` if the meeting is already `transcribing` or later — this is what stops
a double-click from billing two transcriptions.

### `POST /api/meetings/:id/resummarize`
Re-runs summarization only. Requires an existing transcript, else `409 invalid_state`.
Used after a speaker rename or a `failed` retry.

Replaces `summaries`, `summary_points`, and `speakers`. **Action items are merged, not
replaced** — never wipe items the user has already ticked off.

### `GET /api/meetings/:id/status`
The snapshot fallback for when the socket is disconnected, or on a page refresh.
Deliberately cheap: single row read, no joins.

```json
{ "success": true,
  "data": { "status": "summarizing", "progress": 0.75,
            "step": "Generating summary", "errorMessage": null } }
```

`progress` is a fixed lookup per status, not a measurement — it exists so the bar moves.

---

## 4. `action-item` module — `/api/action-items`

| Method | Path | Body / notes |
| --- | --- | --- |
| `GET` | `/?meetingId=…` | List for one meeting, or omit `meetingId` for a cross-meeting view. Paginated. |
| `POST` | `/` | `{ meetingId, content, ownerLabel?, dueDate? }` — manual add |
| `PATCH` | `/:id` | any of `{ content, ownerLabel, dueDate, isDone, orderIndex }` — this is what the checkbox calls |
| `DELETE` | `/:id` | |

---

## 5. `summary` module — speakers

### `PATCH /api/meetings/:id/speakers`
Bulk rename. Only `displayName` and `color` are writable; `label` is model-produced and
immutable.

```json
{ "speakers": [ { "id": "…", "displayName": "Minh", "color": "#2563eb" } ] }
```

---

## 6. `export` module — `/api/meetings/:id/export`

### `GET /api/meetings/:id/export?format=md|pdf`
Not an envelope response — a file download.

- `md` → `text/markdown`, `Content-Disposition: attachment; filename="<slug>.md"`
- `pdf` → `application/pdf`

Both are rendered from the same composed payload as `GET /api/meetings/:id`, so the export
can never disagree with the screen. Contents: title, date, duration, participants,
overview, bullets grouped by category, action item table.

**Vietnamese diacritics must render in the PDF.** Embed a font with full Latin Extended
coverage (Noto Sans, Be Vietnam Pro). A default font will silently drop them — check this
before calling the export done.

---

## 7. Upload constraints

| Constraint | Value | Enforced in |
| --- | --- | --- |
| Allowed MIME | Audio/video: `audio/mpeg`, `audio/mp4`, `audio/wav`, `audio/webm`, `audio/flac`, `audio/ogg`, `video/mp4`, `video/webm`, `video/quicktime` — sent to OpenAI Whisper. Text/subtitle: `text/vtt`, `application/x-subrip`, `text/plain`, `text/markdown` — parsed directly, no Whisper call (`FROM_MEETING_TO_JSON_PLAN.md` §3). `.srt` has no registered MIME type, so acceptance is primarily by extension. | `shared/constants.js` (`ALLOWED_UPLOAD_MIME_TYPES`) + `meeting.validator.js`, mirrored in the Dropzone |
| Max size | `MAX_UPLOAD_BYTES`, default 500 MB | same |
| OpenAI per-request audio limit | see `AI_INTEGRATION.md` §2 — larger inputs are preprocessed and chunked server-side, never rejected | `transcript/parsers/mp4.parser.js` |

The client-side check is a courtesy; the server check is the real one. Both must exist.

---

## 8. WebSocket — namespace `/rt`

### Handshake
```js
io(`${SERVER_URL}/rt`, { auth: { token: accessToken } }); // same access token as REST, §10
```
The server verifies the token via the `auth` module and joins the socket to `user:{userId}`.
An unverified socket is disconnected immediately.

### Server → client

| Event | Payload |
| --- | --- |
| `meeting:progress` | `{ meetingId, status, step, progress }` |
| `meeting:completed` | `{ meetingId }` |
| `meeting:failed` | `{ meetingId, code, message }` |
| `live:transcript-chunk` | `{ sessionId, seq, text, startMs, endMs }` |
| `live:summary-updated` | `{ sessionId, overview, points }` |
| `live:ended` | `{ sessionId, meetingId }` |
| `error` | `{ code, message }` — same codes as REST |

### Client → server

| Event | Payload | Ack |
| --- | --- | --- |
| `meeting:subscribe` | `{ meetingId }` | `{ ok: true }` |
| `meeting:unsubscribe` | `{ meetingId }` | `{ ok: true }` |
| `live:start` | `{ title, meetingDate }` | `{ sessionId }` |
| `live:chunk` | `{ sessionId, seq, blob }` | `{ received: seq }` |
| `live:end` | `{ sessionId }` | `{ meetingId }` |

Rules:
- Every inbound payload is validated by the module's validator, exactly like an HTTP body.
  A socket handler is not a shortcut past the inbound boundary.
- Ownership is re-checked on every event. Subscribing to another user's `meetingId` emits
  `error` with `forbidden` and does not join the room.
- Socket handlers call controllers, never services or repositories directly
  (`ARCHITECTURE.md` §2.4).

---

## 9. Client usage

Components never call `fetch` directly. Paths live in `client/src/config/endpoints.js`;
calls live in the component package's `*.service.js` (see `FRONTEND.md` §3).

```js
// client/src/config/endpoints.js — single source of truth for backend paths
export const ENDPOINTS = {
  auth: {
    register: () => '/api/auth/register',
    login:    () => '/api/auth/login',
    refresh:  () => '/api/auth/refresh',
    logout:   () => '/api/auth/logout',
    me:       () => '/api/auth/me',
  },
  meetings: {
    create:      () => '/api/meetings',
    list:        () => '/api/meetings',
    detail:      (id) => `/api/meetings/${id}`,
    upload:      (id) => `/api/meetings/${id}/upload`,
    process:     (id) => `/api/meetings/${id}/process`,
    resummarize: (id) => `/api/meetings/${id}/resummarize`,
    status:      (id) => `/api/meetings/${id}/status`,
    speakers:    (id) => `/api/meetings/${id}/speakers`,
    export:      (id, format) => `/api/meetings/${id}/export?format=${format}`,
  },
  actionItems: {
    list: () => '/api/action-items',
    byId: (id) => `/api/action-items/${id}`,
  },
  users: { me: () => '/api/users/me' },
};
```

A shared `utils/http.js` attaches the bearer token, unwraps `data`, and throws a typed
error from `error.code`. On a `401` it retries once after a silent token refresh
(`stores/auth.store.js#refresh`); if that also fails it signs the user out and redirects to
`/login`. Component services use it; they do not re-implement it.

---

## 10. `auth` module — `/api/auth`

Custom identity, not Supabase Auth: bcrypt-hashed passwords in `public.users`, our own
access/refresh JWTs (`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`), refresh tokens stored as a
sha256 hash in `public.refresh_tokens` (rotated on every use, revoked on logout). See
`server/src/modules/auth/`.

| Route | Body | Response | Auth |
| --- | --- | --- | --- |
| `POST /register` | `{ email, password, name }` | `{ user, accessToken, refreshToken }` | none, rate-limited |
| `POST /login` | `{ email, password }` | `{ user, accessToken, refreshToken }` | none, rate-limited |
| `POST /refresh` | `{ refreshToken }` | `{ user, accessToken, refreshToken }` | none — the refresh token itself is the credential |
| `POST /logout` | `{ refreshToken }` | `204` | none — revokes the given refresh token |
| `GET /me` | — | `user` | bearer access token |

`user` is `{ id, email, name, role, avatarUrl, createdAt, updatedAt }` — never `password_hash`.

`accessToken` expires after `ACCESS_TOKEN_TTL_MIN` (default 15 min); `refreshToken` after
`REFRESH_TOKEN_TTL_DAYS` (default 7 days). Every `/refresh` call rotates the refresh token —
the old one is revoked, so reusing a stolen-but-since-rotated token fails closed.
