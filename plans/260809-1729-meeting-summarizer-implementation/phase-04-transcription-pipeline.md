# Phase 4 — Transcription pipeline (ffmpeg + diarize)

## Context Links
- Phase 2 (`config/openai.js` available)
- Phase 3 (meetings can reach `uploaded` status)
- Updated `docs/system.doc/AI_INTEGRATION.md` §1-2 (Phase 1 output)
- `docs/system.doc/ARCHITECTURE.md` §4 (pipeline + state machine)
- `docs/server.doc/ENDPOINTS.md` §3 (`/process`, `/status`)

## Overview
- **Priority:** High — no summary is possible until we have text
- **Status:** pending
- **Description:** Implement the audio/video path: `POST /:id/process` kicks off, `processing` orchestrator subscribes to `meeting:uploaded`, `transcript` module downloads from Storage → ffmpeg-normalizes → calls `gpt-4o-transcribe-diarize` → persists `transcripts` + `speakers` (diarize gives them upfront) → publishes `transcript:created`. Status observable via `GET /:id/status` polling.

## Key Insights
- **Diarize returns speaker labels natively** — this phase writes `speakers` rows (previously docs said `summary` module owned this; brainstorm shifted it to `transcript`)
- ffmpeg is guaranteed present because we deploy to Render/Railway (not serverless); no fallback needed
- Chunk **only** if the normalized file exceeds `OPENAI_AUDIO_MAX_BYTES`. Apply time offsets to every segment when concatenating chunks or timestamps corrupt (docs `AI_INTEGRATION.md` §2)
- Progress transport is polling for MVP — `processing` writes status transitions; clients poll `GET /:id/status` every 3 s
- Cleanup temp files in a `finally` block. Long-running Node process leaks disk otherwise.

## Requirements
- **Functional:** given a `uploaded` meeting with a 30-min video, produce a persisted `transcripts` row with `full_text`, `segments` (with speaker labels + timestamps), `language`, `word_count`, and `speakers` rows for each detected speaker
- **Non-functional:** progress visible via `/status` within 3 s of each transition; failure produces a human-readable `error_message`

## Architecture
```
client                    processing               transcript                openai
  │ POST /:id/process         │                        │                       │
  ├──────────────────────────►│ status=transcribing    │                       │
  │  202 Accepted             │ publish                │                       │
  │◄────────                  │   meeting:uploaded ───►│ download from Storage │
  │                           │                        │ ffmpeg → 16k mono FLAC│
  │  GET /:id/status  every 3s│                        │ chunk if > MAX_BYTES  │
  ├──────────────────────────►│                        │ openai.audio.trans... │
  │                           │                        │   .create({diarize})──►
  │                           │                        │◄──────────── segments │
  │                           │                        │ persist transcripts + │
  │                           │                        │   speakers            │
  │                           │◄── transcript:created ─┤ status=transcribed    │
  │  GET .../status           │                        │                       │
  │◄ status='transcribed' ────┤                        │                       │
```

Later phases wire `summary` behind `transcript:created`; this phase leaves the meeting at `transcribed` (not `completed`).

## Related Code Files
Fill:
- `server/src/modules/transcript/transcript.service.js` — download + ffmpeg + chunking + diarize call + persist
- `server/src/modules/transcript/transcript.repository.js` — insert into `transcripts`, insert into `speakers`, scoped by `userId`
- `server/src/modules/transcript/transcript.events.js` — `eventBus.on('meeting:uploaded', ...)` → calls `transcript.service.run(meetingId, userId)`
- `server/src/modules/transcript/transcript.interface.js` — `getTranscriptForOwner`
- `server/src/modules/processing/processing.service.js` — `start(meetingId, userId)`, status writes via `meeting.interface`
- `server/src/modules/processing/processing.controller.js` — `process`, `status`
- `server/src/modules/processing/processing.events.js` — bus subscribers translating domain events → `meeting.status` writes
- `server/src/modules/processing/processing.routes.js` — uncomment routes
- `server/src/modules/meeting/meeting.interface.js` — add `markStatus(meetingId, userId, status, errorMessage?)`

