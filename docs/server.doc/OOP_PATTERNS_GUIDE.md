# OOP Patterns Guide — Transcript Upload Feature

**Purpose:** Tells Claude Code exactly which pattern to use where when implementing
the transcript upload flow. Do not introduce patterns not listed here — this feature
is intentionally kept lean (club project, hard deadline Sep 17, 2026).
**Related docs:** TRANSCRIPT_UPLOAD_SPEC.md, AI_INTEGRATION.md, ARCHITECTURE.md

---

## 1. File Parsing — Strategy + Factory

**Problem:** 5 file extensions, 3 distinct processing paths (Whisper, subtitle parse, raw text).
**Pattern:** Strategy pattern for the parsing logic, Factory to select the right strategy.

```
interface TranscriptParser {
  parse(file: UploadedFile): Promise<TranscriptSegment[]>
}

class Mp4Parser implements TranscriptParser { ... }      // sends to Groq Whisper
class SubtitleParser implements TranscriptParser { ... } // parses .vtt / .srt
class TextParser implements TranscriptParser { ... }     // reads .txt / .md as-is

class ParserFactory {
  static create(extension: string): TranscriptParser
}
```

**Rules for Claude Code:**
- All three parser classes implement the same `TranscriptParser` interface —
  same method signature, same return shape (`TranscriptSegment[]`).
- `ParserFactory.create()` is the ONLY place that maps extension → parser class.
  Never branch on file extension anywhere else in the codebase.
- Adding a new file type later = add one new class + one line in the factory.
  No existing parser class should need to change.

---

## 2. LLM Model Selection — Adapter (+ simple Strategy)

**Problem:** `gpt-oss` in dev, `GPT Luna` in prod, both need to produce the same
summary JSON shape. Model choice must be config-driven, not hardcoded.

```
interface SummaryGenerator {
  generateSummary(transcript: TranscriptSegment[]): Promise<SummaryJson>
}

class GptOssAdapter implements SummaryGenerator { ... }
class GptLunaAdapter implements SummaryGenerator { ... }

class SummaryGeneratorFactory {
  static create(): SummaryGenerator  // reads env var, e.g. LLM_MODEL
}
```

**Rules for Claude Code:**
- Model name/endpoint must come from an env var (e.g. `LLM_MODEL=gpt-oss` or
  `LLM_MODEL=gpt-luna`) — never hardcode "gpt-oss" or "gpt-luna" inside business logic.
- Both adapters must return the exact same `SummaryJson` shape defined in
  TRANSCRIPT_UPLOAD_SPEC.md §4.1, regardless of which model produced it.
- When Phase 2 (speaker/task attribution) gets wired in later, it will need its
  own method on this interface or a separate `AttributionGenerator` interface —
  do NOT bolt it onto `GptOssAdapter`, since gpt-oss can't do attribution at all.
  Leave a comment marker `// Phase 2: attribution not implemented for gpt-oss`.

---

## 3. Meeting Status Transitions — Guard function, NOT a full State pattern

**Problem:** Meeting status moves `draft → processing → completed | failed`.
Invalid transitions (e.g. `completed → draft`) should be rejected.

**Explicitly do NOT build a class-based State pattern here** — it's overkill for
4 states. Use a single validation function instead:

```
type MeetingStatus = "draft" | "processing" | "completed" | "failed"

function isValidTransition(from: MeetingStatus, to: MeetingStatus): boolean
```

**Rules for Claude Code:**
- Every place that updates meeting status must call `isValidTransition()` first
  and throw/reject if false.
- Keep the valid-transitions map in ONE place (e.g. a constant object), not
  scattered across route handlers.

---

## 4. Upload → JSON Pipeline — Plain orchestrator function, NOT Template Method

**Problem:** Fixed sequence: validate → store raw file → parse → generate summary →
validate JSON → save to Supabase → update status.

**Explicitly do NOT build an abstract base class with template methods** — a single
async orchestrator function is enough for a linear pipeline with no variant steps.

```
async function processMeetingUpload(meetingId: string, file: UploadedFile): Promise<void> {
  // 1. validate file            (§2 of TRANSCRIPT_UPLOAD_SPEC.md)
  // 2. store raw file            -> Supabase Storage
  // 3. status: draft -> processing
  // 4. parser = ParserFactory.create(extension)
  // 5. segments = await parser.parse(file)
  // 6. generator = SummaryGeneratorFactory.create()
  // 7. json = await generator.generateSummary(segments)
  // 8. validate json against schema
  // 9. save json to Supabase
  // 10. status: processing -> completed
  // on any failure in 4-9: status -> failed, store failure_reason
}
```

**Rules for Claude Code:**
- Each numbered step should be its own function, independently testable/mockable.
- The orchestrator function itself stays flat and readable — no branching logic
  beyond try/catch for the failure path.

---

## 5. Summary — What NOT to do

To keep this maintainable without over-engineering for a 4-person club project:

| Don't | Because |
|---|---|
| Class-based State pattern for meeting status | 4 states, one guard function is enough |
| Abstract base class / Template Method for the pipeline | Linear sequence, no variant behavior between steps |
| Singleton for the Supabase client | Just use a shared module export |
| Separate class per JSON schema version | Handle Phase 1 vs Phase 2 via additive fields (see spec §4.2), not inheritance |
| Generic "manager" or "helper" classes | Prefer named, single-purpose functions/classes tied to the tables above |

**Guiding rule:** if a pattern isn't listed in sections 1–4 above, don't introduce it
for this feature without checking in first.
