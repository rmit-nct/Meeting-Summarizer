# From Meeting to JSON — Implementation Plan

**Status:** Planning only. No code changes in this document.
**Reconciles:** `TRANSCRIPT_UPLOAD_SPEC.md` (draft, untracked) against the already-built
`transcript` module and the already-committed `AI_INTEGRATION.md` / `MODELS.md` /
`ENDPOINTS.md`. Per `docs/CLAUDE.md` §3, `ARCHITECTURE.md` and its dependent docs win over
a conflicting draft — this plan says explicitly, section by section, where the draft is
adopted as-is, where it's adapted, and where it's dropped in favor of what's already shipped.

---

## 1. Where the draft spec and the shipped code disagree

`transcript.service.js` (Whisper leg) is already built and working — read it before this
plan; it's the ground truth for everything downstream. `TRANSCRIPT_UPLOAD_SPEC.md` was
written at the "what should this look like" stage and gets several things out of sync with
what actually exists now:

| Topic | Draft spec says | Already shipped / established doc says | Resolution |
| --- | --- | --- | --- |
| Model names | `gpt-oss` (dev), `GPT Luna` (prod) | `GROQ_TRANSCRIPTION_MODEL` / `GROQ_SUMMARY_MODEL` env vars, defaulting to `whisper-large-v3` / `llama-3.3-70b-versatile` (`config/env.js`, already env-driven per the spec's own §5 request) | **Keep the shipped Groq config.** The brief requires "Groq API"; the spec's names are almost certainly a placeholder from an earlier draft, not a real second provider. If a second provider is genuinely intended, that's a bigger architecture decision (new SDK, new config module, new `ARCHITECTURE.md` §0 entry) — out of scope for this plan; flagged in §9. |
| Summary shape | Flat `summary.sections[]` (timeline chunks with `title`/`content`/`start_time`/`end_time`), speaker added to each section only in a later "Phase 2" | `summaries` + `summary_points` + `speakers` + `action_items` relational tables (`MODELS.md` §2); LLM output shape `{ overview, speakers[], points[], actionItems[] }` (`AI_INTEGRATION.md` §3); frontend already renders this exact shape (`ENDPOINTS.md` §2, `client/src/utils/mockData.js`) | **Drop `sections[]`.** It has no consumer — the built `SummaryView`/`ActionItemList`/`SpeakerLegend` components and the `GET /:id` aggregate all expect points+speakers+actionItems, not timeline sections. Re-deriving a section view from `points[].startMs` later is possible if a timeline UI is ever wanted; inventing a second, competing shape now is not. |
| Speaker + task attribution timing | "Phase 2, GPT Luna required, spec only" — implies a **separate** pass after Phase 1 | `AI_INTEGRATION.md` §4 already decided **A + B**: the same Llama call infers speakers and owners inline (turn-taking, self-introduction), `SpeakerLegend` lets the user correct it | **No Phase 2 needed.** Speaker labels and action-item owners are already part of the single-call schema in §4 below. There is no "attribution comes later" step to build. |
| Persist raw JSON | "jsonb column on the meeting record (or a separate `meeting_summaries` table)" | `summaries.raw_response jsonb` already exists for exactly this (`MODELS.md` §2) | **Already solved** — use the existing column, nothing new to add. |
| Keep raw pre-LLM transcript? (open question §8.3) | Undecided | `transcripts.full_text` + `transcripts.segments` already persist the pre-summarization transcript, independent of `summaries` | **Already solved** — re-running summarization without re-transcribing is exactly what `POST /:id/resummarize` does today (`ENDPOINTS.md` §3). |
| Versioning: overwrite or keep history? (open question §8.4) | Undecided | `summaries` is one-to-one with `meetings` (`unique meeting_id`); `resummarize` "replaces `summaries`, `summary_points`, `speakers`; action items are merged, not replaced" | **Already solved, overwrite** — see §9 for the full answer. |
| Accepted file types | `.mp4`, `.vtt`/`.srt`, `.txt`/`.md` | `ENDPOINTS.md` §7 allowlist is audio/video MIME types only; `transcript.service.js` only implements the Whisper leg | **New, real gap.** This is the one part of the draft that adds a genuine requirement not yet built. Planned in §3. |
| Max upload size (open question §8.1) | "TBD" | `MAX_UPLOAD_BYTES` already defaults to 500 MB (`config/env.js`, `ENDPOINTS.md` §7) | **Already solved** — see §9. |
| Retry behavior (open question §8.2) | Undecided | Not fully wired: `POST /:id/process` currently only accepts `status='uploaded'`, so a `failed` meeting has no path back in | **Real gap**, small fix. Planned in §8. |

Net effect: the draft's **flow shape** (upload → validate → branch by type → transcript →
LLM → validate JSON → persist → status flip) is correct and is what this plan builds on.
Its **JSON schema** and **phasing** are superseded by what's already shipped. Its
**file-type coverage** is a real, adoptable addition.