Create utilities:
- `server/src/modules/transcript/ffmpeg.js` — small wrapper around `child_process.spawn('ffmpeg', …)` returning a Promise. Cleanup in `finally`. Not enough logic to justify a package dep.

Update client:
- `client/src/components/ProcessingStatus/*` — real hook: polls `GET /:id/status` every 3 s, renders `StatusStepper` from `status`. Stops on `completed` or `failed`. Hard timeout 10 min.
- `client/src/pages/authenticated/MeetingDetail.jsx` — show `ProcessingStatus` when `status ∈ {uploaded, transcribing, transcribed, summarizing}` (summarizing/completed states become live in Phase 5-6)
- Uploading a file (from Phase 3) now also triggers `POST /:id/process` — either automatically after upload succeeds, or via a "Start processing" button. **Recommendation: auto** — one less click; retry handled by a separate button when `failed`.

## Implementation Steps

1. **`processing.service.js`:**
   - `start(meetingId, userId)` — assert meeting exists + owned + `status='uploaded'` (else `invalidState`); flip status → `transcribing`; publish `meeting:uploaded`. Return immediately.
2. **`processing.controller.js`:** `process` → calls `processingService.start`, returns `202 { meetingId, status: 'transcribing' }`. `status` → reads a single row via `meeting.interface.getStatus(meetingId, userId)` and returns `{ status, progress, step, errorMessage }`. `progress` is a fixed lookup (`draft` 0, `uploaded` 0.1, `transcribing` 0.3, `transcribed` 0.6, `summarizing` 0.8, `completed` 1.0, `failed` 0).
3. **`processing.events.js`:** subscribe to `transcript:created` → `meeting.interface.markStatus(meetingId, userId, 'transcribed')`. Subscribe to `pipeline:failed` → `markStatus(..., 'failed', message)`. `summary:created` handled in Phase 5 (leave a TODO).
4. **`transcript.events.js`:** `eventBus.on('meeting:uploaded', async ({ meetingId, userId }) => transcript.service.run(meetingId, userId).catch(err => eventBus.emit('pipeline:failed', { meetingId, userId, code: 'transcription_failed', message: humanize(err) })))`
5. **`transcript.service.js`:**
   - `run(meetingId, userId)`:
     1. `meeting.interface.getMeetingForOwner(meetingId, userId)` — get `storage_path`, `mime_type`, `size_bytes`
     2. `supabase.storage.from('recordings').createSignedUrl(storage_path, 3600)` — get download URL
     3. `fetch(signedUrl)` → save to `os.tmpdir()/{meetingId}.{ext}`
     4. `ffmpeg` → normalize to 16 kHz mono FLAC: `ffmpeg -i input -vn -ac 1 -ar 16000 -c:a flac output.flac`
     5. If FLAC size ≤ `OPENAI_AUDIO_MAX_BYTES`: one `openai.audio.transcriptions.create({ file, model: env.OPENAI_TRANSCRIPTION_MODEL, response_format: 'diarized_json', chunking_strategy: 'auto' })`. Else: chunk on ~10-min boundaries (ffmpeg `-ss`/`-to`), transcribe each, concat with offset applied to every `segment.start`/`end`.
     6. Extract distinct speakers from `segments[*].speaker` → insert `speakers` rows (label = `"Speaker 1"`, `"Speaker 2"`, …; leave `display_name` null; assign colors from a fixed palette). Build `label → speaker_id` map.
     7. Insert `transcripts` row: `full_text`, `segments` (trimmed to `{id,start,end,text,speaker_id}`), `language`, `model`, `word_count`
     8. Publish `transcript:created` with `{ meetingId, userId }`
     9. `finally` — `fs.rm` all temp files
   - Errors thrown propagate to `transcript.events.js` catcher which publishes `pipeline:failed`
