# AI_INTEGRATION.md

The Groq layer: audio preprocessing, transcription, summarization, prompts, output parsing,
and the known gaps.

Placement follows the module boundaries. The Groq SDK client is a **config-layer** concern
(`server/src/config/groq.js`); the calls belong to the modules that own the resulting data:

| Concern | Lives in |
| --- | --- |
| Groq SDK client construction | `config/groq.js` |
| ffmpeg preprocessing + Whisper call | `modules/transcript/transcript.service.js` |
| Llama call, parsing, normalization | `modules/summary/summary.service.js` |
| Prompt text and `PROMPT_VERSION` | `modules/summary/summary.prompts.js` |
| Deciding *when* either runs | `modules/processing/` — via the event bus |

`GROQ_API_KEY` exists only in `server/`. If it ever appears in `client/`, that is a
security bug and a graded-project embarrassment.

---

## 1. Models

| Task | Model | Notes |
| --- | --- | --- |
| Speech → text | `whisper-large-v3` | Highest accuracy; handles Vietnamese. A `-turbo` variant is faster but less accurate — the brief names Large-v3, so use it. |
| Summarization | `llama-3.3-70b-versatile` | Large context window, supports JSON-mode output. |

Both via Groq's OpenAI-compatible API.

---

## 2. Audio preprocessing — `transcript` module

The backend is a long-running Node process, so **ffmpeg is installed and available**. All
media handling happens server-side; the client uploads the original file untouched.

Pipeline inside `transcript.service.js`:

1. **Download** the object from Supabase Storage using a signed URL.
2. **Extract audio** if the file is video (`.mp4`, `.webm`, `.mov`). This is what makes the
   brief's "upload a meeting recording (audio **or video** file)" requirement work — do not
   skip it and do not push it to the browser.
3. **Normalize** to 16 kHz mono FLAC. Whisper works at 16 kHz internally; anything more is
   wasted bytes on the wire.
   ```
   ffmpeg -i input.mp4 -vn -ac 1 -ar 16000 -c:a flac output.flac
   ```
4. **Chunk** only if the normalized file still exceeds Groq's per-request audio size limit
   (roughly 25 MB on the free tier; verify against current Groq docs and keep the number in
   one place as `GROQ_AUDIO_MAX_BYTES`). Split on ~10-minute boundaries, transcribe each
   piece, then concatenate — **applying a time offset to every segment's `start`/`end`**.
   Forgetting the offset silently corrupts every timestamp after the first chunk.
5. **Clean up** the temp files in a `finally` block. A long-running process leaks disk;
   a serverless one would not have.

> Chunking here exists only because of Groq's request size limit — not to dodge a platform
> timeout. That is the concrete benefit of `ARCHITECTURE.md` §0's deployment decision.

### Whisper call

```js
// verbose_json gives segment-level timestamps. We need them for jump-to-transcript
// and to ground speaker attribution in turn structure.
const res = await groq.audio.transcriptions.create({
  file: audioFile,
  model: 'whisper-large-v3',
  response_format: 'verbose_json',
  timestamp_granularities: ['segment'],
  language: undefined,   // auto-detect; meetings may be vi or en
  temperature: 0,
});
```

Persist `res.text` → `transcripts.full_text`, and the trimmed segments
(`{ id, start, end, text }` only) → `transcripts.segments`. Drop word-level data; it bloats
the row for no current feature.

On success, publish `transcript:created`. The `transcript` module must not know that
`summary` exists.

---

## 3. Summarization — `summary` module

### Input

Feed the model **numbered segments with timestamps**, not the flat blob:

```
[0 | 00:00:04] Okay so the deadline moved to the 17th.
[1 | 00:00:11] Right, then I'll redo the Gantt chart tonight.
```

It costs a few more tokens and buys the two things the brief requires: the model can cite
`startMs` per bullet, and it has the turn structure it needs to infer speakers.

If the transcript exceeds the context budget, map-reduce: summarize ~15-minute windows, then
run a merge pass. Keep the same output schema at both levels so one parser serves both.

### Call

```js
const completion = await groq.chat.completions.create({
  model: 'llama-3.3-70b-versatile',
  messages: [
    { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
    { role: 'user',   content: buildTranscriptPrompt(segments) },
  ],
  response_format: { type: 'json_object' },
  temperature: 0.2,   // low: this is extraction, not creative writing
  max_tokens: 4096,
});
```

### Expected JSON

```json
{
  "overview": "2-3 sentence abstract of the meeting.",
  "speakers": [
    { "label": "Speaker 1", "evidence": "introduces themselves as the team lead" }
  ],
  "points": [
    { "content": "Deadline moved from Sept 10 to Sept 17.",
      "category": "decision", "speakerLabel": "Speaker 1", "startMs": 4000 }
  ],
  "actionItems": [
    { "content": "Redo the Gantt chart with the new deadline",
      "ownerLabel": "Speaker 2", "dueDate": "2026-09-12" }
  ]
}
```

