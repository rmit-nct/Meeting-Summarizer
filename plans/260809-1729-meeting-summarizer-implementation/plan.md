---
status: pending
created: 2026-08-09
deadline: 2026-09-17
slug: meeting-summarizer-implementation
brainstorm: ../reports/brainstorm-260809-1729-meeting-summarizer-scope-and-stack.md
---

# NCT Meeting Summarizer — Implementation Plan

Fill the scaffolded codebase into a working, deployed meeting summarizer per `docs/submission.doc/DELIVERABLES.md` by **2026-09-17 23:59**. Follows the locked decisions in the brainstorm — do not re-litigate.

## Locked decisions (from brainstorm §2 + §10 revision)

- **Summary LLM (prod):** OpenAI `gpt-5.6-luna` via Responses API + Structured Outputs
- **Summary LLM (dev):** `gpt-oss-20b` served by Ollama at `http://localhost:11434/v1`
- **Transcription:** OpenAI `gpt-4o-transcribe-diarize` — real speaker diarization
- **LLM output:** JSON via Structured Outputs. Stored once per summary in `summaries.raw_response jsonb`. Re-download never re-calls OpenAI.
- **Inputs:** audio/video (→ diarize) AND `.srt`/`.vtt` text upload (skips transcription)
- **Exports:** MD + PDF for Core. DOCX only if time.
- **Live-session:** deferred to post-submission.
- **Progress transport:** polling-only (`GET /:id/status` every 3 s) for MVP. Socket.IO deferred with live-session.
- **PDF renderer:** `pdfkit` — no headless-browser dep, faster cold-start on Render free tier, full control over Vietnamese font embedding.
- **`meetings` schema:** no `type` column — infer text-vs-media from `mime_type`. Existing check-constraint already handles the `draft`/`storage_path` invariant.
- **Auth (REVISED 2026-08-09 evening):** custom JWT — own endpoints (`/api/auth/register`, `/login`, `/refresh`, `/logout`, `/me`), own `users` + `refresh_tokens` tables, `bcrypt` password hashing. Access token payload = `{ id, email, name, role, expireAt }` per Tâm's DoD. Supabase Auth **dropped**; Supabase kept for Postgres + Storage only. RLS dropped (no `auth.uid()`); server-side repo scoping is the sole authorization boundary. See brainstorm §10.

## Phases

| # | File | Focus | Depends on | Est |
|---|---|---|---|---|
| 1 | [phase-01-docs-alignment.md](phase-01-docs-alignment.md) | Update `docs/` to match brainstorm deviations (OpenAI, diarize, text input, no live-session) | — | 1-2 d |
| 2 | [phase-02-ai-config-swap.md](phase-02-ai-config-swap.md) | Server `config/openai.js` (prod) + Ollama base-URL override (dev). Env vars. Fixture stub. | 1 | 1 d |
| 3 | [phase-03-auth-and-meeting-crud.md](phase-03-auth-and-meeting-crud.md) | Supabase Auth wire-up, `authenticate.js`, `user` + `meeting` modules, draft create, signed-URL upload, client auth pages + `NewMeeting`/`MeetingDetail`(draft view) | 2 | 4 d |
| 4 | [phase-04-transcription-pipeline.md](phase-04-transcription-pipeline.md) | `POST /:id/process`, ffmpeg preprocessing, `gpt-4o-transcribe-diarize`, persist `transcripts` + `speakers` from diarize turns, `meeting:progress` via polling | 3 | 4 d |
| 5 | [phase-05-summarization-and-text-branch.md](phase-05-summarization-and-text-branch.md) | `summary` module: prompt + Structured Outputs + normalize. Text-upload branch (`.srt`/`.vtt` parser, skips transcribe). `action-item` seeding via event bus. | 4 | 5 d |
| 6 | [phase-06-detail-page-and-mutations.md](phase-06-detail-page-and-mutations.md) | `overview` aggregator, `GET /:id`, `MeetingDetail` (all 4 status views), `SummaryView`/`TranscriptView`/`ActionItemList`/`SpeakerLegend`, action-item CRUD, speaker rename, history search + date filter | 5 | 5 d |
| 7 | [phase-07-exports-md-and-pdf.md](phase-07-exports-md-and-pdf.md) | `export` module: MD renderer + PDF renderer (pdfkit + Be Vietnam Pro font). `ExportMenu`. Re-download reads `summaries.raw_response`, no LLM call. | 5 | 4 d |
| 8 | [phase-08-deploy-and-submission.md](phase-08-deploy-and-submission.md) | Deploy client (Vercel/Netlify) + server (Render/Railway with ffmpeg). CORS + Supabase URLs. README, demo video, Trello, Gantt. Security checklist. | 6, 7 | 7 d |
| 9 | [phase-09-post-submission-parking.md](phase-09-post-submission-parking.md) | Live-session (`/rt` namespace, sweeper) + DOCX export. **Unstarted.** | 8 | — |

## Critical files that don't yet exist and must

Beyond the scaffolded stubs — items the docs describe but SCAFFOLD.md doesn't create:
- `server/supabase/migrations/*.sql` — all 8 tables + RLS + `search_meetings` RPC (Phase 3)
- `server/fixtures/*.json` — one transcript + one summary for `OPENAI_MOCK=true` (Phase 2)
- `client/src/utils/http.js` — the "one 401 handler" (Phase 3, service already stubbed)

## Definition of done (top-level)

All 12 Core checkboxes in `docs/submission.doc/DELIVERABLES.md` §4 tick, verified on the deployed URL. Signed-in user A cannot see user B's meetings. A 30-min Vietnamese video produces a correctly-timestamped, speaker-labelled summary. Re-download for an old meeting does not call OpenAI. Security checklist in `docs/system.doc/SETUP.md` §7 passes.
