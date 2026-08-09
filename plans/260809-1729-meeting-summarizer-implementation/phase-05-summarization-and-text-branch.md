# Phase 5 — Summarization + Text-upload branch

## Context Links
- Phase 4 (`transcripts` + `speakers` populated, `transcript:created` fires)
- Updated `docs/system.doc/AI_INTEGRATION.md` §3-6 (Phase 1 output)
- `docs/server.doc/ENDPOINTS.md` §5 (speakers), §3 (process/resummarize)
- `docs/server.doc/MODELS.md` §2 (`summaries`, `summary_points`, `action_items`)

## Overview
- **Priority:** High — this closes the "generate meeting minutes" loop
- **Status:** pending
- **Description:** Two things: (a) `summary` module subscribes to `transcript:created`, calls `gpt-5.6-luna` via Responses API + Structured Outputs, normalizes, persists `summaries` + `summary_points`, publishes `summary:action-items-extracted`; `action-item` module seeds `action_items`. (b) Text-upload branch — user uploads `.srt`/`.vtt`, we parse it in `transcript.service.js`, build `segments` (with speaker labels if present), persist a `transcripts` row directly, skip diarize, publish `transcript:created`.

## Key Insights
- **Structured Outputs** (schema-locked) removes the whole defensive parsing chain from `AI_INTEGRATION.md` §3. Zod still validates the returned object as belt-and-braces.
- Speaker labels are already-populated (Phase 4 for audio, VTT-parser for text). Summary prompt receives real speaker turns as input — better bullets, honest "who said this" attribution.
- Text branch skips ffmpeg + diarize entirely. Same state machine, `transcribing` step is just VTT parsing (fast, <100 ms).
- Store raw Structured Output in `summaries.raw_response jsonb` **before** parsing. Debug column. Also: re-download reads from here (or the normalized rows) — never re-calls OpenAI (locked in brainstorm §3.6).
- Action items go to `action-item` module via the `summary:action-items-extracted` event — `summary` never writes `action_items` directly (cross-module rule).

## Requirements
- **Functional:** for either input path, a `transcribed` meeting reaches `completed` with `summaries.overview`, ≥1 `summary_points`, correctly attributed speakers, and 0+ `action_items` (empty is valid).
- **Non-functional:** structured output schema matches the exact `MODELS.md` shape. No hand-mapping in service code — DTOs handle serialization. `summary.service` never touches `action_items` table.

## Architecture
```
Path A (audio/video, from Phase 4):
  transcript:created ─► summary.service.run(meetingId,userId)

Path B (text upload):
  meeting.status=uploaded ─► transcript.service.parseText(...)
                              ├─ SRT/VTT parse → segments + speakers (if present)
                              ├─ persist transcripts + speakers
                              └─ publish transcript:created
  transcript:created ─► summary.service.run(...)   [same as Path A from here]

summary.service.run:
  1. transcript.interface.getTranscriptForOwner
  2. build prompt (numbered segments with real speaker labels)
  3. openai.responses.create({ model, input, text: { format: { type: 'json_schema', schema: SUMMARY_SCHEMA } } })
  4. Zod validate (belt-and-braces)
  5. summary.repository.upsertSummary + upsertPoints
  6. eventBus.emit('summary:created', {meetingId,userId})
  7. eventBus.emit('summary:action-items-extracted', {meetingId,userId, items})

action-item.events subscribes to summary:action-items-extracted → seedFromSummary(items)
processing.events subscribes to summary:created → markStatus(..., 'completed'), poll returns status='completed'
```

## Related Code Files
Fill:
- `server/src/modules/summary/summary.service.js` — build prompt, call OpenAI, validate, persist
- `server/src/modules/summary/summary.prompts.js` — `SUMMARY_SYSTEM_PROMPT`, `SUMMARY_SCHEMA` (JSON Schema for Structured Outputs), `PROMPT_VERSION`, `buildTranscriptPrompt(segments, speakers)`
- `server/src/modules/summary/summary.repository.js` — `upsertSummary`, `upsertPoints`
- `server/src/modules/summary/speaker.repository.js` — read-only (Phase 4 writes; Phase 6 does renames)
- `server/src/modules/summary/summary.events.js` — publish only; no subscribers here
- `server/src/modules/summary/summary.interface.js` — `getSummaryForOwner`
- `server/src/modules/action-item/action-item.service.js` — `seedFromSummary(meetingId, userId, items)`, `mergeOnResummarize`
- `server/src/modules/action-item/action-item.repository.js` — insert/update/list/delete
- `server/src/modules/action-item/action-item.interface.js` — `seedFromSummary`, `mergeOnResummarize`
- `server/src/modules/action-item/action-item.events.js` — subscribe to `summary:action-items-extracted`
- `server/src/modules/transcript/transcript.service.js` — add `parseText(meetingId, userId, filePath)` for the text branch
- `server/src/modules/processing/processing.events.js` — add `summary:created` handler → `markStatus(..., 'completed')`

