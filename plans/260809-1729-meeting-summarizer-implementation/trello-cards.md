# Trello backlog — NCT Meeting Summarizer

Cards in dependency order. Pick from top of Backlog whose deps are Done.

**Priority:** P0 blocker · P1 core · P2 polish
**Area:** docs · db · backend · frontend · devops

---

## Phase 1 — Docs

### #01 · Bring docs in line with the plan
**Area:** docs · **Priority:** P0 · **Depends on:** —

Update `docs/` so every file describes the current stack: OpenAI (`gpt-5.6-luna` + `gpt-4o-transcribe-diarize`), Ollama for dev, custom JWT auth on `users` + `refresh_tokens`, text-file input alongside audio/video, polling for progress, no live-session.

**DoD:**
- A junior dev reading `docs/` alone can implement Phase 2 without questions
- `grep -ri groq docs/` clean
- Env-var tables + `ENDPOINTS.md` §1.5 (`/api/auth/*`) accurate

---

## Phase 2 — AI config

### #02 · OpenAI client (prod + Ollama dev)
**Area:** backend · **Priority:** P0 · **Depends on:** #01

Build `server/src/config/openai.js` — one client, `baseURL` from env. Same code path hits OpenAI in prod and Ollama in dev.

**DoD:**
- `import { openai } from '../config/openai.js'` works in both modes
- `OPENAI_BASE_URL=http://localhost:11434/v1` + local Ollama → downstream calls succeed with no code change
- Env schema validates `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_SUMMARY_MODEL`, `OPENAI_TRANSCRIPTION_MODEL`, `OPENAI_MOCK`

### #03 · Fixture stub for OPENAI_MOCK=true
**Area:** backend · **Priority:** P1 · **Depends on:** #02

`server/fixtures/{transcript-sample.json, summary-sample.json, openai-mock.js}`. Stub implements `.audio.transcriptions.create` + `.responses.create` from JSONs.

**DoD:**
- `OPENAI_MOCK=true npm run dev` boots
- Stub returns fixture data with real API shape

---

## Phase 3 — Foundation (auth + meeting CRUD + upload + client shell)

### #04 · DB migrations (all 8 tables)
**Area:** db · **Priority:** P0 · **Depends on:** #01

`server/supabase/migrations/20260810000001_initial_schema.sql` — `users`, `refresh_tokens`, `meetings`, `transcripts`, `summaries`, `summary_points`, `speakers`, `action_items`, `live_sessions` per `MODELS.md`. Every user-owned table has `user_id → users(id)` cascade.

**DoD:**
- `npx supabase db push` applies cleanly
- Cascade works: delete a user → all their meetings gone
- Indexes per `MODELS.md`

### #05 · Private Storage bucket
**Area:** db · **Priority:** P0 · **Depends on:** #04

Private `recordings` bucket. Server issues signed URLs (using service-role key); client never has native access.

**DoD:**
- Bucket exists, private
- Signed URL from server works; raw anon request fails

### #06 · Auth module (register / login / refresh / logout / me)
**Area:** backend · **Priority:** P0 · **Depends on:** #04

Fill `server/src/modules/auth/*`. `bcrypt` password hashing, JWT signing with `JWT_ACCESS_SECRET` (short TTL) + `JWT_REFRESH_SECRET` (long TTL). Refresh tokens hashed in `refresh_tokens` table for revocation. Constant-time login response.

**DoD:**
- 5 endpoints work: `POST /register`, `POST /login`, `POST /refresh`, `POST /logout`, `GET /me`
- Access token payload = `{ id, email, name, role, expireAt }`
- `/refresh` rotates: old refresh token invalidated, new one issued
- `/logout` revokes refresh; subsequent use fails

### #07 · authenticate middleware
**Area:** backend · **Priority:** P0 · **Depends on:** #06

Verify access JWT, set `req.user`. Reject missing/invalid via `unauthorized()` thrown to `errorHandler.js`.

**DoD:**
- All `/api/*` (except `/api/auth/*` + `/api/health`) require valid bearer
- Expired token → `401 token_expired`

### #08 · Rate limit on auth endpoints
**Area:** backend · **Priority:** P1 · **Depends on:** #06

`express-rate-limit` on `/api/auth/login` (5/min per IP) + `/api/auth/register` (10/hour per IP).

**DoD:**
- 6th login attempt in a minute → `429 rate_limited` with `retryAfterMs`

