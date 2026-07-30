# CLAUDE.md

Guidance for Claude Code when working in the **NCT Meeting Summarizer** repository.
Read this file first. It is the index; the detail lives in the linked docs.

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
| Styling | **Co-located CSS per component package** (`ComponentName.css`) + `client/src/styles/tokens.css` | Follows the package-based componentization rule. No competing component library. |
| Backend | **Express 5 + Socket.IO**, one process | HTTP and WebSocket bootstrapped from the same entry point. |
| Validation | **Zod**, in each module's `*.validator.js` | Inbound boundary of every module. |
| DB | **Supabase Postgres** | Brief requirement. Accessed through `supabase-js` (service role) inside repositories only. |
| Auth | **Supabase Auth** | Brief requirement. The server verifies the Supabase JWT; it does not issue its own. |
| File storage | **Supabase Storage**, private bucket | Brief requirement. Browser uploads via signed URL. |
| Transcription | **Groq — `whisper-large-v3`** | Brief requirement. |
| Summarization | **Groq — `llama-3.3-70b-versatile`** | Brief requirement. |
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
| `AI_INTEGRATION.md` | You touch Groq, ffmpeg, prompts, JSON parsing, or speaker attribution. |
| `FRONTEND.md` | You add a page, a component package, a store, or a hook. |
| `SETUP.md` | Env vars, local setup, Supabase setup, deploying either app. |
| `DELIVERABLES.md` | Anything about submission: README, Gantt, Trello, demo video, weekly reports. |
| `LESSONS_FROM_TUTORBOT.md` | **Read once before writing any code.** Concrete mistakes from the predecessor project that must not be repeated. |

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
8. **Secrets are server-only.** `GROQ_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` exist only
   in `server/`. Anything in `client/` is public by definition.
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
# server/
npm install
npm run dev            # nodemon, http://localhost:4000 (HTTP + WebSocket)
npm run lint
npx supabase db push   # apply migrations

# client/
npm install
npm run dev            # vite, http://localhost:5173
npm run build
npm run preview
npm run lint
```

Before any commit: lint passes on both sides and `client/` builds.