New utilities:
- `server/src/modules/transcript/subtitle-parser.js` — small SRT + VTT parser. Extracts `{start, end, text, speaker?}` per cue. No dep (regex-based, well-defined format).

Update:
- `server/src/modules/meeting/meeting.validator.js` — accept `mimeType` values in `text/*` group. `meeting.service.js` upload: text uploads go straight to `uploaded` (same as audio) but the subsequent `POST /:id/process` routes into `parseText` instead of the diarize path — decision made based on `mime_type`.
- `server/src/modules/processing/processing.service.js` — `start()` publishes `meeting:uploaded` regardless; `transcript.events.js` inspects the meeting to decide which method to call.

## Implementation Steps

1. **Schema.** In `summary.prompts.js`, define the JSON Schema for Structured Outputs:
   ```js
   export const SUMMARY_SCHEMA = {
     type: 'object', additionalProperties: false, required: ['overview','speakers','points','actionItems'],
     properties: {
       overview: { type: 'string' },
       speakers: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['label','evidence'],
         properties: { label: { type: 'string' }, evidence: { type: 'string' } } } },
       points: { type: 'array', items: { type: 'object', additionalProperties: false,
         required: ['content','category','speakerLabel','startMs'],
         properties: {
           content: { type: 'string' },
           category: { type: 'string', enum: ['decision','action','question','blocker','risk','discussion'] },
           speakerLabel: { type: 'string' },
           startMs: { type: 'integer' } } } },
       actionItems: { type: 'array', items: { type: 'object', additionalProperties: false,
         required: ['content','ownerLabel','dueDate'],
         properties: {
           content: { type: 'string' },
           ownerLabel: { type: ['string', 'null'] },
           dueDate: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' } } } }
     }
   }
   ```

2. **Prompt.** `SUMMARY_SYSTEM_PROMPT` per `AI_INTEGRATION.md` §5: "Return an object matching the schema. Use only info in the transcript. Do not invent owners/deadlines — null when unstated. Language = transcript language. One factual sentence per bullet. Exactly one category per bullet." Bump `PROMPT_VERSION` to `'1'`.

3. **`buildTranscriptPrompt(segments, speakers)`** — format segments as `[i | mm:ss | Speaker N] text`. Include a legend of speaker labels ("Speaker 1: Minh, Speaker 2: Lan" if display_names set — otherwise just labels).

4. **`summary.service.run(meetingId, userId)`:**
   1. Fetch transcript via `transcript.interface`
   2. Fetch speakers via `speaker.repository`
   3. `input = buildTranscriptPrompt(...)`
   4. `openai.responses.create({ model: env.OPENAI_SUMMARY_MODEL, input: [{ role:'system', content: SUMMARY_SYSTEM_PROMPT }, { role:'user', content: input }], text: { format: { type:'json_schema', name:'meeting_summary', strict: true, schema: SUMMARY_SCHEMA }} })`
   5. Extract the JSON from response `.output_text` (or parse `.output[0].content[0]`). Zod-validate.
   6. Store raw response in `summaries.raw_response`. Upsert `summaries` + `summary_points` (map `speakerLabel → speaker_id`; if label not in DB, insert a new `speakers` row and re-map).
   7. Normalize actionItems: drop empty content, coerce `dueDate` invalid → null, cap at 20.
   8. Publish `summary:created` and `summary:action-items-extracted`.

5. **`action-item.service.seedFromSummary(meetingId, userId, items)`** — inserts rows. Never runs if a summary already exists (idempotency: `POST /:id/process` twice must not double up). Resummarize path (Phase 6) uses `mergeOnResummarize` — matches by (content, ownerLabel) heuristic; keeps `is_done`.

6. **`action-item.events.register`** — `eventBus.on('summary:action-items-extracted', ...)` → `seedFromSummary`.

7. **`processing.events.register`** — extend from Phase 4: `on('summary:created', ...)` → `meeting.interface.markStatus('completed')`. Client polling picks it up.