### #09 · User module (GET/PATCH /me)
**Area:** backend · **Priority:** P1 · **Depends on:** #07

Fill `user` module reading/writing `users`. DTO strips `password_hash`.

**DoD:**
- `GET /api/users/me` returns own profile
- `PATCH` updates `name`, `avatar_url` only

### #10 · Meeting module (draft / list / patch / delete)
**Area:** backend · **Priority:** P0 · **Depends on:** #07

`POST /` creates draft (title + optional date, no file). `GET /` paginated list. `PATCH /:id` for editable fields only. `DELETE /:id` cascades + publishes `meeting:deleted`.

**DoD:**
- Draft response: `{ meeting: { status: 'draft', … } }`
- Every repo method takes+applies `userId`
- Two users isolated

### #11 · Signed-URL upload endpoint
**Area:** backend · **Priority:** P0 · **Depends on:** #10

`POST /api/meetings/:id/upload`. MIME allowlist (audio, video, text). Size check. Supabase signed upload URL. Transitions `draft → uploaded`.

**DoD:**
- Valid draft + valid MIME → `{ meeting, upload: { signedUrl, path, token } }`
- Non-draft → `409 invalid_state`
- After client PUT, `meetings.storage_path` populated

### #12 · Client http.js + auth store
**Area:** frontend · **Priority:** P0 · **Depends on:** #06

`utils/http.js` — bearer + `{success,data,meta}` unwrap + typed errors + one automatic refresh attempt on 401 before sign-out. `stores/auth.store.js` — `signIn`, `signUp`, `refresh`, `signOut`, `hydrate` (restores session from `localStorage` refresh token on mount).

**DoD:**
- Browser restart with a valid refresh token restores the session
- Any 401 → tries refresh → if that fails, sign out + redirect `/login`

### #13 · Login + Signup pages + RouteGuard
**Area:** frontend · **Priority:** P0 · **Depends on:** #12

Forms styled per `tokens.css`. `RouteGuard` enforces `public` / `authenticated` tiers.

**DoD:**
- Register → auto-login → land on `/meetings`
- Guest hitting `/meetings` → `/login`
- Signed-in user hitting `/login` → `/meetings`

### #14 · NewMeeting + MeetingHistory (list) + MeetingDetail (draft view)
**Area:** frontend · **Priority:** P0 · **Depends on:** #10, #13

`NewMeeting`: title + date → POST → navigate `/meetings/:id`. `MeetingHistory`: basic paginated list. `MeetingDetail`: renders draft-state view only.

**DoD:**
- Round-trip: create → shows in history → open detail → see draft view

### #15 · Dropzone component
**Area:** frontend · **Priority:** P0 · **Depends on:** #11, #14

Drag-drop + file picker. Client-side MIME + size check. Request signed URL, PUT bytes to Storage via XHR (for progress).

**DoD:**
- File lands at `{userId}/{meetingId}/{filename}`
- Progress bar visible
- After success, meeting `status = 'uploaded'`
- Wrong MIME rejected before hitting API

---

## Phase 4 — Transcription

### #16 · ffmpeg wrapper
**Area:** backend · **Priority:** P0 · **Depends on:** #11

`server/src/modules/transcript/ffmpeg.js` — Promise wrapper around `spawn('ffmpeg', ...)`. 5-min per-invocation timeout. Cleanup in `finally`.

**DoD:**
- Producing 16 kHz mono FLAC from an mp4 works
- Non-zero exit rejects

### #17 · POST /:id/process + GET /:id/status
**Area:** backend · **Priority:** P0 · **Depends on:** #11

Fill `processing` module. `POST /:id/process` asserts `uploaded`, flips → `transcribing`, publishes `meeting:uploaded`, returns 202. `GET /:id/status` returns `{ status, progress, step, errorMessage }`. Fixed progress lookup per status.

**DoD:**
- Non-uploaded → `409 invalid_state`
- `/status` reflects each transition within 3 s

### #18 · Transcript service (download → ffmpeg → diarize → persist)
**Area:** backend · **Priority:** P0 · **Depends on:** #16, #17

`transcript.service.run`. Signed download from Storage → ffmpeg normalize → `openai.audio.transcriptions.create({ response_format: 'diarized_json', chunking_strategy: 'auto' })` → persist `transcripts` + `speakers` → publish `transcript:created`. Temp files cleaned in `finally`.