---

## 2. End-to-end flow (updated)

```
1. Meeting exists as `draft` (POST /api/meetings, meeting module — already built)
2. POST /:id/upload — meeting module validates MIME + size, issues a signed Storage URL,
   writes source_type/original_filename/mime_type/size_bytes/storage_path,
   status: draft -> uploaded                                    [ALREADY BUILT]
3. Browser PUTs the file straight to Supabase Storage using the signed URL
   (bytes never touch the API — CLAUDE.md rule #6)               [ALREADY BUILT]
4. POST /:id/process — processing module asserts status === 'uploaded',
   status: uploaded -> transcribing, emits `meeting:uploaded`     [ALREADY BUILT]
5. transcript module, listening on `meeting:uploaded`:
   a. Branch by file kind (NEW — see §3):
      - audio/video -> download, ffmpeg normalize, chunk if needed, Whisper   [BUILT]
      - .vtt / .srt -> download, parse into {id, start, end, text} segments  [NEW]
      - .txt / .md  -> download, treat as one full-text blob, no segments    [NEW]
   b. Persist to `transcripts` (full_text, segments, language, model, word_count)
   c. status: transcribing -> transcribed (meetingInterface.markTranscribed) [BUILT,
      currently only reachable from the audio branch — needs the same call from the
      new branches, see §3]
   d. Emit `transcript:created`                                              [BUILT]
   e. Any failure at (a)-(b): emit `pipeline:failed` with a typed code       [BUILT]
6. summary module, listening on `transcript:created`               [NOT BUILT — this plan's
   main deliverable is the contract it must satisfy]:
   a. status: transcribed -> summarizing
   b. Build the numbered-segment prompt (AI_INTEGRATION.md §3 "Input")
   c. Call Groq Llama with `response_format: json_object` against the schema in §4
   d. Defensive parse: strip fences -> extract outer {} -> Zod validate -> retry once on
      failure with the validation errors appended -> fail the pipeline if still invalid
   e. Store the raw string in `summaries.raw_response` BEFORE normalizing
   f. Normalize into `summaries` (+overview/model/prompt_version), `speakers`,
      `summary_points`, and emit `summary:action-items-extracted` for the action-item
      module to seed `action_items` (never written directly — module boundary)
   g. status: summarizing -> completed
   h. Any failure at (b)-(f): emit `pipeline:failed`
7. processing module, listening on `pipeline:failed` (already the pattern used by
   transcript's own failures) [PARTIALLY BUILT — verify a listener exists that turns
   `pipeline:failed` into `meetingInterface.markFailed` + `meeting:failed` socket event;
   if not, that's a small missing piece, not part of this plan's JSON-schema scope]:
   - status -> failed, error_message set to a readable message, socket emits
     `meeting:failed`
```

Everything in step 6 is what "design a very detailed, AI-understandable JSON schema before
storing into the database" is actually about. §4 is the answer.

---

## 3. New requirement: multi-format ingestion

Not built yet, needed to satisfy the draft spec's file-type table. Changes needed (planning
only — implementation is a separate, later step):

