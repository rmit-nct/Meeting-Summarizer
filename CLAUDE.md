# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Full guidance lives in `docs/CLAUDE.md` — read it first, before writing any code.** It is
the authoritative index for this repo (current scaffold state, non-negotiable architecture
rules, scope discipline, doc map, commands). This root file exists only because Claude Code
looks here first; it does not duplicate that content.

## One-paragraph orientation

NCT Meeting Summarizer: upload/record a meeting → Groq Whisper transcribes it → Groq Llama
summarizes it into bullets, action items, speaker attribution, and topic tags. Two apps,
`client/` (React 19 + Vite) and `server/` (Express 5 + Socket.IO), independently deployable,
coupled only through REST (`/api/*`) and WebSocket (`/rt`). Backend is a Modular Monolith
with strict N-Tier layering per module; frontend is package-based components. Full rationale:
`docs/system.doc/ARCHITECTURE.md`.

## Implementation status

**Backend:** the full upload → transcribe → summarize → persist pipeline is implemented
as application code — `meeting`, `transcript` (Whisper + a Strategy/Factory parser set for
`.vtt`/`.srt`/`.txt`/`.md`), `summary` (Groq Llama, validated JSON normalization),
`action-item`, `overview`, and `processing` all have real controllers/services/
repositories/routes. `auth` verifies a Supabase JWT (verification-only by design, not a
gap). Still scaffold: `user`, `export`, `live-session`. **Not yet runnable end-to-end:**
`server/supabase/migrations/` has no migration for `summaries`/`summary_points`/
`speakers`/`action_items` — that schema/config work belongs to another team member and
merges separately; this pass stayed strictly on the application-code side. See
`docs/CLAUDE.md` §0's "Schema gap, intentional" note before adding a migration yourself.

**Frontend:** every page and component package's `index.jsx` is real, finished UI built
against the `.claude/DESIGN.md`/`.claude/TASTE.md` design system. Wiring to the real API is
now per-component: `MeetingDetail`, `ProcessingStatus` (real socket + polling fallback),
`ActionItemList`, `SpeakerLegend`, `UploadProgress`'s data source (`utils/upload.js`), and
`NewMeeting` are wired. `MeetingHistory` and `auth.store.js` still simulate — and because
`auth.store.js`'s mock session token isn't a real JWT, the socket handshake currently
rejects it, so `ProcessingStatus` runs on its polling fallback until `auth.store.js` is
wired to real Supabase Auth.

See `docs/CLAUDE.md` §0 for the exact per-module/per-component breakdown, and
`docs/server.doc/FROM_MEETING_TO_JSON_PLAN.md` for the pipeline's design rationale, before
assuming a file is empty or a page is backed by real data.

## Commands

```bash
# repo root — both dev servers together
npm install && npm run dev

# server/  (http://localhost:4000, HTTP + WebSocket)
npm install && npm run dev
npm run lint              # eslint .
npx supabase db push      # apply migrations in server/supabase/migrations/

# client/  (http://localhost:5173)
npm install && npm run dev
npm run build
npm run preview
npm run lint               # oxlint
```

No test runner is configured yet (`npm test` is an unset placeholder everywhere). Until real
tests exist, verify with the smoke test in `docs/system.doc/SCAFFOLD.md` §15: `GET
/api/health` returns `{"success":true,...}`, an unimplemented route returns a 404 envelope,
the client dev server renders, and `client` builds cleanly. Lint must pass on both sides and
`client/` must build before any commit.

## Doc map (all under `docs/`)

| File | Read it when |
| --- | --- |
| `CLAUDE.md` | **Start here for everything** — architecture rules, scope, doc map, commands. |
| `system.doc/ARCHITECTURE.md` | Module boundaries, N-Tier rules, protocol split, pipeline, deployment. Authority — wins over any conflicting doc. |
| `server.doc/MODELS.md` | Touching the database, writing SQL, or adding a migration. |
| `server.doc/ENDPOINTS.md` | Adding/calling a REST route or WebSocket event — this is the contract. |
| `system.doc/AI_INTEGRATION.md` | Touching Groq, ffmpeg, prompts, JSON parsing, or speaker attribution. |
| `client.doc/FRONTEND.md` | Adding a page, component package, store, or hook. |
| `system.doc/SETUP.md` | Env vars, local setup, Supabase setup, deploying either app. |
| `submission.doc/DELIVERABLES.md` | Anything about submission: README, Gantt, Trello, demo video, weekly reports. |
| `system.doc/LESSONS_FROM_TUTORBOT.md` | **Read once before writing any code** — concrete mistakes from the predecessor project that must not be repeated. |
| `system.doc/SCAFFOLD.md` | How the current skeleton was generated (reference only — it has already been run). |

## The rules that matter most

These are load-bearing; the full list with rationale is in `docs/CLAUDE.md` §4.

1. Layers are one-way: `Route/Socket → Controller → Service → Repository/Interface → Model`.
2. No cross-module internals — import another module only via its `*.interface.js` or the
   event bus.
3. Every repository method takes `userId` and scopes its query on it (the server holds the
   Supabase secret key, so RLS alone does not protect data).
4. Only `middleware/errorHandler.js` formats a failure response; controllers throw `AppError`.
5. Secrets (`GROQ_API_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWT_SECRET`) exist only in `server/`.
6. Media bytes never pass through the API — the browser uploads directly to Supabase Storage
   via a signed URL.
7. Every schema change is a migration file in `server/supabase/migrations/`.
8. If you change an endpoint or socket event, update `docs/server.doc/ENDPOINTS.md` in the
   same commit — stale docs were the single biggest failure of the predecessor project.
9. One React component = one package, exposed only through its `index.jsx`.
