# ARCHITECTURE.md

**NCT Meeting Summarizer** — architecture of record.

This document merges the team's standing architectural style (client–server split, backend
Modular Monolith, N-Tier layering on both sides, REST + WebSocket dual protocol,
package-based frontend components) with the concrete requirements of the NCT Meeting
Summarizer brief (Supabase Postgres/Auth/Storage, Groq Whisper + Llama, live deployed link).

Where the two disagreed, §0 records the decision and the reason.

---

## 0. Reconciled decisions

| Point of conflict | Decision | Reason |
| --- | --- | --- |
| Team style says "managed document database"; the brief mandates Supabase Postgres | **Supabase Postgres.** | The brief requires Supabase for DB, Auth, and Storage — it is a graded requirement. The repository layer exists precisely so this swap costs nothing above it: services and controllers are unchanged. |
| The "persistence transform" convention (rename `_id`, drop `__v`) is document-DB specific | **Kept, repurposed.** Postgres rows already expose a clean `id`. The convention now means: one shared DTO helper strips internal fields (`user_id`, `storage_path`, `raw_response`, error internals) uniformly before anything leaves the service layer. | Same principle preserved — one project-wide serialization rule, not a per-module decision. |
| Serverless functions vs a long-running Node process | **Long-running Node process.** | Removes the two hardest problems in this project: wall-clock timeouts on long transcriptions, and no ffmpeg in a serverless runtime. Media processing needs a real process. |
| Status polling vs WebSocket | **WebSocket primary, `GET /status` retained as fallback.** | Matches the team's protocol split, gives a live progress UI for free, and is the foundation the live-meeting stretch feature needs. Polling stays for reconnect/refresh, where a fresh socket has no history. |
| RLS as the authorization boundary | **Authorization enforced in the service/repository layer; RLS kept as defence in depth.** | The backend holds the service-role key, which bypasses RLS. Every repository method therefore takes `userId` and scopes the query on it. RLS still protects against a leaked anon key. |
| Modules should own their models | **Kept, with three model-less modules** (`processing`, `overview`, `export`). | The team style already permits orchestration/aggregation modules with no persistent model. This project needs exactly that shape for its pipeline and its composed read endpoints. |

---

## 1. Overall style

- **Client–Server.** `client/` and `server/` are separate codebases with separate
  dependency trees and build pipelines, deployed and versioned independently, coupled only
  through the REST + WebSocket contract.
- **Modular Monolith** on the backend: one deployable Node process, internally partitioned
  into bounded-context modules that own their own data and business rules.
- **N-Tier (Layered)** on both sides, at different granularity — backend layered *within
  each module*, frontend layered *within each component package*.
- **Dual protocol.** REST for request/response and CRUD; WebSocket for continuous,
  stateful, bidirectional interaction.

```
┌──────────────────────────────┐       REST /api/*        ┌───────────────────────────────┐
│  client/  (React SPA)        │ ◄──────────────────────► │  server/ (Node, long-running) │
│  static build on CDN host    │                          │  HTTP + WebSocket, one process│
│                              │ ◄──── WebSocket /rt ────► │                               │
└──────────────────────────────┘                          └───────────┬───────────────────┘
             │                                                        │
             │  direct upload via signed URL                          │
             ▼                                                        ▼
      ┌──────────────────┐                             ┌────────────────────┬────────────┐
      │ Supabase Storage │ ◄── download for processing │ Supabase Postgres  │  Groq API  │
      │ (private bucket) │                             │ (managed, external)│ Whisper +  │
      └──────────────────┘                             │                    │ Llama 3.3  │
                                                       └────────────────────┴────────────┘
```

Media bytes never traverse the API. The browser uploads straight to Supabase Storage using
a short-lived signed URL issued by the server; the server downloads the object when it is
ready to process it.

---

## 2. Backend — Modular Monolith

### 2.1 Module boundary rules

- A module may **not** import another module's internal service, repository, or model.
- Cross-module communication happens only through:
  1. the module's public **interface** (`*.interface.js` — an explicit exported contract), or
  2. the decoupled **event bus** (publish/subscribe), for fire-and-forget side effects.
- A module may own no persistent model at all, existing purely as an
  **orchestration/aggregation layer** composing other modules' interfaces.

### 2.2 Modules

