# Transcript Upload & AI Processing Spec

**Status:** Draft — Phase 1 (upload → JSON) ready for dev, Phase 2 (speaker/task attribution) spec-only
**Related docs:** AI_INTEGRATION.md, MODELS.md, ENDPOINTS.md

---

## 1. Overview

This document defines the flow for uploading a meeting file, converting it into a
structured summary JSON via LLM, and persisting that JSON to Supabase. The JSON is
the single source of truth later used to render the meeting PDF.

Two phases:
- **Phase 1 (this spec, build now):** file upload → transcript → summary JSON → Supabase
- **Phase 2 (spec only, not wired into dev):** speaker attribution + task assignment,
  requires GPT Luna, added on top of the Phase 1 JSON schema without breaking it

---

## 2. Accepted File Types & Validation

| Type | Extension | Handling |
|---|---|---|
| Video | `.mp4` | Sent to Groq Whisper for transcription |
| Subtitles | `.vtt`, `.srt` | Parsed directly (already timestamped) |
| Plain text | `.txt`, `.md` | Used as-is, no timestamps unless present in content |

**Rejection rules (return 4xx, do not silently drop):**
- Extension not in the accepted list
- MIME type mismatch (e.g. `.mp4` extension but not actually a video container)
- Empty file (0 bytes)
- File exceeds max size limit — **TBD, needs a number** (e.g. 500MB for MP4).
  This matters because a long-running Node backend on Render/Railway/Fly can time
  out or run out of memory on large uploads if this isn't capped.
- Corrupted/unreadable file (parse attempt fails)

**On rejection:** return a clear error (`{ error: "unsupported_file_type" | "file_too_large" | "corrupted_file" }`)
so the frontend can show a specific message instead of a generic failure.

---

## 3. Flow

```
1. User uploads file on meeting detail page (meeting already exists as `draft`)
2. Backend validates file (type, size, integrity)
   -> invalid: reject, meeting stays `draft`, error returned to frontend
   -> valid: continue
3. Store raw file in Supabase Storage, linked to meeting_id
4. Update meeting status: draft -> processing
5. Branch by file type, each branch normalizes into the same intermediate format,
   `TranscriptSegment[]` (see §3.1):
   - .mp4        -> Groq Whisper -> segments with timestamps (no speaker, see §3.1 note)
   - .vtt / .srt -> parse directly -> segments with timestamps (already present in file)
   - .txt / .md  -> segments with timestamp = null
6. Send `TranscriptSegment[]` to LLM (model depends on env, see §5) with a
   structured-output prompt -> summary JSON (see §4)
7. Validate JSON against schema
   -> invalid/malformed: meeting status -> failed, store error reason
   -> valid: continue
8. Save JSON to Supabase (meetings table or related summary table)
9. Update meeting status: processing -> completed
```

### 3.1 Intermediate Format — `TranscriptSegment[]`

All three parsing branches (Whisper, subtitle parse, raw text) must normalize their
output into the same shape before being sent to the LLM in step 6. This is what the
`TranscriptParser` interface in OOP_PATTERNS_GUIDE.md returns.

```json
{
  "segment_id": "string",
  "start_time": "HH:MM:SS or null",
  "end_time": "HH:MM:SS or null",
  "text": "string",
  "speaker": null
}
```

Notes:
- `start_time` / `end_time`: populated for `.mp4` (Groq Whisper returns segment-level
  timestamps) and `.vtt`/`.srt` (already timestamped in the file). `null` for
  `.txt`/`.md` unless the file happens to contain timestamps itself.
- `speaker`: **always `null` in Phase 1**, for all three branches — including `.mp4`.
  Groq Whisper transcribes audio to text with timestamps, but does not perform
  speaker diarization (identifying *who* is speaking). Attempting speaker ID from
  Whisper output alone is not reliable — this is intentionally deferred to Phase 2,
  where GPT Luna infers speaker from transcript content/context (see §4.2). Do not
  attempt to populate `speaker` in Phase 1 code — leave the field present but null,
  so Phase 2 only needs to fill it in, not add it.

**Failure handling:** any step in 5–7 can fail independently (Whisper timeout, LLM
error, malformed JSON). Each failure should set `status = failed` with a
`failure_reason` field — never leave a meeting stuck in `processing` indefinitely.
Worth deciding: is this retryable by the user, or does it need a new upload?

---

## 4. JSON Schema

The schema is organized into 5 layers. Layers 1-4 are Phase 1 (build now).
Layer 5 and attribution fields (`speaker`, `assignee`) are Phase 2.