- **`shared/constants.js`**: extend `ALLOWED_UPLOAD_MIME_TYPES` with the text/subtitle
  kinds. MIME sniffing is unreliable for `.srt` (no registered type; browsers send
  `application/x-subrip`, `text/plain`, or nothing) — **decide acceptance primarily by file
  extension**, with MIME as a secondary sanity check only, not the primary gate the way
  audio/video already is.
- **`meeting.validator.js`**: same signed-URL upload path for every accepted type (no
  special-cased "small text files go straight through the API" branch — that would violate
  the "one upload path" simplicity and isn't needed at these file sizes).
- **`transcript.service.js`**: add a dispatcher at the top of `transcribeMeeting` that
  branches on `meeting.mime_type` / extension instead of always running
  `runWhisperPipeline`:
  - `.vtt`/`.srt` → download, parse cue blocks into `{ id, start, end, text }` (this is
    exactly the `transcripts.segments` shape already used for Whisper output — no schema
    change needed on that column).
  - `.txt`/`.md` → download, use file content as `full_text`, `segments: []`,
    `language: null` unless trivially detectable.
  - Every branch still calls `meetingInterface.markTranscribed` and emits
    `transcript:created` — the summary module (§6) must not need to know which branch
    produced the transcript it's consuming. This is the reason `transcripts.segments` was
    designed as a generic array in the first place.
- **`transcripts` table**: consider adding a `source_kind` enum column
  (`whisper | parsed_vtt | parsed_srt | raw_text`) so `transcripts.model` (currently
  `whisper-large-v3`-only in practice) doesn't have to overload meaning by storing a fake
  "model name" like `'parsed:srt'`. This is a one-line migration, additive, does not touch
  existing rows' meaning. Worth doing in the same PR as the parser branches, not later.
- **Empty-transcript failure** (`AI_INTEGRATION.md` §6) applies identically to the new
  branches — an empty `.txt` file or a `.vtt` with no cues fails the same way a silent
  recording does.

---

## 4. The JSON Schema — LLM summarization output contract

This is the single most important artifact in this plan: what the model is asked to
return, field by field, and why each field is shaped the way it is. It supersedes
`AI_INTEGRATION.md` §3's "Expected JSON" only by making every rule explicit and machine
enforceable — it does not change that section's actual field set.

### 4.1 Design principles (why it's shaped this way)

1. **Flat and closed.** Groq's `response_format: json_object` (JSON mode) guarantees
   syntactically valid JSON, not a particular shape. The schema is therefore kept flat
   (no nested unions, no optional-vs-missing ambiguity — every field is either present or
   explicitly `null`) so a hand-written Zod schema can validate it deterministically.
2. **Every array item is independently addressable within the same response**, via a
   `tempId` the model assigns and reuses for cross-references (a point citing its speaker,
   an action item citing its owner). Real database UUIDs don't exist yet at this stage —
   `tempId` is how normalization (§5) rebuilds the relational links without a second LLM
   round-trip.
3. **Nothing is invented.** Every nullable field's prompt instruction is "use `null` if not
   stated" — this is already the rule in `AI_INTEGRATION.md` §5 for `dueDate`; this schema
   applies the same discipline to `speakerTempId`, `ownerTempId`, and `startMs`.
4. **Bounded.** Hard caps on every array match `AI_INTEGRATION.md` §3's "cap at 25 points
   and 20 action items" — stated here as explicit numbers the prompt enforces and the
   validator re-checks, not just a service-layer afterthought.
5. **Self-describing enough to survive a schema change.** `schemaVersion` and
   `promptVersion` are separate: `schemaVersion` changes only if this JSON *shape* changes;
   `promptVersion` (already `summaries.prompt_version` in `MODELS.md`) bumps on any wording
   change to the prompt, even if the shape doesn't move. This lets old rows stay
   interpretable per `AI_INTEGRATION.md` §5.

### 4.2 The schema

```jsonc
{
  // Bump only if this JSON shape changes. Lets old raw_response rows stay parseable
  // by whichever version of the normalizer reads them later.
  "schemaVersion": "1.0",

  // BCP-47-ish, model's best guess of the transcript's primary language (meetings may be
  // vi or en — AI_INTEGRATION.md §2). Used to pick the search/highlight locale; never
  // invented if genuinely mixed — use the dominant language.
  "language": "en",

  // 2-3 sentence abstract. -> summaries.overview
  "overview": "The team confirmed the deadline moved to the 17th and reassigned the Gantt chart update to Minh.",

  // One entry per DISTINCT speaker the model can distinguish by turn-taking. Always at
  // least one entry if the transcript has any content. -> speakers table, one row each.
  "speakers": [
    {
      // Stable ONLY within this response. Referenced by points[].speakerTempId and
      // actionItems[].ownerTempId below. Not a database id.
      "tempId": "spk_1",

      // MUST follow "Speaker N" (N = 1-based, order of first appearance) unless a name is
      // unambiguously stated (self-introduction or being addressed by name).
      // -> speakers.label
      "label": "Speaker 1",

      // Only set when a real name was explicitly heard — never guessed from tone/role.
      // -> not persisted directly; surfaced to the user as a suggested display_name they
      // can accept or edit via PATCH /:id/speakers (display_name stays user-owned).
      "nameGuess": null,

      // One short quote or paraphrase grounding the distinction — required, not decorative.
      // Not persisted; exists so a human reviewing raw_response can audit the guess.
      "evidence": "First to speak; opens the meeting and sets the agenda."
    },
    {
      "tempId": "spk_2",
      "label": "Speaker 2",
      "nameGuess": "Minh",
      "evidence": "Addressed directly as 'Minh, can you take the Gantt chart?' and replies in first person."
    }
  ],

  // The bullet points. Cap: 25. -> summary_points, one row each, order_index = array index.
  "points": [
    {
      "tempId": "pt_1",

      // One factual sentence. No filler, no meta-commentary ("the team discussed...").
      // -> summary_points.content
      "content": "The deadline moved from September 10 to September 17.",

      // Exactly one of: decision | action | question | blocker | risk | discussion.
      // Matches point_category in MODELS.md §1 exactly — do not introduce a new value
      // without a migration. -> summary_points.category
      "category": "decision",

      // References speakers[].tempId, or null if the point isn't attributable to one
      // turn (e.g. a summary of back-and-forth). -> resolved to summary_points.speaker_id
      // during normalization.
      "speakerTempId": "spk_1",

      // Milliseconds into the transcript, taken from the nearest cited segment's start —
      // never interpolated/estimated beyond what the segment timestamps give. Null when
      // the source transcript has no timestamps (raw .txt/.md, per §3).
      // -> summary_points.start_ms
      "startMs": 4000
    },
    {
      "tempId": "pt_2",
      "content": "Minh will redo the Gantt chart tonight.",
      "category": "action",
      "speakerTempId": "spk_2",
      "startMs": 11000
    }
  ],

  // Cap: 20. A point CAN also produce an action item — they are not mutually exclusive;
  // "action" category in points is the topic tag, this array is the structured task.
  // -> action_items, via the summary:action-items-extracted event (never written directly
  // by the summary module — module boundary, ARCHITECTURE.md §2.2).
  "actionItems": [
    {
      "tempId": "ai_1",

      // Imperative task phrase, not a restatement of the whole sentence.
      // -> action_items.content
      "content": "Redo the Gantt chart with the new deadline.",

      // References speakers[].tempId if the owner is a detected speaker.
      // -> resolved to action_items.owner_id during normalization.
      "ownerTempId": "spk_2",

      // Free-text fallback ONLY when an owner is stated but is not one of the detected
      // speakers (e.g. "someone from design will handle it"). Mutually exclusive with
      // ownerTempId in practice, but both are allowed to be null together (no owner
      // stated at all). -> action_items.owner_label
      "ownerLabelFallback": null,

      // ISO YYYY-MM-DD only. MUST be null if the transcript says something relative
      // ("next Friday") or doesn't state a date — never resolved against wall-clock time
      // by the model. The normalizer does not attempt this resolution either (see §5.3).
      // -> action_items.due_date
      "dueDate": null,

      // Traceability back to the point that mentioned this task, if any. Optional link,
      // not persisted as a column — used only for prompt debugging / eval, safe to ignore
      // downstream.
      "sourcePointTempId": "pt_2"
    }
  ]
}
```

### 4.3 Field-level rules the prompt must state verbatim

These extend, not replace, the bullet list already in `AI_INTEGRATION.md` §5:

- Return exactly one JSON object matching this shape. No prose before or after it, no
  markdown fences.
- `tempId` values must be unique within their own array and must use the prefixes shown
  (`spk_`, `pt_`, `ai_`) — the normalizer keys off the prefix to route validation errors
  back to the right array without re-deriving it.
- Every `speakerTempId` / `ownerTempId` must reference a `tempId` that actually exists in
  `speakers[]`. A dangling reference is a validation failure, not a soft warning (see §5.2).
- `points` and `actionItems` arrays must each be ordered the way they should display —
  `order_index` is the array index, not a separately stated field.
- If the transcript has fewer than 25 meaningful points or 20 action items, return fewer.
  Never pad to hit a count.

### 4.4 Worked failure example (for the prompt's negative guidance)

Include one *bad* example inline in the system prompt showing a dangling reference and an
invented date, each marked with why it's wrong — `AI_INTEGRATION.md` §5's "do not invent"
rule is easy for a 70B model to violate under-specified; a concrete counter-example reduces
that more reliably than a restated abstract rule.

---

## 5. Defensive parsing & normalization (raw string → relational rows)

Layered per `AI_INTEGRATION.md` §3 "Parsing", made concrete for this schema:

### 5.1 Parse
1. Strip markdown code fences if present.
2. If stray prose surrounds the JSON, extract the outermost balanced `{...}` span.
3. `JSON.parse`. Failure here → do **not** retry the parse; go straight to the one
   model-retry in §5.2 (a syntactically broken response is not worth re-parsing, it needs
   different output).

### 5.2 Validate (Zod — illustrative shape only, actual file is a later implementation step)

```js
// summary.validator.js — SHAPE ONLY, not final code
const SpeakerSchema = z.object({
  tempId: z.string().regex(/^spk_\d+$/),
  label: z.string().min(1),
  nameGuess: z.string().nullable(),
  evidence: z.string().min(1),
});

const PointSchema = z.object({
  tempId: z.string().regex(/^pt_\d+$/),
  content: z.string().min(1),
  category: z.enum(['decision', 'action', 'question', 'blocker', 'risk', 'discussion']),
  speakerTempId: z.string().nullable(),
  startMs: z.number().int().nonnegative().nullable(),
});

const ActionItemSchema = z.object({
  tempId: z.string().regex(/^ai_\d+$/),
  content: z.string().min(1),
  ownerTempId: z.string().nullable(),
  ownerLabelFallback: z.string().nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  sourcePointTempId: z.string().nullable(),
});

const SummaryResponseSchema = z.object({
  schemaVersion: z.literal('1.0'),
  language: z.string(),
  overview: z.string().min(1),
  speakers: z.array(SpeakerSchema).min(1).max(12),
  points: z.array(PointSchema).max(25),
  actionItems: z.array(ActionItemSchema).max(20),
}).superRefine((data, ctx) => {
  // cross-reference check: every speakerTempId/ownerTempId must resolve within this
  // response — this is the check Zod's shape rules alone can't express.
});
```

On failure: capture the Zod error paths, retry **once** with the errors appended to the
user prompt ("your previous response was invalid: <errors>. Return a corrected JSON
object."), matching `AI_INTEGRATION.md` §3 step 4. A second failure → `pipeline:failed`
with `summarization_failed` and `raw_response` still written (§5.4) so the row is
debuggable.

### 5.3 Normalize (tempId → DB row)

Order matters — speakers must be inserted first so their real UUIDs exist before points
and action items reference them:

1. Insert `summaries` row (`overview`, `model`, `prompt_version`, `raw_response`).
2. Insert `speakers` rows from `speakers[]`; build an in-memory `Map<tempId, realId>`.
   `label` is stored as returned; `nameGuess` is surfaced to the client as a suggestion but
   does **not** auto-populate `display_name` — the user accepts it explicitly via
   `PATCH /:id/speakers` (keeps "model-produced label is immutable, display_name is
   user-owned" from `MODELS.md` §2 intact).
3. Insert `summary_points` rows, resolving `speakerTempId` through the map (`null` stays
   `null`, never a lookup failure at this stage — that was already caught in §5.2's
   cross-reference check).
4. Emit `summary:action-items-extracted` with the `actionItems[]` array, `ownerTempId`
   already resolved to real speaker UUIDs (or `null`) — the `action-item` module receives
   ready-to-insert data and never sees a `tempId`. This preserves the module boundary: only
   `summary` knows the LLM response shape.

### 5.4 Order of writes vs. status

`raw_response` is written in step 5.3.1, **before** points/action-items are inserted — if
normalization dies partway (e.g. a Supabase error on `summary_points` insert), the raw
model output is still on disk for debugging, matching `AI_INTEGRATION.md` §3's "Store the
untouched string... before parsing" (here: before *fully normalizing*, since parsing
already succeeded by this point).

---

## 6. Persistence mapping (schema field → table.column)

| JSON path | Table.column | Notes |
| --- | --- | --- |
| (whole response, pre-parse string) | `summaries.raw_response` | jsonb, never serialized to client (`MODELS.md` §2) |
| `overview` | `summaries.overview` | |
| — | `summaries.model` | not from the response — set by the service to `env.GROQ_SUMMARY_MODEL` |
| — | `summaries.prompt_version` | not from the response — set by the service from `summary.prompts.js`'s `PROMPT_VERSION` |
| `speakers[].label` | `speakers.label` | immutable once written |
| `speakers[].nameGuess` | *(not persisted directly)* | returned to client as a one-time suggestion only |
| `points[].content` | `summary_points.content` | |
| `points[].category` | `summary_points.category` | must already be a valid `point_category` enum value post-Zod |
| `points[].speakerTempId` → resolved | `summary_points.speaker_id` | nullable |
| `points[].startMs` | `summary_points.start_ms` | nullable |
| array index of `points[]` | `summary_points.order_index` | |
| `actionItems[].content` | `action_items.content` | via `summary:action-items-extracted`, not direct write |
| `actionItems[].ownerTempId` → resolved | `action_items.owner_id` | nullable |
| `actionItems[].ownerLabelFallback` | `action_items.owner_label` | nullable |
| `actionItems[].dueDate` | `action_items.due_date` | nullable, ISO only |
| array index of `actionItems[]` | `action_items.order_index` | |

---

## 7. Failure handling matrix (additions to `AI_INTEGRATION.md` §6)

| Failure | Handling |
| --- | --- |
| Zod validation fails twice (initial + one retry) | `pipeline:failed`, code `summarization_failed`, `raw_response` already persisted from the first successful parse (if step 5.1 succeeded but 5.2 didn't) or `null` (if 5.1 itself failed both times) |
| Dangling `tempId` reference (`speakerTempId`/`ownerTempId` not in `speakers[]`) | Treated as a Zod `superRefine` failure — same retry-once path as any other validation failure, not silently nulled out |
| `.vtt`/`.srt` parse produces zero cues, or `.txt`/`.md` is empty | Same `transcription_failed` / "No speech detected" failure as an empty Whisper result (§3) — summary module never runs |
| Normalization insert fails after successful validation (DB error) | `pipeline:failed`, code `internal_error`; `raw_response` is already durable, so this is retryable by re-running `POST /:id/resummarize` once the DB issue is fixed, without re-calling the LLM |

---

## 8. The one real process gap: retry from `failed`

`processing.service.js#startProcessing` currently only accepts `meeting.status ===
'uploaded'`. A meeting that reaches `failed` (whether the failure was in transcription or
summarization) has no documented way back in. Two existing endpoints already cover the two
cases; the gap is just that `failed` isn't in either's allowed-status set yet:

- **Failed before a transcript exists** (Whisper/parse failure): retry should mean
  re-running the whole pipeline. `POST /:id/process` should accept `status === 'failed'`
  **and** `transcripts` has no row for this meeting, transitioning `failed -> transcribing`
  the same way `uploaded -> transcribing` works today.
- **Failed after a transcript exists** (summarization failure): retry should mean
  `POST /:id/resummarize`, which already exists and already only requires a transcript to
  be present (`ENDPOINTS.md` §3) — this path likely already works once
  `resummarize`'s own status guard is checked against `failed`.

This is a small, precise change to `processing.service.js`'s status guard, not a new
endpoint. Flagged here because the summary module's failure path (§7) is the first thing
that will actually exercise a `failed`-with-transcript-present state.

---

## 9. Answers to `TRANSCRIPT_UPLOAD_SPEC.md` §8 open questions

1. **Max file size:** already answered — `MAX_UPLOAD_BYTES`, default 500 MB
   (`config/env.js`, `ENDPOINTS.md` §7). No new decision needed.
2. **Retry behavior:** answered in §8 above — reprocess from scratch if no transcript
   exists yet, `resummarize` if it does. Not auto-retry; user-triggered via the existing UI
   affordance already implied by `AI_INTEGRATION.md` §6 ("offer Retry in the UI").
3. **Keep raw pre-LLM transcript text?** Already yes — `transcripts.full_text` is permanent,
   independent of `summaries`, exactly so `resummarize` doesn't need to re-transcribe.
4. **Versioning — overwrite or history?** Overwrite, already the shipped design:
   `summaries` is one-to-one per meeting (`unique meeting_id`); `resummarize` replaces
   `summaries`/`summary_points`/`speakers` wholesale and merges `action_items` (never wipes
   user-ticked items). No versioning table is planned — if the project later wants
   summary history, that's a new table and a new decision, not implied by anything current.

---

## 10. What this plan does NOT cover

- Live-session summarization (`live-session` module) — different data shape
  (`rolling_summary`, incremental), explicitly out of scope per `ARCHITECTURE.md` §3.3 and
  `docs/CLAUDE.md` §5 (stretch goal, not Core).
- The actual Zod file, prompt text, or service code — §5.2's Zod block is illustrative only,
  written to pin down the *shape* of the validation, not to be copy-pasted verbatim.
- The `meeting.controller.js`/`meeting.service.js` gap (still empty per `docs/CLAUDE.md`
  §0) — unrelated to this plan; meetings can already reach `uploaded` via what's built.
- Whether a second LLM provider (matching the draft's "GPT Luna" naming) is actually
  wanted. If yes, that's a `config/` + `ARCHITECTURE.md` change to make explicitly, not an
  assumption to bake into the schema above.

---

## 11. Suggested implementation order (once this plan is approved)

1. `shared/constants.js` + `meeting.validator.js` + `config/upload.js`: extend accepted
   MIME/extensions for `.vtt`/`.srt`/`.txt`/`.md` (§3).
2. Migration: `transcripts.source_kind` enum column (§3), in the same PR as (1).
3. `transcript.service.js`: add the format dispatcher and the two new parse branches (§3).
   Existing Whisper branch and its retry/chunking logic is untouched.
4. `summary.prompts.js`: system + user prompt implementing §4's schema and §4.3's rules,
   with `PROMPT_VERSION` set.
5. `summary.validator.js`: the real Zod schema (§5.2).
6. `summary.service.js`: parse → validate → retry-once → normalize → persist (§5), listening
   on `transcript:created` via `summary.events.js` (currently a `TODO` stub).
7. `action-item` module: wire `summary.events.js`'s `TODO` listener for
   `summary:action-items-extracted` to actually insert rows (currently a `TODO` stub too).
8. `processing.service.js`: the `failed`-retry status-guard fix (§8).
9. Update `MODELS.md` (new column), `AI_INTEGRATION.md` (this schema supersedes its §3
   example — either replace that example or point to this file), and `ENDPOINTS.md` §7
   (new accepted MIME types) in the same commits that ship the corresponding code —
   per `docs/CLAUDE.md` rule #8.