**DoD:**
- 2-min Vietnamese audio → `transcripts` row + ≥1 `speakers` row + event fires
- Temp files removed
- Speaker labels: `Speaker 1`, `Speaker 2`, …

### #19 · Chunking for large audio (>OPENAI_AUDIO_MAX_BYTES)
**Area:** backend · **Priority:** P1 · **Depends on:** #18

Chunk on ~10-min boundaries, transcribe each, apply time offset to every segment before concatenating.

**DoD:**
- 30-min video normalizes → chunks → transcribes → concatenates
- Timestamps monotonically increase (no reset to 0 at chunk starts)

### #20 · Event subscribers (transcript.events + processing.events)
**Area:** backend · **Priority:** P0 · **Depends on:** #18

`transcript.events` subscribes to `meeting:uploaded` → runs the service. `processing.events` subscribes to `transcript:created` → `markStatus('transcribed')`, `pipeline:failed` → `markStatus('failed', message)`. Wire in `index.js`.

**DoD:**
- End-to-end: upload → `/process` → status flows `uploaded → transcribing → transcribed`

### #21 · ProcessingStatus polling + auto-trigger
**Area:** frontend · **Priority:** P0 · **Depends on:** #17, #15

`useProcessingStatus.hook.js` polls `/status` every 3 s. Renders `StatusStepper` from status. Stops on `completed`/`failed`. Hard timeout 10 min. After Dropzone success, `MeetingDetail` auto-calls `POST /:id/process`.

**DoD:**
- Stepper appears after upload, moves through stages
- Cleanup on unmount
- Timeout message readable

---

## Phase 5 — Summarization + text branch

### #22 · Summary prompt + JSON schema
**Area:** backend · **Priority:** P0 · **Depends on:** #03

`summary.prompts.js` — `SUMMARY_SCHEMA` (JSON Schema per `MODELS.md` shape), `SUMMARY_SYSTEM_PROMPT`, `PROMPT_VERSION`, `buildTranscriptPrompt(segments, speakers)` formats numbered timestamped segments with speaker prefix.

**DoD:**
- Schema validates a sample summary object
- No prompt text inlined anywhere else in the code

### #23 · Summary service (Structured Outputs + normalize + persist)
**Area:** backend · **Priority:** P0 · **Depends on:** #22, #18

`summary.service.run`. Fetch transcript + speakers → build prompt → `openai.responses.create({..., text: { format: { type: 'json_schema', strict: true, schema: SUMMARY_SCHEMA }}})` → Zod validate → store raw JSON in `summaries.raw_response` → upsert `summaries` + `summary_points` → publish `summary:created` + `summary:action-items-extracted`.

**DoD:**
- Given a transcript, produces overview + ≥1 points + speakers array
- `raw_response` populated
- Ollama fallback: `strict` unsupported → uses `type: 'json_object'` + Zod as the guarantee

### #24 · Action-item module (seed + merge + subscriber)
**Area:** backend · **Priority:** P0 · **Depends on:** #23

Fill `action-item` module. `seedFromSummary(items)` idempotent. `mergeOnResummarize` matches by `(content, ownerLabel)` and keeps `is_done`. Subscribe `summary:action-items-extracted` → seed. CRUD endpoints land in #33.

**DoD:**
- After summary runs, `action_items` rows populated
- Re-running `POST /:id/process` doesn't double-seed

### #25 · Complete the pipeline (summary:created → completed)
**Area:** backend · **Priority:** P0 · **Depends on:** #23

Extend `processing.events` — `summary:created` → `markStatus('completed')`.

**DoD:**
- End-to-end: audio → transcribed → summarizing → **completed**
- Client polling picks up `completed` within 3 s

### #26 · SRT + VTT parser
**Area:** backend · **Priority:** P1 · **Depends on:** #11

`transcript/subtitle-parser.js`. Auto-detect SRT vs VTT. Extract `{start_ms, end_ms, text, speaker?}`. Handles VTT voice tags (`<v Name>`), `Name:` prefix, else `Speaker N` sequentially.

**DoD:**
- Parses a Zoom-exported VTT
- Parses a plain SRT
- Unit tested with 2-3 sample files

### #27 · Text-upload branch
**Area:** backend · **Priority:** P1 · **Depends on:** #26