Design principle: the schema must extract *meaning*, not just condense text.
A user reading the PDF should be able to answer "what was decided?", "what do I
need to do?", and "what's still unresolved?" without reading the transcript.

### 4.1 Layer 1 — Metadata (system-generated, no LLM)

```json
{
  "meeting_id": "uuid",
  "source_file_type": "mp4 | vtt | srt | txt | md",
  "transcript_source": "whisper | parsed | raw_text",
  "generated_by_model": "gpt-oss | gpt-luna",
  "generated_at": "ISO8601 timestamp",
  "duration": "HH:MM:SS or null",
  "language": "vi | en | mixed | null"
}
```

### 4.2 Layer 2 — Executive Summary (readable in 30 seconds)

```json
{
  "executive": {
    "tl_dr": "string — 1-2 sentences, the single most important takeaway",
    "overview": "string — one paragraph",
    "meeting_type": "standup | planning | review | brainstorm | other",
    "outcome_status": "decided | pending | informational"
  }
}
```

- `meeting_type` and `outcome_status` are constrained enums — the LLM must pick
  one of the listed values, never invent a new one.
- `outcome_status`: `decided` = concrete decisions were made, `pending` = discussed
  but unresolved, `informational` = no decisions expected (e.g. a briefing).

### 4.3 Layer 3 — Topics / Agenda Flow

This is the actual agenda as it happened, in chronological order. It answers
"what was discussed, in what order, and when".

```json
{
  "topics": [
    {
      "topic_id": "string",
      "title": "string — short topic label",
      "start_time": "HH:MM:SS or null",
      "end_time": "HH:MM:SS or null",
      "summary": "string — what was discussed on this topic",
      "importance": "high | medium | low",
      "keywords": ["string"]
    }
  ]
}
```

- Ordered by `start_time`. For sources without timestamps (`.txt`/`.md`), preserve
  the order they appear in the transcript and set times to `null`.
- `importance` lets the PDF renderer and UI de-emphasize or collapse off-topic
  chatter instead of giving every tangent equal weight.
- `keywords` exists for future search/filtering across meetings — keep to ~3-5 per topic.
- `topic_id` is the anchor that Layer 4 references. It must be unique within a meeting.

### 4.4 Layer 4 — Actionable Output (the real value of the summary)

```json
{
  "decisions": [
    {
      "decision_id": "string",
      "statement": "string — what was decided, stated plainly",
      "topic_id": "string — links to topics[].topic_id",
      "rationale": "string | null — why, only if explicitly stated"
    }
  ],
  "action_items": [
    {
      "task_id": "string",
      "description": "string — what needs to be done",
      "topic_id": "string — links to topics[].topic_id",
      "due_hint": "string | null — raw text of any deadline mentioned",
      "assignee": null
    }
  ],
  "open_questions": [
    {
      "question_id": "string",
      "question": "string — what was raised but not resolved",
      "topic_id": "string — links to topics[].topic_id",
      "blocker": true
    }
  ]
}
```

**Important — `action_items` is Phase 1, not Phase 2.** Extracting *what needs to be
done* does not require GPT Luna; `gpt-oss` can do it. Only `assignee` (*who* does it)
needs GPT Luna. So the array ships in Phase 1 with `assignee` always `null`, and
Phase 2 fills that one field in. Do not defer the whole array.

- `due_hint` holds the raw phrase as spoken ("next week", "before Sep 17"), not a
  parsed date. Normalization into an actual date happens in Layer 5 (Phase 2).
- `rationale` is `null` unless the reason was explicitly stated — see §4.6.
- `blocker`: true if the unresolved question prevents work from continuing.

### 4.5 Layer 5 — References (Phase 2, spec only)

```json
{
  "temporal_references": [
    {
      "raw_text": "string — e.g. 'trước 17/9', 'next sprint'",
      "normalized_date": "ISO8601 date | null",
      "topic_id": "string"
    }
  ],
  "entities": [
    {
      "name": "string",
      "type": "person | project | tool | organization"
    }
  ],
  "links_mentioned": ["string"]
}
```

Note the distinction from Layer 3: `topics[].start_time` is a *position in the
recording* (used for navigation). `temporal_references[].raw_text` is a *date
mentioned in the conversation* (used for deadlines). These are different things
and must not be merged into one field — merging them causes the LLM to confuse
"minute 14 of the meeting" with "due on the 14th".