| Module | Owns | Role |
| --- | --- | --- |
| `auth` | — (delegates to Supabase Auth) | Verifies Supabase JWTs, resolves the request user, exposes `requireAuth`. |
| `user` | `Profile` | Display name, avatar, account settings. |
| `meeting` | `Meeting` | The durable meeting record. Owns creation as an empty `draft` card and the `draft → uploaded` transition when a file is attached later. Everything from `uploaded` onward belongs to `processing`. |
| `transcript` | `Transcript` | Audio preprocessing (ffmpeg) + Groq Whisper + segment storage. |
| `summary` | `Summary`, `SummaryPoint`, `Speaker` | Groq Llama call, JSON parsing/normalization, bullets, topic tags, speaker labels. |
| `action-item` | `ActionItem` | CRUD + completion state. Seeded from summary output, then user-owned. |
| `live-session` | `LiveSession` (transient, TTL) | Real-time recording session; materializes into durable records on end. |
| `processing` | — | **Orchestrator.** Drives the AI pipeline (`uploaded` onward), publishes progress events. |
| `overview` | — | **Aggregator.** Builds composed meeting-detail and history-list responses from the interfaces above. |
| `export` | — | Renders Markdown and PDF from `overview`'s composed payload. |

`processing`, `overview`, and `export` are the model-less modules. They are where the
project's cross-cutting write and read flows live, so no module ever reaches into another's
internals.

### 2.3 Directory layout

```
server/
├── src/
│   ├── index.js                     # single entry: bootstraps HTTP + WebSocket together
│   ├── app.js                       # express app assembly, middleware chain, route mounting
│   │
│   ├── config/                      # global config layer — outside the module/tier structure
│   │   ├── database.js              # Postgres connection
│   │   ├── supabase.js              # service-role client (DB + Storage)
│   │   ├── groq.js                  # Groq SDK client
│   │   ├── upload.js                # signed-URL issuance, MIME/size allowlists
│   │   ├── socket.js                # WebSocket server + namespace registration
│   │   └── swagger.js               # OpenAPI generation
│   │
│   ├── middleware/                  # shared middleware layer
│   │   ├── authenticate.js          # verifies Supabase JWT → req.user
│   │   ├── authorize.js             # role checks
│   │   ├── validate.js              # runs a module's validator schema
│   │   ├── rateLimit.js
│   │   └── errorHandler.js          # centralized; the ONLY place that formats a failure envelope
│   │
│   ├── shared/                      # shared utilities layer
│   │   ├── eventBus.js
│   │   ├── response.js              # success()/failure() envelope + paginate()
│   │   ├── errors.js                # AppError hierarchy with machine codes
│   │   ├── dto.js                   # the project-wide serialization transform
│   │   ├── constants.js             # statuses, categories, limits
│   │   └── logger.js
│   │
│   └── modules/
│       ├── auth/  user/  meeting/  transcript/  summary/
│       ├── action-item/  live-session/
│       └── processing/  overview/  export/
└── package.json
```

### 2.4 Internal N-Tier flow

Within each module, dependencies flow strictly in one direction:

```
Route / Socket Handler → Controller → Service → Repository / Interface → Model
```

A full module package:

```
meeting/
├── meeting.model.js         # schema definition / table mapping
├── meeting.repository.js    # ALL data access. Every method takes userId and scopes on it.
├── meeting.service.js       # business rules, status transitions, event publishing
├── meeting.controller.js    # HTTP-shaped: reads req, calls service, returns envelope
├── meeting.routes.js        # path → middleware chain → controller
├── meeting.validator.js     # inbound boundary: request schema validation
├── meeting.dto.js           # outbound boundary: response shaping, strips internal fields
├── meeting.interface.js     # public contract other modules may call
└── meeting.socket.js        # optional: this module's real-time handlers
```

Non-negotiable:
- Routes and socket handlers never touch models.
- Services never bypass the repository.
- Validators run **before** controller logic. Controllers assume valid input.
- DTOs run **before** data leaves the service layer. Nothing raw from a repository reaches
  a controller-consumable surface.
- `meeting.interface.js` exposes only what other modules genuinely need
  (`getMeetingForOwner`, `assertOwnership`, `markFailed`, …) — never the whole service.

### 2.5 Cross-cutting conventions

**Response envelope.** Exactly two shapes, project-wide:

```jsonc
// success
{ "success": true, "data": { }, "meta": { } }

// failure — produced only by errorHandler.js
{ "success": false, "error": { "code": "validation_failed", "message": "…", "details": { } } }
```