`transcript.service.parseText`. Download text file → parse → persist `transcripts` + `speakers` → publish `transcript:created`. `transcript.events` dispatches on `mime_type`: `text/*` → `parseText`, else → `run`.

**DoD:**
- Upload a `.vtt` → reaches `completed` with no OpenAI transcription call
- Segments + speakers populated from cues

---

## Phase 6 — Detail page + mutations + search

### #28 · search_meetings + count_meetings RPC
**Area:** db · **Priority:** P1 · **Depends on:** #04

Postgres functions per `MODELS.md` §5. Use `to_tsvector('simple', ...)` — Vietnamese-safe.

**DoD:**
- Manual: `select * from search_meetings('<uid>', 'budget', null, null, 20, 0)` returns matches
- `count_meetings` returns total for pagination

### #29 · Meeting search + date filter in list endpoint
**Area:** backend · **Priority:** P1 · **Depends on:** #28, #10

`meeting.controller.list` accepts `q`, `from`, `to`, `status`, `page`, `limit`. Repo calls the RPC.

**DoD:**
- Search finds a Vietnamese word from a transcript
- Date range filters correctly
- Pagination `meta.totalPages` correct

### #30 · Overview aggregator (GET /:id)
**Area:** backend · **Priority:** P0 · **Depends on:** #18, #23

`overview.service.detail(meetingId, userId)` composes `meeting + transcript + summary + actionItems + speakers`. `GET /api/meetings/:id`.

**DoD:**
- One request returns everything the detail page needs
- `transcript`/`summary` `null` when not yet produced

### #31 · Speaker rename endpoint
**Area:** backend · **Priority:** P1 · **Depends on:** #30

`PATCH /api/meetings/:id/speakers` — bulk. Ownership enforced (updated-row-count === payload length else `forbidden`).

**DoD:**
- Rename Speaker 1 → "Minh"; `GET /:id` returns `display_name`
- Try renaming another user's speaker → 403

### #32 · Resummarize endpoint
**Area:** backend · **Priority:** P1 · **Depends on:** #23, #24

`POST /api/meetings/:id/resummarize`. Assert transcript exists, flip → `summarizing`, call `summary.service.run`.

**DoD:**
- After speaker rename → resummarize produces bullets using new name
- Ticked action items retain their tick

### #33 · Action-item CRUD endpoints
**Area:** backend · **Priority:** P0 · **Depends on:** #24

GET (optional `meetingId`) / POST / PATCH / DELETE per `ENDPOINTS.md` §4.

**DoD:**
- Toggle, edit, add, delete all work
- List paginates when unfiltered

### #34 · SummaryView component
**Area:** frontend · **Priority:** P0 · **Depends on:** #30

Bullets grouped by category. Category + speaker filter chips. Click bullet → notify parent with `startMs` (for TranscriptView jump).

**DoD:**
- Categories rendered with label + color (never color alone)
- Filter chips work
- Click emits `startMs`

### #35 · TranscriptView component
**Area:** frontend · **Priority:** P0 · **Depends on:** #30

Flat segment list: `[mm:ss] Speaker N: text`. Receives `startMs` prop → scroll + highlight. In-page find box.

**DoD:**
- Renders 100+ segments smoothly
- Jump-highlight works from SummaryView

### #36 · ActionItemList component
**Area:** frontend · **Priority:** P0 · **Depends on:** #33

Checkbox toggle. Inline edit content/owner/due. Add row. Delete. Optimistic; revert on failure with toast.

**DoD:**
- All 4 ops work
- Refresh preserves state

### #37 · SpeakerLegend component
**Area:** frontend · **Priority:** P1 · **Depends on:** #31

Displays `displayName || label`. Edit mode → bulk PATCH.

**DoD:**
- Rename persists; SummaryView chips + TranscriptView prefixes update after refetch

### #38 · MeetingHistory (search + date filter) + MeetingDetail (all views)
**Area:** frontend · **Priority:** P0 · **Depends on:** #29, #34, #35, #36, #37

History: debounced search + date range + pagination. Detail: renders correct view per status (`draft` / processing / `completed` / `failed`), Retry button on `failed`. Loading/empty/error states on every list.

**DoD:**
- Search "budget" finds a Vietnamese meeting whose transcript contains it
- All 4 detail views render
- No blank screens

---

## Phase 7 — Exports

### #39 · Install pdfkit + bundle Be Vietnam Pro fonts
**Area:** backend · **Priority:** P1 · **Depends on:** #30