6. **`transcript.repository.js`** — 2 methods: `upsertTranscript(row)`, `insertSpeakers(meetingId, userId, labels)`. Both take `userId` and scope inserts on it (denormalized column).
7. **`transcript.interface.js`** — `getTranscriptForOwner(meetingId, userId)`. Used by `overview` module in Phase 6.
8. **`meeting.interface.js`** — add `markStatus(meetingId, userId, status, errorMessage?)`. Enforces forward-only transitions per `ARCHITECTURE.md` §4.1.
9. **`transcript/ffmpeg.js`** — spawn wrapper. Returns `Promise<{ stdout, stderr }>`. Rejects on non-zero exit. Timeout 5 min per invocation.
10. **Client `ProcessingStatus/useProcessingStatus.hook.js`** — `setInterval(fetchStatus, 3000)`. Clear on `completed`/`failed`/unmount. Hard timeout 10 min → show "processing is taking longer than expected".
11. **Trigger:** after `Dropzone` upload success, `MeetingDetail` calls `POST /:id/process`, then flips to render `ProcessingStatus`.
12. **Real-input smoke:** upload a ~2-min Vietnamese `.m4a`. Expect `transcripts` row with plausible full_text, distinct `speakers` rows, timestamps monotonically increasing. Language detected as `vi`.

## Todo List
- [ ] `meeting.interface.markStatus` + forward-only guard
- [ ] `processing.service.start` + `controller.process/status` + `events.js` subscribers
- [ ] `transcript.service.run` — download, ffmpeg, chunking, diarize call, persist
- [ ] `transcript.repository` — upsert + speakers insert
- [ ] `transcript.events.register` — subscribe to `meeting:uploaded`
- [ ] `ffmpeg.js` wrapper
- [ ] Client `ProcessingStatus` polling hook
- [ ] `MeetingDetail` auto-`POST /process` after upload
- [ ] Smoke: 2-min Vietnamese audio produces a diarized transcript with correct language
- [ ] 30-min video smoke (Vietnamese) — verifies ffmpeg extract + no chunking-boundary artefacts
- [ ] Commit sequence per module

## Success Criteria
- Uploading a 30-min video reaches `transcribed` status without manual intervention
- Speakers array is non-empty and has plausible turn distribution
- Timestamps monotonically increase across chunk boundaries (if chunking triggered)
- Polling `/status` reflects progress within 3 s of each transition
- `retry` path: if transcription fails, `POST /:id/process` again re-runs from the earliest incomplete stage (i.e. transcription, since summary hasn't run)

## Risk Assessment
- **Risk:** `gpt-4o-transcribe-diarize` returns speakers in an unexpected shape (docs describe `diarized_json` but exact field name may be `speaker` vs `speaker_label` vs `speaker_id`). **Mitigation:** log the raw response the first time; unblock quickly. Save that response as the `fixtures/transcript-sample.json` so the mock stays real-shaped.
- **Risk:** ffmpeg missing in a teammate's dev env. **Mitigation:** boot check — `ffmpeg -version` at startup in dev; log a warning if not present but don't crash (so `OPENAI_MOCK=true` still works without ffmpeg).
- **Risk:** long transcription (30 min) exceeds the polling client's timeout. **Mitigation:** hard timeout 10 min in UI is measured from `transcribing` START, not from upload. Realistic upper bound for a 30-min recording at Groq speeds — verify with a real test.
- **Risk:** temp files leak disk on failure. **Mitigation:** `try/finally` for cleanup; also add a `startup-sweep` in `config/upload.js` that clears `os.tmpdir()/meeting-summarizer-*` on boot.

## Security Considerations
- Signed download URL for Storage: 1 hour TTL (`MODELS.md` §4). Don't log it.
- Never write user audio bytes anywhere except `os.tmpdir()`, and always clean up.
- `openai.audio.transcriptions.create` is called with the tmp file — the request body is the raw audio. Verify OpenAI's data-usage settings; enterprise plans allow opt-out of training.

## Next Steps
- Phase 5 subscribes to `transcript:created`, runs summarization, and adds the text-upload branch
