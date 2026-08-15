# Phase 1 — Docs alignment

## Context Links
- Brainstorm §2, §3.1: [../reports/brainstorm-260809-1729-meeting-summarizer-scope-and-stack.md](../reports/brainstorm-260809-1729-meeting-summarizer-scope-and-stack.md)
- All files under `docs/`

## Overview
- **Priority:** Blocker (every later phase reads these docs)
- **Status:** pending
- **Description:** Update the 8 doc files to reflect OpenAI/diarize/text-input/no-live/**custom-auth** decisions **before any code changes**. Prevents stale-docs bug called out in `LESSONS_FROM_TUTORBOT.md` §2.

## Key Insights
- Docs today assume Groq (Whisper + Llama), audio/video-only, LLM-inferred speakers, full live-session, **Supabase Auth**
- All 12 rules in `CLAUDE.md` §4 stand — only concrete AI tech + input types + live-session scope + auth provider change
- Docs are the contract. `LESSONS_FROM_TUTORBOT.md` §2 records why doc-code drift kills projects
- **Auth revision:** Supabase Auth dropped per group-chat consensus (brainstorm §10). Custom JWT + `users` + `refresh_tokens` tables + bcrypt. Supabase kept for Postgres + Storage only.

## Requirements
- **Functional:** docs describe what will actually be built
- **Non-functional:** no doc contradicts another; grep for `groq` remnants is clean

## Architecture
No code changes. Delegate to `docs-manager` agent.

## Related Code Files
Edit:
- `docs/CLAUDE.md`
- `docs/system.doc/AI_INTEGRATION.md`
- `docs/system.doc/SETUP.md`
- `docs/system.doc/SCAFFOLD.md`
- `docs/server.doc/ENDPOINTS.md`
- `docs/server.doc/MODELS.md`
- `docs/submission.doc/DELIVERABLES.md`

No changes:
- `docs/system.doc/ARCHITECTURE.md` — architecture unchanged; only ffmpeg-first note in §2.4 already fits
- `docs/system.doc/LESSONS_FROM_TUTORBOT.md`
- `docs/client.doc/FRONTEND.md`

## Implementation Steps

1. **`docs/CLAUDE.md` §2** — replace Groq rows in stack table:
   - Transcription → `OpenAI gpt-4o-transcribe-diarize` (real diarization, no diarize hedge needed)
   - Summarization → `OpenAI gpt-5.6-luna` via Responses API + Structured Outputs
   - Add note: dev mode swaps in `gpt-oss-20b` via Ollama at `http://localhost:11434/v1`

2. **`docs/system.doc/AI_INTEGRATION.md`** — full rewrite:
   - §1 Models: table with prod (`gpt-5.6-luna`, `gpt-4o-transcribe-diarize`) + dev (`gpt-oss-20b` via Ollama, OpenAI-compatible so same SDK call path)
   - §2 Preprocessing: ffmpeg step unchanged; diarize call shape (`response_format: 'diarized_json'`, `chunking_strategy: 'auto'` for >30 s)
   - §3 Summarization: Responses API + Structured Outputs (schema-locked) replaces JSON-mode + defensive parse; Zod validates the returned object as belt-and-braces
   - §4 Speaker attribution: **delete "we infer speakers via LLM"** — diarize returns speakers upfront. Keep `SpeakerLegend` rename UI as user-correction affordance. Note: `speakers` rows now written by the `transcript` module (from diarize turns), not `summary`
   - §5 Prompts: `PROMPT_VERSION` unchanged in spirit; prompt content changes because input now includes real speaker turns
   - §6 Failure handling: add `diarize_failed`, `structured_output_violation` codes
   - §7 Mock: `OPENAI_MOCK=true` swaps client for fixture stub

3. **`docs/system.doc/SETUP.md` §3** — env var tables:
   - Server: drop `GROQ_*` rows. Add `OPENAI_API_KEY`, `OPENAI_SUMMARY_MODEL` (default `gpt-5.6-luna`), `OPENAI_TRANSCRIPTION_MODEL` (default `gpt-4o-transcribe-diarize`), `OPENAI_BASE_URL` (default `https://api.openai.com/v1`, override to `http://localhost:11434/v1` for Ollama), `OPENAI_MOCK` (default false)
   - Prerequisites §1: add "OpenAI API key **OR** local Ollama with `gpt-oss-20b` pulled"
   - §7 security checklist: replace `grep -rn "gsk_\|eyJ"` with `grep -rn "sk-\|eyJ"`

4. **`docs/system.doc/SCAFFOLD.md` §5** — `.env.example` block: replace `GROQ_*` lines with `OPENAI_*` equivalents. `env.js` Zod schema updated accordingly.

5. **`docs/server.doc/ENDPOINTS.md`**:
   - §7 MIME allowlist: add `text/plain`, `text/vtt`, `application/x-subrip`
   - §2 upload validator: accepts `sourceType: 'text'` in addition to `upload`/`recording`
   - §8 WebSocket: **mark deferred**. Add note: MVP uses polling `GET /:id/status` every 3 s during processing. `/rt` namespace ships with live-session (post-submission)

6. **`docs/server.doc/MODELS.md` §2** — `speakers` table: clarify write ownership shifts to `transcript` module (from `summary`) since diarize returns them. Schema unchanged.

7. **`docs/submission.doc/DELIVERABLES.md` §5** — stage table: live-session + DOCX marked "post-submission if time". Stage 3 exit criterion: "a 30-min Vietnamese **video** produces a correctly-timestamped, **speaker-labelled** transcript" (diarize delivers speakers at this stage, not stage 4).

8. **Custom-auth doc edits (per brainstorm §10 revision):**
   - **`docs/CLAUDE.md` §2** — Auth row: change from `Supabase Auth` to `Custom JWT + bcrypt (own /api/auth/* endpoints, own users + refresh_tokens tables)`
   - **`docs/system.doc/ARCHITECTURE.md` §2.2** — `auth` module: no longer "delegates to Supabase Auth"; now owns `users`, `refresh_tokens`. Owns password hashing, JWT signing/verify, refresh flow.
   - **`docs/system.doc/SETUP.md` §3** — server env table: drop `SUPABASE_JWT_SECRET`. Add `JWT_ACCESS_SECRET` (required), `JWT_REFRESH_SECRET` (required), `ACCESS_TOKEN_TTL_MIN` (default 15), `REFRESH_TOKEN_TTL_DAYS` (default 7), `BCRYPT_ROUNDS` (default 12).
   - **`docs/system.doc/SETUP.md` §3** — client env table: drop `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (client no longer talks to Supabase directly)
   - **`docs/system.doc/SETUP.md` §4** — Supabase project setup: drop the "enable Email/Google providers" step. Redirect URL config no longer needed. Just: create the project, run migrations, create the Storage bucket.
   - **`docs/system.doc/SETUP.md` §7** — security checklist: drop the `SUPABASE_JWT_SECRET` line; add "no `JWT_*_SECRET` in `client/`", "bcrypt rounds ≥ 12", "login endpoint rate-limited"
   - **`docs/server.doc/ENDPOINTS.md` §0** — auth section: replace "sign-in/sign-up happen client-side against Supabase Auth; server only verifies" with our real flow (register/login → server issues tokens; refresh via `/refresh`; access token verified by `authenticate.js`)
   - **`docs/server.doc/ENDPOINTS.md`** — add new §1.5 for `/api/auth/*` routes: `register`, `login`, `refresh`, `logout`, `me`. Rate-limited.
   - **`docs/server.doc/MODELS.md` §2** — replace `profiles` table with `users` (id, email, password_hash, name, avatar_url, role, created_at, updated_at). Add `refresh_tokens` (id, user_id → users cascade, token_hash, expires_at, revoked_at, created_at). Drop any `auth.users` FK cascades — reference `users(id)` instead.
   - **`docs/server.doc/MODELS.md` §3 (RLS)** — mark as dropped in this project. `auth.uid()` doesn't exist without Supabase Auth. Server-side repo scoping (already the primary boundary per that same section) is the sole authorization boundary now.
   - **`docs/server.doc/MODELS.md` §4 (Storage policies)** — the RLS-style bucket policy (`storage.foldername → auth.uid()`) doesn't work either. Storage is protected because signed URLs are only issued by our server, which verifies the JWT first via `authenticate.js`. The bucket remains private; the client never gets a Storage-native token.
   - **`docs/system.doc/SCAFFOLD.md`** — env example: drop `SUPABASE_JWT_SECRET`, add `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `BCRYPT_ROUNDS`. Update `env.js` Zod schema block accordingly.
   - **`docs/system.doc/LESSONS_FROM_TUTORBOT.md` §3** — the entry "Custom JWT auth, bcrypt, and hand-wired Google OAuth — Supabase Auth replaces all of it" is now **historically wrong** for this project. Add a paragraph noting the group-chat revision consciously reversed this decision. Keep the original text as history — do not delete.

9. **Cleanup:** `grep -ri groq docs/` returns only historical/context references (if any). `grep -ri "whisper-large-v3" docs/` clean. `grep -ri "supabase auth" docs/` returns only §4 Storage-related mentions (which no longer apply either).

## Todo List
- [ ] Update `CLAUDE.md` §2 stack table (AI + Auth rows)
- [ ] Rewrite `AI_INTEGRATION.md` §1–7
- [ ] Update `ARCHITECTURE.md` §2.2 auth module description
- [ ] Update `SETUP.md` §1 prereqs + §3 env tables (BOTH sides) + §4 Supabase setup (drop Auth steps) + §7 checklist
- [ ] Update `SCAFFOLD.md` §5 env example + Zod schema block
- [ ] Update `ENDPOINTS.md` §0 auth section + §1.5 (new) + §2 upload validator + §7 MIME + §8 WebSocket note
- [ ] Update `MODELS.md` §2 (drop `profiles`, add `users` + `refresh_tokens`; speakers ownership note) + §3 (drop RLS) + §4 (Storage rationale change)
- [ ] Update `DELIVERABLES.md` §5 stage table
- [ ] Update `LESSONS_FROM_TUTORBOT.md` §3 with the revision note
- [ ] Grep verification — no Groq/whisper-large-v3/Supabase-Auth leftovers
- [ ] Commit as `docs: align with OpenAI + diarize + text-upload + custom-auth decisions`

## Success Criteria
- Every doc reflects the brainstorm's locked decisions
- Any junior dev reading `docs/` alone can implement Phase 2 without questions
- `grep` verification passes

## Risk Assessment
- **Risk:** doc-code drift starts the moment Phase 2 begins. **Mitigation:** CLAUDE.md §4.11 rule (endpoint change + `ENDPOINTS.md` edit = same commit). Enforce in code review from Phase 3.

## Security Considerations
- Update the SETUP.md §7 grep line so it catches OpenAI-shaped keys (`sk-…`, `sk-proj-…`) not Groq (`gsk_…`)

## Next Steps
- Phase 2 (AI config swap) reads the updated `AI_INTEGRATION.md` + `SETUP.md`