8. **Text branch — `transcript.service.parseText(meetingId, userId)`:**
   1. Download the text file from Storage to `os.tmpdir()`
   2. Detect SRT vs VTT by extension or content
   3. `subtitle-parser.js` returns `[{start_ms, end_ms, text, speaker?}, ...]`
   4. Distinct speakers → `speakers` rows (like diarize did)
   5. Persist `transcripts` row: `full_text = segments.map(s=>s.text).join(' ')`, `segments`, `language` (from VTT `LANG:` if present else `null`), `word_count`
   6. Publish `transcript:created`
   7. Cleanup temp file
   - **Same downstream as Path A** — Phase 5 code doesn't care which input produced the transcript

9. **Router at `transcript.events.js`:** on `meeting:uploaded`, inspect `mime_type`. If starts with `text/`, call `parseText`; else call `run` (diarize). One event handler, two paths.

10. **`meeting.validator.js`** — upload validator accepts `text/plain`, `text/vtt`, `application/x-subrip`. For text uploads, allow smaller `MAX_UPLOAD_BYTES` (e.g. 5 MB — no meeting has a 500 MB subtitle file).

11. **Smoke — Path A:** end-to-end from Phase 4's transcribed meeting: `transcript:created` fires, summary runs, `points` + `actionItems` populate, status flips to `completed`, client polling picks up.

12. **Smoke — Path B:** upload a Zoom-exported `.vtt`. Meeting reaches `completed` in seconds (no LLM transcription). Speakers labelled per the VTT lines.

## Todo List
- [ ] `summary.prompts.js` — schema, system prompt, PROMPT_VERSION, prompt builder
- [ ] `summary.service.run` + `.repository` + `.interface`
- [ ] `action-item.service.seedFromSummary` + `.repository` + `.interface` + `.events` subscriber
- [ ] `processing.events` — `summary:created` → completed
- [ ] `subtitle-parser.js` — SRT + VTT
- [ ] `transcript.service.parseText`
- [ ] `transcript.events` router — text vs audio dispatch
- [ ] `meeting.validator` — text MIME types
- [ ] Smoke Path A: audio → completed with points + action items
- [ ] Smoke Path B: `.vtt` → completed
- [ ] Zod validates output; `dueDate: null` cases preserved
- [ ] Commits per module

## Success Criteria
- Uploaded 30-min Vietnamese video reaches `completed` with a coherent overview, ≥5 points across ≥2 categories, plausible speakers, and any explicit "please do X" mentions surfaced as action items
- Uploaded Zoom `.vtt` reaches `completed` with the same summary shape (no LLM transcription call)
- Every `summaries` row has `raw_response` populated; re-reading the meeting later shows the same summary (no LLM re-call — direct DB read)
- OpenAI Structured Outputs strictness prevents malformed JSON. Zod validation is redundant but should never fail during normal operation.

## Risk Assessment
- **Risk:** Ollama's OpenAI-compat endpoint may not support `text.format.type === 'json_schema'` (strict Structured Outputs). **Mitigation:** detect at boot (`env.OPENAI_BASE_URL !== 'https://api.openai.com/v1'`) → fall back to `type: 'json_object'` (loose JSON mode) + Zod as the guarantee. Same code path, one conditional.
- **Risk:** Ollama's `gpt-oss-20b` output quality on Vietnamese may be weaker than `gpt-5.6-luna`. **Mitigation:** acceptable for dev — fixture stub (`OPENAI_MOCK=true`) is the fallback if Ollama output is unusable. Prod uses `gpt-5.6-luna`.
- **Risk:** action items double-seed if `POST /:id/process` is called twice. **Mitigation:** `seedFromSummary` checks whether the meeting already has action items and no-ops if so. Explicit resummarize (Phase 6) uses the `merge` path.
- **Risk:** SRT/VTT files with speaker names in the text ("Minh: Okay so…") vs the WEBVTT NOTE speaker convention vs cue voice tags (`<v Minh>...`). **Mitigation:** parser first tries VTT voice tag, then `Name:` prefix, else labels sequentially as `Speaker N` based on cue clustering. Document the heuristic in `subtitle-parser.js` header comment.

## Security Considerations
- Never store the OpenAI response in a log (it may contain content the user considers private). `summaries.raw_response jsonb` is fine — it's their own data. Not fine — logging it to stdout.
- `OPENAI_API_KEY` server-only (already established). Never appears in any client-bound response.

## Next Steps
- Phase 6 wires `overview` aggregator, the detail page views for `summarizing`/`completed`, action-item CRUD, speaker rename, history search + date filter