### 4.6 Phase 2 — Attribution Fields

Phase 2 fills in fields that already exist in the Phase 1 schema rather than
adding new ones, so the PDF renderer and any Phase 1 consumer keep working unchanged:

| Field | Phase 1 | Phase 2 (GPT Luna) |
|---|---|---|
| `TranscriptSegment.speaker` | always `null` | inferred speaker name/label |
| `action_items[].assignee` | always `null` | inferred assignee |
| `temporal_references[]` | omitted | populated (Layer 5) |
| `entities[]` | omitted | populated (Layer 5) |

Optionally add `confidence: "high" | "medium" | "low"` to attributed fields in
Phase 2 so low-confidence guesses can be visually flagged in the PDF rather than
presented as fact.

### 4.7 Anti-Hallucination Rules (must be in the LLM prompt)

More fields means more surface area for the model to invent content — especially
`gpt-oss` in dev. These rules are mandatory in the system prompt:

1. If a field cannot be grounded in the transcript, return `null` (or an empty
   array) — never guess, never fill with plausible-sounding filler.
2. `decisions[]` only contains things actually agreed on. Discussion without
   agreement belongs in `open_questions[]`, not `decisions[]`.
3. `rationale` and `due_hint` are `null` unless explicitly stated out loud.
4. Every `topic_id` referenced in Layer 4 must exist in `topics[]`. Validate this
   after parsing — dangling references mean the output is malformed, treat as failure.
5. Never populate `speaker` or `assignee` in Phase 1. They stay `null`.

### 4.8 Output Size Risk — Possible Multi-Call Split

A 1-hour meeting run through this schema can produce output long enough to hit
`max_tokens` and get truncated mid-JSON, which fails parsing entirely.

Mitigation, in order of preference:
1. **Single call** — try first, simplest.
2. **Split into two calls** if truncation occurs in testing:
   - Call 1: Layers 2 + 3 (`executive` + `topics`)
   - Call 2: Layer 4 (`decisions`, `action_items`, `open_questions`), passing the
     `topics[]` from call 1 as context so `topic_id` references stay valid.
3. **Chunk the transcript** by time window for very long meetings, summarize each
   chunk into topics, then merge.

Decide which path after measuring real output length in dev — don't build the
split preemptively.

## 5. Model Configuration by Environment

| Environment | Model | Used for |
|---|---|---|
| Dev | `gpt-oss` | Summary JSON generation (Phase 1) |
| Prod | `GPT Luna` | Summary JSON generation (Phase 1) + speaker/assignee attribution (Phase 2, §4.6) |

This should be an env-driven config value (e.g. `LLM_MODEL` env var), not a hardcoded
string, so switching from dev to prod doesn't require a code change — just a
config/env update.

---

## 6. Supabase Persistence

- Raw file → Supabase Storage, path convention: `meetings/{meeting_id}/source.{ext}`
- Summary JSON → stored as a `jsonb` column on the meeting record (or a separate
  `meeting_summaries` table if you want versioning/history of regenerations)
- Meeting status field tracks: `draft -> processing -> completed | failed`

**Open question:** do you want to keep the raw transcript text (pre-LLM) stored
separately too, in case you need to re-run the LLM step later without re-transcribing
the MP4? Worth deciding now since it affects the Storage/table structure.

---

## 7. DoD Traceability

| DoD item | Covered by |
|---|---|
| Accept file, reject invalid | §2 |
| Save JSON to Supabase | §6 |
| gpt-oss (dev) / GPT Luna (prod) | §5 |
| Summary JSON identifies meaningful structure | §4.2-4.4 (Layers 2-4, Phase 1) |
| Speaker + assignee attribution (GPT Luna only) | §4.6 (spec only, not wired to dev) |

---

## 8. Open Questions (need answers before/while dev builds this)

1. Max file size limit for MP4 uploads — what's the number?
2. Retry behavior on `failed` status — auto-retry, manual retry, or new upload only?
3. Keep raw pre-LLM transcript text in storage, or discard after JSON is generated?
4. Versioning: if a meeting's JSON is regenerated (e.g. re-run with GPT Luna after
   using gpt-oss in dev), overwrite or keep history?
5. PDF rendering of empty sections: if `decisions[]` or `open_questions[]` comes back
   empty, hide the section entirely rather than printing an empty heading. Confirm
   this with whoever builds the PDF renderer.
6. Single LLM call vs. two-call split (§4.8) — needs a real measurement in dev on a
   long meeting before deciding.