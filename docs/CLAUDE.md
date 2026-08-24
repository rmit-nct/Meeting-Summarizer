# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Guidance for Claude Code when working in the **NCT Meeting Summarizer** repository.
Read this file first. It is the index; the detail lives in the linked docs.

---

## 0. Current state of the code

The repo started at the **scaffold stage** (see `SCAFFOLD.md`) and is now partway through
implementation, unevenly across modules and unevenly *between the two apps* — the backend
is implemented bottom-up (data pipeline first), the frontend is implemented top-down (UI
first, data wiring last). Business files (`*.service.js`, `*.repository.js`,
`*.controller.js`, `*.validator.js`, `*.dto.js`, `*.interface.js`, prompts, export
renderers) that are still genuinely empty carry a single comment pointing at the doc
section to implement from — for those, read the referenced doc section instead of the
file. Where a module below is marked implemented, read the file itself.

### Backend (`server/`)

- **Implemented — application code, not yet fully runnable end-to-end (see the schema note
  below):** `meeting` (create/list/update/delete, `POST /:id/upload` issuing a signed
  Storage URL), `transcript` (ffmpeg + OpenAI Whisper for audio/video, plus a Strategy+Factory
  parser set — `transcript/parsers/` — for `.vtt`/`.srt`/`.txt`/`.md`, see
  `FROM_MEETING_TO_JSON_PLAN.md` §3), `summary` (OpenAI GPT call, defensive JSON
  parse/validate/retry-once, tempId-based normalization into `summaries`/`summary_points`/
  `speakers` — see `FROM_MEETING_TO_JSON_PLAN.md` §4-§6), `action-item` (CRUD + the
  additive seed/merge insert from summary output), `overview` (the composed `GET /:id`
  aggregate), and `processing` (status machine, socket progress, `/process` retry that
  redirects to resummarize when a transcript already exists, `/resummarize`).
  `middleware/authenticate.js` and `modules/auth/` verify a real Supabase-shaped JWT
  (HS256 against `SUPABASE_JWT_SECRET`) — sign-in/up/out are still entirely client-side
  against Supabase Auth per the architecture, this module only verifies.
- **Schema gap, intentional:** `server/supabase/migrations/` currently only has
  `meetings` and `transcripts` (pre-existing). There is **no migration for `summaries`,
  `summary_points`, `speakers`, or `action_items`** — Supabase schema/config setup belongs
  to another team member and is merged separately; this pass deliberately stayed on the
  "connect the repository to the database" side (repositories, services, routes) and did
  not add or modify migrations. Until that migration is merged, everything from
  `summary`/`action-item` onward in the pipeline will fail at the Supabase call with
  "relation does not exist" — that is expected, not a bug to chase. `meeting.repository.js`
  and `transcript.repository.js` were deliberately kept to the exact shape of the two
  migrations that already exist (no new columns, no changed RPC signatures) for the same
  reason — see the "status filter" and "source_kind" notes in `MODELS.md` §5 and
  `transcript.repository.js` for the specific things that had to be routed around rather
  than added to the schema.
- **Still scaffold:** `user`, `export`, `live-session`. `auth` is verification-only by
  design (`ARCHITECTURE.md` §2.2) — there is no `auth.controller.js`/`auth.routes.js` to
  build; that's not a gap.
- A stray `server/supabase/202608120001_auth.sql` (outside `migrations/`) defines a
  **custom `public.users` + `refresh_tokens` schema with `password_hash`** — this
  contradicts the Supabase-Auth-only design in `MODELS.md`/`ARCHITECTURE.md` and was never
  reconciled by whichever branch introduced it. Nothing in the implemented backend reads
  from it. Flagged here, not fixed — deciding whether to delete it or migrate real auth
  onto it is a scope decision for the team, not an incidental cleanup.

The practical next backend gaps are `user` (profile display name/avatar — small) and
`export` (Markdown/PDF rendering from the same composed `overview` payload).

### Frontend (`client/`)

Every page and every component package's `index.jsx` is real, finished JSX built against
the "Serene Protocol" design system (tokens in `.claude/DESIGN.md`, rationale in
`.claude/TASTE.md`). Wiring to the real backend is now **per-component, not all-or-nothing
— check the specific piece before assuming it's still mock-driven**:

- **Wired to the real API:** `MeetingDetail` (fetches `GET /:id` via
  `useMeetingDetail.hook.js`; no more `mockData.js`), `ProcessingStatus` (real socket
  subscription + 3s polling fallback per `FRONTEND.md` §5, wired through
  `stores/socket.store.js`, which now holds a real `socket.io-client` connection created
  when `auth.store.js`'s `status` becomes `'authenticated'`), `ActionItemList` and
  `SpeakerLegend` (own local optimistic state seeded from the parent's fetch, since there's
  no global meetings store — mutate via `*.service.js`, roll back on failure),
  `UploadProgress`'s actual data source `utils/upload.js` (signed URL → PUT → trigger
  processing), and `NewMeeting` (`POST /api/meetings`).
- **Still mock/simulated:** `Dropzone`/`Recorder`'s own internals were **not** touched by
  this pass — they already call `utils/upload.js`, which is now real, so uploading through
  them works, but their component code itself wasn't part of this integration and hasn't
  been re-verified beyond that. `MeetingHistory`/`useMeetingList` still reads
  `utils/mockData.js`. `useAuthStore` (`stores/auth.store.js`) still simulates
  `signIn`/`signUp`/`signOut` against an in-memory fake — **this is why the socket rarely
  connects in practice today**: it hands out `session.access_token = 'mock-token'`, which
  is not a real JWT, so `config/socket.js`'s handshake verification rejects it and
  `ProcessingStatus` always falls back to polling. Wiring `auth.store.js` to real
  `supabase.auth.*` is what unblocks the socket path.
- `TranscriptView`/`SummaryView` remain presentational-only by design (driven entirely by
  props from `MeetingDetail`) — their `*.service.js`/`*.hook.js` files are still the
  documented empty stub, correctly.

**Do not assume a finished-looking page proves its backend integration works** — check
whether the specific hook behind it still imports from `utils/mockData.js` before relying
on it.

### Both

`.env` files hold real Supabase and OpenAI credentials for this project (not placeholders) —
see `server/.env`/`server/.env.example` for the current variable names.

There are no automated tests in this repository yet (`npm test` at the root and in
`server/` is an unset placeholder). Verify changes with the smoke test in `SCAFFOLD.md` §15
(health check, a 404 envelope from an unimplemented route, client dev server, client build)
until real tests exist.

---

## 1. What this is

A web app where a user uploads or records a meeting (audio/video), the app transcribes it,
and an LLM produces a scannable summary: bullet points, action items (task + owner +
deadline), speaker attribution, and topic tags (Decisions / Questions / Blockers).

Goal: replace "re-watch the 90-minute recording" with "read 12 bullets".

Built for a Neo Culture Tech (NCT) club project. Final deadline **23:59 Wed 17 Sep 2026**.
See `DELIVERABLES.md` for everything that must be handed in.

---

## 2. Stack

Two independently deployable applications in one repository: `client/` and `server/`.
The architectural style is fixed by the team — see `ARCHITECTURE.md`, which is the
authority. This table is the concrete technology mapping.

