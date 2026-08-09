---
type: brainstorm
date: 2026-08-09
status: agreed (revised 2026-08-09 evening)
next: /ck:plan
revisions:
  - 2026-08-09 evening — Auth changed from Supabase Auth to custom JWT per group-chat consensus. See §10.
---

# Brainstorm — Meeting Summarizer scope + AI stack decisions

Pre-plan alignment on what changes vs the existing `docs/` and why. All decisions below are agreed with the user; the plan phase implements them.

---

## 1. Problem

Build the NCT Meeting Summarizer per `DELIVERABLES.md`. User uploads a meeting → app produces scannable meeting minutes (bullets, action items, speakers, topic tags) → user downloads as MD/PDF/(DOCX later). Deadline **2026-09-17 23:59**.

Existing `docs/` describe the full architecture but assume **Groq (Whisper + Llama)**, **audio/video-only input**, **JSON LLM output**, and **MD+PDF exports**. User wants deviations from that. This report locks the deviations.

---

## 2. Deviations from current docs — agreed

| Concern | Docs today | Agreed change | Why |
|---|---|---|---|
| **Summary LLM (prod)** | Groq `llama-3.3-70b-versatile` | **OpenAI `gpt-5.6-luna` via Responses API** | User has OpenAI credit. Summarization is structured extraction → cheapest 5.6 tier is enough. Escalate to `gpt-5.6-terra` only if quality falls short on Vietnamese meetings. |
| **Summary LLM (dev)** | `MOCK_AI=true` fixture stub | **`gpt-oss-20b` via Ollama** (OpenAI-compatible endpoint at `http://localhost:11434/v1`) | Free, offline, real model behaviour (not stub). Only base-URL + model-name differ vs prod → one code path. Fixture stub kept as fallback for demo-day rate limits. |
| **Transcription (STT)** | Groq `whisper-large-v3` + LLM-inferred speakers | **OpenAI `gpt-4o-transcribe-diarize`** (`response_format: "diarized_json"`, `chunking_strategy: "auto"`) | Returns **real** speaker-labelled turns. Removes the "we're guessing speakers" hedge in `AI_INTEGRATION.md` §4 and delivers the brief's speaker-attribution feature honestly. Same vendor as summary → one SDK, one key, one billing surface. |
| **LLM output format** | JSON with defensive parse-retry | **JSON via OpenAI Structured Outputs (schema-locked)** | Schema-guaranteed at API layer → no fence-stripping, no outermost-`{}` fallback, no retry logic. Zod validates the resulting object as belt-and-braces. Considered XML (user's original idea) — rejected: no schema enforcement, ~3× tokens, still parse back to JS for renderers. |
| **Persisted structured output** | Store raw JSON in `summaries.raw_response jsonb` | **One JSON per summary, stored in `summaries.raw_response jsonb`. Re-download NEVER re-calls the LLM.** See §3.6. | User's re-download intuition matches the docs. jsonb keeps it queryable. MD/PDF/DOCX are rendered *views* of this JSON, never a storage format. |
| **Upload input types** | Audio/video only | **Audio/video OR text (.srt/.vtt)** | Zoom/Teams export as VTT. Text path skips the whole transcription stage → cheaper for the user, faster path to summary. Small SRT/VTT parser in `transcript` module. |
| **Export formats** | MD + PDF | **MD + PDF for Core; DOCX only if Stage 6 finishes early** | Brief requires MD+PDF. DOCX = extra `docx` npm dep, table styling, font handling — not worth risking Core for. |
| **Live-summarization (stretch)** | Full `LiveSession` + `/rt` namespace + sweeper documented | **Deferred to post-submission "future phase"** | Kept in the architecture on paper. No code, no tables, no socket namespace during Core. Revisit only if evaluator feedback demands it. |

---

## 3. Downstream consequences of these deviations

### 3.1 Files that need doc updates before implementation

- `docs/CLAUDE.md` — stack table §2 (Groq → OpenAI rows; Whisper model)
- `docs/system.doc/AI_INTEGRATION.md` — full rewrite of §1-6: models, ffmpeg pipeline, diarize response shape, Responses API + Structured Outputs, prompts, failure modes
- `docs/system.doc/SETUP.md` — env var table §3 (`OPENAI_API_KEY`, `OPENAI_SUMMARY_MODEL`, `OPENAI_TRANSCRIPTION_MODEL`, `OLLAMA_BASE_URL` for dev)
- `docs/server.doc/ENDPOINTS.md` — `POST /:id/upload` MIME allowlist §7 gains `text/plain`, `text/vtt`, `application/x-subrip`
- `docs/server.doc/MODELS.md` — reconsider `speakers` table: diarize gives speaker turns upfront, so `speakers` rows are populated from the transcription step, not inferred by the summary. Keep the table + rename UI unchanged; only the write path shifts from `summary` module to `transcript` module.
- `docs/submission.doc/DELIVERABLES.md` — Stage table §5: mark live-session as post-submission, DOCX as time-permitting.

The `docs-manager` agent handles this during Phase 1 of the plan.

### 3.2 Architecture — mostly untouched

The **module boundaries, N-tier layering, event bus, response envelope, per-repo `userId` scoping, Supabase Auth/Postgres/Storage, and package-based frontend components all stay identical**. Only the AI-layer implementation details change. That's the whole point of putting the SDK in `config/*` — swap `groq.js` for `openai.js`, and no service method signature changes.

### 3.3 State machine — one small tweak

Text-upload path skips transcription. Two options:

- **A. Same states, `transcribing` is a fast parser step for text uploads** — `draft → uploaded → transcribing (parse SRT/VTT) → transcribed → summarizing → completed`. Consistent UX; stepper always shows the same steps.
- **B. Branch at `uploaded`** — text uploads jump straight to `summarizing`. Fewer states run but the frontend stepper needs conditional rendering.

**Recommendation: A.** Simpler code, uniform UX, `transcribing` for text just takes ~50 ms.

### 3.4 WebSocket vs polling for pipeline progress

With live-session deferred, WebSocket's *only* remaining job is pipeline progress. That's the one feature it was added for beyond live-session. Two options:

- **Keep Socket.IO for progress + polling fallback** (as docs say). More code, better UX (instant progress vs 3 s poll), but adds deploy complexity (free hosts sometimes throttle WebSocket).
- **Polling-only** — `GET /:id/status` every 3 s during processing. Simpler, deploys anywhere.

**Recommendation:** Defer to plan phase. Lean **polling-only for MVP**, add Socket.IO in a later phase if UX demands it — YAGNI. If added later, the `/rt` namespace is already scaffolded.

### 3.6 Storage of the LLM output — locked contract

- **One JSON per summary.** `summaries` is one-to-one with `meetings`. Written once at pipeline completion, replaced wholesale on explicit resummarize.
- **Stored in `summaries.raw_response jsonb`.** Untouched OpenAI Structured-Outputs response.
- **On top of that**, normalized rows are extracted at write time into `summary_points`, `speakers`, `action_items` — these are what the app queries and mutates.

**When the LLM runs:**
| Action | Calls LLM? |
|---|---|
| First-time summarization after upload | Yes (once) |
| User clicks Retry after a `failed` pipeline | Yes (from the earliest incomplete stage) |
| User clicks "Resummarize" (e.g. after renaming speakers) | Yes (summary stage only; transcript reused) |
| **User downloads MD / PDF / DOCX** | **No — read JSON from DB → render → serve** |
| User re-opens the meeting detail page | No — reads normalized rows |
| User ticks an action item, edits a bullet, renames a speaker | No — direct field mutation on normalized rows |

MD/PDF/DOCX renderers ingest the normalized rows (or `raw_response`, either works) and produce their format on-demand. No renderer ever calls OpenAI.

### 3.7 Auth surface

No change from docs — Supabase Auth. Server verifies JWT via `middleware/authenticate.js`, no `/api/auth/*` routes. Confirmed with user by silence (they didn't push back on Supabase).

---

## 4. Final tech stack (agreed)

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite + React Router + Zustand |
| Backend | Node 20 + Express 5 (Socket.IO decision deferred to plan) |
| Validation | Zod (both sides) |
| DB / Auth / Storage | Supabase (Postgres + Auth + private bucket) |
| **Transcription (prod)** | **OpenAI `gpt-4o-transcribe-diarize`** |
| **Summary (prod)** | **OpenAI `gpt-5.6-luna` via Responses API + Structured Outputs** |
| **Summary (dev)** | **`gpt-oss-20b` served by Ollama** (OpenAI-compatible) |
| Preprocessing | ffmpeg (server-side, extract audio + normalize to 16 kHz mono FLAC) |
| Text input parsing | small SRT/VTT parser (in-tree, no dep needed) |
| Exports | Markdown (in-tree) + PDF (`pdfkit` or `puppeteer`, decide in plan) + DOCX (later, `docx` lib) |
| Deploy | Client → Vercel/Netlify; Server → Render/Railway (long-running, ffmpeg present) |

---

## 5. Non-negotiables carried over from docs

All 12 rules in `CLAUDE.md` §4 stand. Highlights:
- One-way N-tier: `Route/Socket → Controller → Service → Repository/Interface → Model`
- Cross-module talk only via `*.interface.js` or event bus
- Every repo method takes+scopes on `userId`
- Only `errorHandler.js` formats failures
- Browser uploads directly to Supabase Storage via signed URL
- One migration per schema change
- `OPENAI_API_KEY` server-only (mirror the `GROQ_API_KEY` rule)
- Endpoint change + `ENDPOINTS.md` edit = same commit

---

## 6. Risks + mitigations

| Risk | Mitigation |
|---|---|
| `gpt-4o-transcribe-diarize` accuracy on Vietnamese cross-talk | Ship the `SpeakerLegend` rename UI regardless (docs §4B). Users correct wrong labels. |
| OpenAI rate-limits mid-demo | Fixture stub (`OPENAI_MOCK=true`) keeps summary path testable offline. Wake server before demo (docs `SETUP.md` §6). |
| `gpt-5.6-luna` quality insufficient for Vietnamese meetings | Config-driven model name → one-line escalation to `terra`. Test on 2-3 real Vietnamese samples early (Stage 4). |
| Ollama footprint + dev-machine RAM | `gpt-oss-20b` fits ~16 GB RAM comfortably. If a teammate's machine can't run it, they use the fixture stub. Not a blocker. |
| PDF Vietnamese diacritics | Embed Be Vietnam Pro or Noto Sans. Verify on real PDF before calling Stage 5 done (docs `ENDPOINTS.md` §6). |
| Free-tier server sleep (30-60 s cold start) | Ping `/api/health` on a schedule. Wake before demo. |

---

## 7. Success criteria (definition of done for this app)

- All 12 Core checkboxes in `DELIVERABLES.md` §4 tick, verified on the deployed URL (not just localhost)
- Signed-in user A cannot see user B's meetings (per-repo `userId` scoping enforced)
- A 30-minute Vietnamese video produces a correctly-timestamped, speaker-labelled summary
- Re-downloading MD or PDF for an old meeting does **not** call OpenAI (reads `raw_response` from DB)
- Deploy checklist in `docs/system.doc/SETUP.md` §7 passes clean

---

## 8. Open decisions (defer to plan phase, not blocking this brainstorm)

- WebSocket-for-progress vs polling-only (see §3.4)
- PDF renderer: `pdfkit` (fast, no headless browser) vs `puppeteer` (better fidelity, heavier)
- Whether to add a `type` column on `meetings` (`file` vs `text`) or infer from `mime_type`
- Explicit user-facing UI copy for "speaker attribution (inferred vs diarized)" — mostly moot now that we're using diarize

---

## 9. Next step

Proceed to `/ck:plan` with this report as context. The plan should produce phase files that:

1. Update `docs/` to reflect §2 deviations (Phase 1)
2. Land the OpenAI + Ollama config swap (Phase 2)
3. Implement the audio/video → diarize → summary pipeline (Phase 3-4)
4. Add the text-upload branch (Phase 4)
5. Wire MD + PDF exports (Phase 5)
6. Deploy + polish + submission artifacts (Phase 6)
7. Post-submission: live-session, DOCX (Phase 7, unstarted)

---

## 10. Post-brainstorm revision — Auth (2026-08-09 evening)

**Team consensus in group chat:** switch from **Supabase Auth** to **custom JWT auth** on our own tables.

### Change
| Aspect | Previous | Revised |
|---|---|---|
| Auth provider | Supabase Auth (email + Google) | Custom — own endpoints, own JWTs, own DB tables |
| DB tables | `profiles` populated by trigger on `auth.users` | `users` (email, password_hash, name, role, avatar_url) + `refresh_tokens` (token, user_id, expires_at, revoked_at) — NO `profiles`, NO `auth.users` dependency |
| Access token | Supabase-issued, verified via `SUPABASE_JWT_SECRET` | Own JWT signed with `JWT_ACCESS_SECRET`. Payload: `{ id, email, name, role, expireAt }` per Tâm's DoD |
| Refresh token | n/a (Supabase handles) | Own JWT signed with `JWT_REFRESH_SECRET`, stored in `refresh_tokens` table to support revocation |
| Password hashing | n/a (Supabase) | `bcrypt` (12 rounds default) |
| Auth endpoints | none on our server | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me` |
| Client SDK | `@supabase/supabase-js` (auth methods) | own `auth.store.js` calling our endpoints; drop Supabase SDK from `client/` |
| DB RLS | Supabase `auth.uid()` policy per table | Drop RLS — becomes useless without Supabase Auth's `auth.uid()`. Server-side repo scoping remains the sole authorization boundary (was always the primary boundary per `MODELS.md` §3 anyway) |

### What stays the same
- **Supabase Postgres** — still the DB
- **Supabase Storage** — still the bucket. Server uses service-role key (which never needed Supabase Auth to work) to issue signed URLs. Client PUTs directly to Storage via signed URL.
- No new upstream vendors added — just moved auth responsibility from Supabase into our own code

### Rationale
- Team wants to own the auth flow end-to-end (learning + control)
- No Google OAuth needed for MVP — email + password is enough
- Supabase Auth added a whole layer of "how does Supabase's redirect work with our /auth/callback" complexity the team preferred to skip

### New risks
- **Password security is now our problem.** `bcrypt` with ≥12 rounds. Rate-limit login endpoint. No password reset flow in MVP (deferred; note in README).
- **JWT secrets in `server/.env`.** Two of them (access + refresh). Never in client. Never in git.
- **Token revocation.** Only refresh tokens are revocable via the DB table. Access token compromise = wait out the 15-min TTL. Acceptable.
- **`LESSONS_FROM_TUTORBOT.md` §2 called out "Custom JWT auth, bcrypt, and hand-wired Google OAuth — Supabase Auth replaces all of it"** as a *reason to drop the predecessor's pattern.* We are consciously going back to that pattern. Accept the risk: club project, ~5 weeks, small user base.

### Plan-level impact
- `phase-01-docs-alignment.md` — additional doc edits for auth surface (CLAUDE.md, ARCHITECTURE.md, SETUP.md, ENDPOINTS.md, MODELS.md)
- `phase-03-auth-and-meeting-crud.md` — full rewrite of auth portion: new tables, new module, new middleware, new client store
- No changes to phases 2, 4-9