`category` ∈ `decision | action | question | blocker | risk | discussion`.

### Parsing — defensive even in JSON mode

JSON mode reduces malformed output; it does not eliminate it, and it never guarantees *your*
schema. Layer the defences in `summary.service.js`:

```js
// 1. Strip markdown fences the model sometimes adds despite JSON mode.
// 2. Fall back to the outermost {...} span if there is stray prose around it.
// 3. Validate with Zod — well-formed JSON of the wrong shape is still a failure.
// 4. On Zod failure, retry ONCE with the validation errors appended to the prompt.
// 5. Still failing -> publish pipeline:failed. Never write partial rows.
```

Store the untouched string in `summaries.raw_response` **before** parsing. When a summary
looks wrong, that column is the only way to tell a bad prompt from a bad parser.

### Normalization rules

- Drop any action item with empty `content`.
- `dueDate`: accept only ISO `YYYY-MM-DD`. If the model returns "next Friday" or a past
  date, store `null` and keep the phrase inside `content`. **Never invent a date** — a wrong
  deadline in a meeting summary is worse than a missing one.
- A `speakerLabel` not present in the `speakers` array still creates a speaker row.
- Cap at 25 points and 20 action items; keep the first N and log the overflow.
- Action items are handed to the `action-item` module via the
  `summary:action-items-extracted` event, not by writing its table directly.

---

## 4. Speaker attribution — read before promising it

**Whisper does not do diarization.** It returns text with timestamps and no speaker IDs.
The brief requires speaker-labelled summary points, so the gap must be closed explicitly.

| Approach | How | Honest assessment |
| --- | --- | --- |
| **A. LLM inference (chosen)** | Give Llama the timestamped segments; it infers distinct speakers from turn-taking, self-introductions, and addressing patterns. Emits `Speaker 1..N`, or a real name when someone is clearly named. | Free, no extra vendor, ships this week. Moderate accuracy, degrades with cross-talk. Adequate for a demo *if* users can correct it. |
| **B. User-corrected labels (chosen)** | A, plus `SpeakerLegend` + `PATCH /api/meetings/:id/speakers`. | Turns a shaky guess into a feature. **Build this regardless.** |
| **C. Real diarization** | pyannote / AssemblyAI / Deepgram produce speaker-labelled turns, then Llama summarizes them. | Genuinely accurate. Another vendor, another key, another failure mode, and it departs from the brief's "Groq API" line. Only if Core finishes early. |

**Decision: A + B.** In the README and demo video, call it *speaker attribution (inferred)*,
never "diarization". Overclaiming is easy to catch and costs more than it gains.

---

## 5. Prompts

All prompt text lives in `summary.prompts.js` as exported constants with a
`PROMPT_VERSION`. Never inline a prompt in a service method or a controller.

`SUMMARY_SYSTEM_PROMPT` must state, at minimum:

- Return a single JSON object matching the given schema. No prose, no markdown fences.
- Use only information present in the transcript. Omit what was not discussed.
- **Do not invent owners or deadlines.** Use `null` when unstated.
- Write the summary in the same language as the transcript.
- One factual sentence per bullet, no filler.
- Exactly one category per bullet.

Bump `PROMPT_VERSION` on any meaningful change so `summaries.prompt_version` records which
prompt produced which row.

---

## 6. Failure handling

Every failure publishes `pipeline:failed`; `processing` writes `status='failed'` plus a
readable `errorMessage` and emits `meeting:failed` over the socket.

| Failure | Handling |
| --- | --- |
| Groq `429` | Read `retry-after`, exponential backoff, max 3 attempts. Then `rate_limited` with `details.retryAfterMs`. |
| Timeout / `5xx` | 2 retries, then fail with "Transcription service unavailable, please retry". |
| Audio over the size limit | Chunk. Only fail if chunking is not implemented yet — and say so. |
| Empty transcript (silent recording) | Fail with "No speech detected in the recording". Do not run summarization on empty text. |
| Malformed JSON after one retry | Fail, keep `raw_response`, offer Retry in the UI. |
| ffmpeg non-zero exit | Fail with "Could not read the audio in this file". Log stderr server-side only. |

`errorMessage` must be readable by a non-technical evaluator. A raw stack trace in that
column is not acceptable.

---

## 7. Cost, rate limits, and demo insurance

Groq's free tier has per-minute and per-day request/token limits. Two practical consequences:

- **Never re-transcribe in a loop during development.** `POST /:id/process` returns `409`
  when a transcript already exists — that guard is a cost control, not just hygiene.
- **Keep fixtures.** Save one real transcript JSON and one summary JSON under
  `server/fixtures/`, and set `MOCK_AI=true` in `.env` to bypass Groq entirely. This lets
  the whole summarization and UI path be developed offline, and it is the fallback that
  saves the demo if the API rate-limits you mid-recording.

`MOCK_AI` is read in `config/groq.js` and swaps the client for a fixture-backed stub. No
module method changes — that is the point of putting the SDK in the config layer.