**Pagination.** Every list endpoint, identically:

```jsonc
{ "success": true,
  "data": [ ],
  "meta": { "page": 1, "limit": 20, "total": 37, "totalPages": 2 } }
```

**Serialization transform.** `shared/dto.js` provides the one rule every module's DTO
composes with: drop `user_id`, `storage_path`, `raw_response`, and any error internals;
serialize timestamps as ISO strings. A Storage path or a raw provider response must never
reach a client.

**Errors.** Modules throw typed `AppError`s carrying a machine code. Only `errorHandler.js`
converts them into a response. No `res.status(400).json(...)` inside a controller.

---

## 3. Protocol split

### 3.1 REST — request/response

Auth callbacks, profile management, meeting CRUD, paginated history, keyword/date search,
transcript and summary retrieval, action-item CRUD, speaker renaming, exports, and one-off
state snapshots (including `GET /api/meetings/:id/status`).

Full contract: `ENDPOINTS.md`.

### 3.2 WebSocket — continuous/stateful

A single namespace, `/rt`, hosts all real-time events. Convention: `namespace:action`, with
structured object payloads in both directions.

**Connection.** The client connects with its Supabase access token in the handshake auth
payload. The server verifies it through the `auth` module and joins the socket to a private
room `user:{userId}`. An unverified socket is disconnected immediately — there is no
anonymous real-time surface.

**Server → client**

| Event | Payload | When |
| --- | --- | --- |
| `meeting:progress` | `{ meetingId, status, step, progress }` | Every pipeline state transition |
| `meeting:completed` | `{ meetingId }` | Pipeline reaches `completed` |
| `meeting:failed` | `{ meetingId, code, message }` | Pipeline reaches `failed` |
| `live:transcript-chunk` | `{ sessionId, seq, text, startMs, endMs }` | A live chunk finished transcribing |
| `live:summary-updated` | `{ sessionId, overview, points }` | Rolling summary refreshed |
| `live:ended` | `{ sessionId, meetingId }` | Live session materialized into a durable meeting |

**Client → server**

| Event | Payload | Purpose |
| --- | --- | --- |
| `meeting:subscribe` | `{ meetingId }` | Join the room for one meeting's progress |
| `meeting:unsubscribe` | `{ meetingId }` | Leave it |
| `live:start` | `{ title, meetingDate }` | Open a `LiveSession` |
| `live:chunk` | `{ sessionId, seq, blob }` | Push an audio chunk |
| `live:end` | `{ sessionId }` | Close and materialize |

**Presence.** Connect/disconnect are tracked per user so a live session survives a reconnect
instead of being lost.

### 3.3 Transient vs durable state

This is the model that makes the brief's "Additional" feature tractable.

| | Transient | Durable |
| --- | --- | --- |
| Entity | `LiveSession` | `Meeting` + `Transcript` + `Summary` |
| Mutability | Mutated many times per minute (chunks appended, rolling summary replaced) | Immutable once written, except explicit user edits |
| Lifetime | Time-boxed: `expiresAt`, swept by a periodic job | Durable |
| Driven by | WebSocket events | REST |

On `live:end`, `live-session` calls the `meeting`, `transcript`, and `summary` interfaces to
materialize one durable record set, emits `live:ended`, and marks the session expired. If a
session expires without a clean end, the sweeper materializes whatever exists and marks the
meeting `completed`, or `failed` if there is no usable transcript. **A dropped connection
must never silently lose a recording.**

---

## 4. The processing pipeline

A meeting moves through two owners. `meeting` itself creates the card and owns the single
`draft → uploaded` transition once a file is attached, from the meeting's own page — a
meeting can sit in `draft` indefinitely with no file at all. From `uploaded` onward,
`processing` is the only module that writes `meeting.status`, doing so through the
`meeting` interface.

```
 client                          meeting
   │  POST /api/meetings              │
   ├─────────────────────────────────►│ create() → status=draft
   │  ◄──────────── 201, no file ─────┤
   │                                  │
   │   (user opens the meeting page, picks or records a file — could be any time later)
   │                                  │
   │  POST /:id/upload                │
   ├─────────────────────────────────►│ status=uploaded
   │  ◄──────── signed upload URL ────┤
   │                                  │
   ├── PUT file → Supabase Storage (direct) ────────────►
```

From here, `processing` takes over:

```
 client                    processing            transcript             summary
   │  POST /:id/process         │                     │                     │
   ├───────────────────────────►│ status=transcribing │                     │
   │  ◄──── 202 Accepted ───────┤ publish             │                     │
   │                            │  meeting:uploaded ─►│ download + ffmpeg   │
   │  ◄═ ws meeting:progress ═══╡                     │ Groq Whisper        │
   │                            │◄─ transcript:created┤ status=transcribed  │
   │  ◄═ ws meeting:progress ═══╡ status=summarizing ──────────────────────►│ Groq Llama
   │                            │                     │                     │ parse+normalize
   │                            │◄──────────────── summary:created ─────────┤
   │                            │ publish summary:action-items-extracted ──► action-item
   │  ◄═ ws meeting:completed ══╡ status=completed    │                     │
```

Event bus contracts:

| Event | Publisher | Subscribers |
| --- | --- | --- |
| `meeting:uploaded` | `processing` | `transcript` |
| `transcript:created` | `transcript` | `processing` |
| `summary:created` | `summary` | `processing` |
| `summary:action-items-extracted` | `summary` | `action-item` |
| `pipeline:failed` | any stage | `processing` (status write + socket emit) |
| `meeting:deleted` | `meeting` | storage cleanup, `transcript`, `summary`, `action-item` |

Why the event bus rather than direct calls: `transcript` must not know that `summary`
exists, and neither should know anything about WebSocket emission. `processing` subscribes
to everything and is the single place translating domain events into status transitions and
socket messages.

### 4.1 State machine

`meeting.status` is the single source of truth. Terminal states: `completed`, `failed`.

```
draft ──► uploaded ──► transcribing ──► transcribed ──► summarizing ──► completed
              │              │                │               │
              └──────────────┴────────────────┴───────────────┴────► failed  (+ errorMessage)
```

- `draft → uploaded` is written by `meeting` itself when a file is attached
  (`ENDPOINTS.md` §2). Every transition from `uploaded` onward is written by `processing`.
- Forward-only, or to `failed`. Never backwards. `draft` never fails — there's nothing to
  fail yet; a meeting stuck in `draft` is just waiting for a file, not broken.
- Every transition to `failed` writes a message a non-technical evaluator can read —
  never a raw stack trace.
- Retry re-enters at the earliest incomplete stage: if a transcript already exists, retry
  only re-runs summarization.
- `progress` in the socket payload is a fixed lookup per status (`draft` 0, `uploaded` 0.1
  → `completed` 1.0). It exists so the bar moves; it is not a measurement.

### 4.2 What the long-running process buys us

Because the backend is a persistent Node process rather than a serverless function:

- **ffmpeg is available.** Video → audio extraction and 16 kHz mono downsampling happen
  server-side, in `transcript`. The client uploads the original file untouched.
- **No wall-clock ceiling.** A 60-minute recording can transcribe in one pass. Chunking is
  still used when a file exceeds Groq's per-request audio size limit — for that reason
  only, not to dodge a platform timeout.
- **In-process job state.** The pipeline runs in the same process that holds the WebSocket
  connections, so progress emission needs no external queue or pub/sub broker.

Trade-off accepted: a single process is a single point of failure and will not scale
horizontally without an external queue. At this project's scale that is the right trade,
and the seam is already in place — replace the in-memory event bus with a durable queue and
no module code changes.

---

## 5. Frontend

### 5.1 Layers

```
Pages  →  Components  →  Hooks / Services  →  Global Stores / Utils
```

- **Pages** — composition root, grouped by access tier.
- **Components** — presentation + local interaction logic.
- **Hooks** — stateful logic and event handlers, decoupled from JSX.
- **Services** (component-scoped) — outbound API calls for that specific component.
- **Global stores** — session/auth state, socket connection state, UI/theme state.
- **Global utils/config** — helpers and the single source of truth for backend endpoint
  definitions, usable by any layer without violating dependency direction.

### 5.2 Layout