`npm install pdfkit`. Bundle Regular + Bold TTFs (OFL) under `server/src/modules/export/` with license notice.

**DoD:**
- Fonts + LICENSE.md committed
- `pdfkit` in `package.json`

### #40 · Markdown renderer + unit test
**Area:** backend · **Priority:** P0 · **Depends on:** #30

Pure `renderMarkdown(data) → string`. Template: title, date, duration, participants, overview, bullets by category, action-item table. Unit test on fixture.

**DoD:**
- Test passes on fixture
- Handles empty categories, no action items, `dueDate: null`

### #41 · PDF renderer + export endpoint
**Area:** backend · **Priority:** P0 · **Depends on:** #39

`renderPdf(data, res)` pipes to response. Font registered before any `text()`. `GET /api/meetings/:id/export?format=md|pdf` reads from `overview.interface.detail` — no LLM call.

**DoD:**
- Vietnamese diacritics render in the PDF (á ế ả ữ …)
- Correct filename + extension
- Re-download shows zero OpenAI usage

### #42 · ExportMenu component
**Area:** frontend · **Priority:** P0 · **Depends on:** #41

Fetch via `http.js` (bearer attached), receive as Blob, trigger download. Two buttons: MD, PDF.

**DoD:**
- Both downloads work
- Access token never appears in URL/history

---

## Phase 8 — Deploy + Submission

### #43 · Deploy client
**Area:** devops · **Priority:** P0 · **Depends on:** #38, #42

Vercel or Netlify. SPA rewrite (`/* → /index.html`). Set `VITE_*` env vars.

**DoD:**
- Live URL responds
- Refresh on `/meetings/abc` doesn't 404

### #44 · Deploy server with ffmpeg verified
**Area:** devops · **Priority:** P0 · **Depends on:** #41

Render or Railway. **Verify `ffmpeg -version` in deploy logs.** Dockerfile with `apt-get install -y ffmpeg` if missing. Set every `server/.env` var (real OpenAI key, `OPENAI_MOCK=false`).

**DoD:**
- `/api/health` responds on live URL
- ffmpeg present in build logs

### #45 · Wire cross-URL config
**Area:** devops · **Priority:** P0 · **Depends on:** #43, #44

Server `CLIENT_URL` → deployed client. Client `VITE_API_URL` → deployed server. Redeploy client.

**DoD:**
- End-to-end works on deployed URLs (register → upload → summary → export)
- CORS clean

### #46 · Security checklist
**Area:** devops · **Priority:** P0 · **Depends on:** #45

Run every line in `SETUP.md` §7. Fix anything that fails.

**DoD:**
- All checklist items pass
- Two-user isolation verified on live URLs
- No secrets in `client/src` (grep)

### #47 · Uptime-Robot keep-alive
**Area:** devops · **Priority:** P1 · **Depends on:** #44

Free Uptime-Robot monitor pinging `GET /api/health` every 10 min.

**DoD:**
- Monitor active
- Backend responds <3 s from cold

### #48 · README
**Area:** docs · **Priority:** P0 · **Depends on:** #45

Live URL + demo video at top. Sections per `DELIVERABLES.md` §3: Purpose, Setup (both apps + ffmpeg prereq), Deps, Team table (Name/GitHub/Role), .env format, Extras.

**DoD:**
- All required sections present
- Team table filled

### #49 · Demo video + Trello + Gantt + OneDrive links
**Area:** docs · **Priority:** P0 · **Depends on:** #48

Record demo (sign in → upload → progress → summary → rename speaker → tick action → search → export PDF, ~3 min). Update Trello to match reality. Submit Gantt. Link OneDrive weekly reports from README.

**DoD:**
- Video uploaded + linked in README
- All 4 submission artifacts referenced

---

## Post-submission parking (don't touch until #49 lands)

- **#P1** Live-session (real-time recording + rolling summary)
- **#P2** DOCX export
- **#P3** Password reset flow
- **#P4** Move refresh token to httpOnly cookie + CSRF

---

## Trello board setup

**Columns:** Backlog · In Progress · In Review · Done

**Labels:**
- Priority: P0 red · P1 yellow · P2 blue
- Area: docs grey · db purple · backend green · frontend orange · devops black

**Pick rule:** top of Backlog whose deps are Done. Card owners self-assign on start.