| Layer | Choice | Notes |
| --- | --- | --- |
| Language | **JavaScript (ESM), Node 20+** | Matches the team's existing convention (`index.jsx`, `*.hook.js`, `*.service.js`). The brief allows JS or TS. Zod covers the validation that types would otherwise catch. |
| Frontend | **React 19 + Vite + React Router** | Static SPA build. Not Next.js — the backend is a separate long-running service. |
| Frontend state | **Zustand** for global stores | One store per cross-cutting concern (auth, socket, ui). |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`) utility classes, driven by design tokens defined in `client/src/index.css` | Token source of truth is `.claude/DESIGN.md` ("Serene Protocol" system); rationale/history in `.claude/TASTE.md`. Some component packages still carry an unused co-located `ComponentName.css` left from the pre-Tailwind scaffold — don't assume one is wired in just because it exists. |
| Backend | **Express 5 + Socket.IO**, one process | HTTP and WebSocket bootstrapped from the same entry point. |
| Validation | **Zod**, in each module's `*.validator.js` | Inbound boundary of every module. |
| DB | **Supabase Postgres** | Brief requirement. Accessed through `supabase-js` (service role) inside repositories only. |
| Auth | **Supabase Auth** | Brief requirement. The server verifies the Supabase JWT; it does not issue its own. |
| File storage | **Supabase Storage**, private bucket | Brief requirement. Browser uploads via signed URL. |
| Transcription | **OpenAI — `whisper-1`** | Brief requirement. |
| Summarization | **OpenAI — `gpt-4o-mini`** | Brief requirement. |
| Deploy | `client/` → static host (Vercel/Netlify); `server/` → long-running Node host (Render/Railway/Fly) | The brief requires a live link evaluators can use. |

> **Why not serverless.** A serverless host breaks WebSocket and kills long transcription
> jobs, and has no ffmpeg. `ARCHITECTURE.md` §0 records this decision.

---

## 3. Doc map

| File | Read it when |
| --- | --- |
| `ARCHITECTURE.md` | **Read first, before any code.** Module boundaries, N-Tier rules, protocol split, the pipeline, deployment. It is the authority; if another doc contradicts it, this one wins. |
| `MODELS.md` | You touch the database, write SQL, or add a migration. |
| `ENDPOINTS.md` | You add or call a REST route or a WebSocket event. This is the contract. |
| `AI_INTEGRATION.md` | You touch OpenAI, ffmpeg, prompts, JSON parsing, or speaker attribution. |
| `FRONTEND.md` | You add a page, a component package, a store, or a hook. |
| `SETUP.md` | Env vars, local setup, Supabase setup, deploying either app. |
| `DELIVERABLES.md` | Anything about submission: README, Gantt, Trello, demo video, weekly reports. |
| `LESSONS_FROM_TUTORBOT.md` | **Read once before writing any code.** Concrete mistakes from the predecessor project that must not be repeated. |

Two more files, outside `docs/` but load-bearing for frontend work: `.claude/DESIGN.md`
(concrete design tokens — colors, type scale, spacing) and `.claude/TASTE.md` (the standing
visual-style preference behind those tokens, "Serene Protocol"). Read both before adding or
restyling any client UI.

---

## 4. Non-negotiable rules

**Architecture**

1. **Layer direction is one-way:** `Route/Socket → Controller → Service → Repository/Interface → Model`.
   Routes never touch models. Services never bypass repositories.
2. **No cross-module internals.** A module imports another module only via its
   `*.interface.js` or the event bus. Importing `summary.service.js` from `transcript/` is
   a boundary violation.
3. **Validators run before controllers; DTOs run before data leaves the service.**
   No raw repository row ever reaches a client.
4. **Only `errorHandler.js` formats a failure response.** Controllers throw `AppError`;
   they never call `res.status(...).json(...)` for errors.
5. **Every repository method takes `userId` and scopes its query on it.** The server holds
   the service-role key, so RLS does not protect us — the repository layer does.
6. **One component = one package**, exposed only through its `index.jsx`.

**Project**

7. **No hardcoded URLs or keys.** Backend paths live in `client/src/config/endpoints.js`;
   everything environmental goes through `config/env.js` on each side.
8. **Secrets are server-only.** `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` exist only in `server/`. Anything in
   `client/` is public by definition.
9. **The browser uploads directly to Supabase Storage** via a signed URL. Media bytes never
   pass through the API.
10. **Every schema change is a migration file** in `server/supabase/migrations/`.
11. **If you change an endpoint or a socket event, update `ENDPOINTS.md` in the same commit.**
    Stale docs were the single biggest failure of the predecessor project.
12. **Code comments and commit messages in English.**

---

## 5. Scope discipline

The brief's Core list is the definition of done. Ship all of it before anything else.

**Core (required):** sign in/up · upload audio **or video** · record in-browser ·
transcription progress · full transcript · bullet-point summary · action item extraction
(task/owner/deadline) · speaker attribution · topic tagging · export Markdown **and** PDF ·
searchable history by keyword **and** date.

**Additional (stretch):** live summarization during an ongoing meeting. The architecture
supports it (`LiveSession` + the `/rt` namespace), but it is a real feature, not a flag.
Do not start it until Core is deployed and working.

**Out of scope:** chat with the AI, tutoring flows, class/course grouping, calendars,
notebooks. The predecessor project had these; they are not in this brief.

---

## 6. Commands

```bash
# repo root — runs both dev servers together via concurrently
npm install
npm run dev             # = npm run dev:server + npm run dev:client, in parallel

# server/
npm install
npm run dev              # nodemon, http://localhost:4000 (HTTP + WebSocket)
npm run lint              # eslint .
npx supabase db push      # apply migrations in server/supabase/migrations/

# client/
npm install
npm run dev               # vite, http://localhost:5173
npm run build
npm run preview
npm run lint               # oxlint
```

No test runner is configured yet on any package — `npm test` is an unset placeholder
everywhere. Until real tests exist, verify with the `SCAFFOLD.md` §15 smoke test
(`GET /api/health`, a 404 envelope from a not-yet-wired route, `client` dev server render,
`client` build).

Before any commit: lint passes on both sides and `client/` builds.