```
client/
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── routes/
│   │   ├── routeTable.js            # centralized URL → page map
│   │   └── RouteGuard.jsx           # role-based gate, mirrors backend authorize.js
│   ├── pages/
│   │   ├── public/                  # Landing, Login, Signup, AuthCallback
│   │   └── authenticated/           # MeetingHistory, NewMeeting, MeetingDetail, Settings
│   ├── components/
│   │   ├── Dropzone/  Recorder/  ProcessingStatus/
│   │   ├── SummaryView/  TranscriptView/  ActionItemList/
│   │   ├── SpeakerLegend/  ExportMenu/  LiveSessionPanel/
│   ├── stores/
│   │   ├── auth.store.js
│   │   ├── socket.store.js
│   │   └── ui.store.js
│   ├── hooks/                       # global hooks only (useSocketEvent, useAuth)
│   ├── config/
│   │   ├── endpoints.js             # SINGLE source of truth for backend paths
│   │   └── env.js                   # validated import.meta.env access
│   └── utils/
└── vite.config.js
```

### 5.3 Package-based componentization

Each component is a self-contained package, not a file:

```
ProcessingStatus/
├── index.jsx                        # presentation (JSX) only
├── sub-components/                  # children private to this package
│   ├── StatusStepper.jsx
│   └── FailureNotice.jsx
├── useProcessingStatus.hook.js      # logic, socket subscription, fallback polling
├── processingStatus.service.js      # API calls scoped to this component
└── ProcessingStatus.css
```

A component is exposed to the rest of the app **only** through its `index.jsx`. Nothing
outside the package imports its hook, service, or sub-components.

An `index.jsx` containing an API call, or a hook file containing JSX, is a layering
violation and should be caught in review.

### 5.4 Routing and access control

- `routes/routeTable.js` maps every path to a page and an access tier.
- `RouteGuard.jsx` enforces the tier before a page renders: `public` (redirects signed-in
  users away from Login/Signup) and `authenticated` (redirects to Login otherwise). A third
  `elevated` tier is scaffolded but unused — the brief defines no admin role.
- The guard is a UX affordance, not security. **Every rule it enforces is enforced again in
  `middleware/authorize.js`.** A client-side guard alone protects nothing.

### 5.5 Real-time on the client

`socket.store.js` owns exactly one socket connection for the whole app, created after
authentication and torn down on sign-out. Components never construct their own socket.

`useSocketEvent(event, handler)` subscribes and unsubscribes with the component lifecycle.

`ProcessingStatus` subscribes to `meeting:progress` / `meeting:completed` / `meeting:failed`.
If the socket is disconnected, its hook **falls back to polling `GET /api/meetings/:id/status`
every 3 s** and stops as soon as the socket returns. The UI renders from the state machine,
so it behaves identically under either transport.

---

## 6. Deployment

| Piece | Target | Notes |
| --- | --- | --- |
| `client/` | Static SPA build on a CDN/static host (Vercel/Netlify) | All routes rewritten to `index.html` for client-side routing. This is the "live deployed link" the brief requires. |
| `server/` | One long-running Node process (Render / Railway / Fly.io) | HTTP + WebSocket bootstrapped from the same entry point. Requires a host that supports persistent connections — a serverless host breaks both WebSocket and the pipeline. |
| Database | Supabase Postgres — managed, external | Not colocated with either app. |
| Object storage | Supabase Storage, private bucket | Not colocated with either app. |

Independently deployed and versioned; coupled only through the REST/WebSocket contract.

Consequences to handle explicitly:
- **CORS.** The server allowlists the client origin from config — the dev origin locally,
  the deployed origin in production. Never `*`.
- **Socket origin.** The WebSocket server needs the same allowlist.
- **Cold start.** Free tiers on Render/Railway sleep idle instances; the first request after
  sleep can take 30–60 s. Wake the backend before recording the demo video and before the
  evaluators open the live link.

---

## 7. Principles summary

| Principle | Applied as |
| --- | --- |
| Separation of concerns | N-Tier layering — backend per-module, frontend per-component package |
| Bounded contexts | Modular Monolith; one owning module per model; model-less orchestration modules for cross-cutting flows |
| Encapsulation across boundaries | Modules reachable only via `*.interface.js` or the event bus; components only via `index.jsx` |
| Protocol-appropriate communication | REST for CRUD/snapshots, WebSocket for pipeline progress and live sessions |
| Data shape consistency | One response envelope, one pagination shape, one serialization transform, project-wide |
| Transient vs durable state | `LiveSession` (TTL, mutable) materializes into `Meeting`/`Transcript`/`Summary` (durable, immutable) |
| Defence in depth | Authorization in service + repository; RLS retained; route guard mirrored by backend middleware |
| Failure is a first-class state | `failed` + human-readable `errorMessage` at every pipeline stage, surfaced over both protocols |
