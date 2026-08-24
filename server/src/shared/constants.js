// Shared enums/limits mirroring MODELS.md §1 and ENDPOINTS.md §7. Keep this and
// client/src/utils/constants.js in sync.

export const MEETING_STATUS = Object.freeze({
  DRAFT: 'draft',
  UPLOADED: 'uploaded',
  TRANSCRIBING: 'transcribing',
  TRANSCRIBED: 'transcribed',
  SUMMARIZING: 'summarizing',
  COMPLETED: 'completed',
  FAILED: 'failed',
});

// Fixed lookup per status — exists so the progress bar moves, it is not a
// measurement. See ARCHITECTURE.md §4.1.
export const STATUS_PROGRESS = Object.freeze({
  [MEETING_STATUS.DRAFT]: 0,
  [MEETING_STATUS.UPLOADED]: 0.1,
  [MEETING_STATUS.TRANSCRIBING]: 0.4,
  [MEETING_STATUS.TRANSCRIBED]: 0.6,
  [MEETING_STATUS.SUMMARIZING]: 0.8,
  [MEETING_STATUS.COMPLETED]: 1,
  [MEETING_STATUS.FAILED]: 1,
});

export const STATUS_STEP = Object.freeze({
  [MEETING_STATUS.DRAFT]: 'Waiting for a recording',
  [MEETING_STATUS.UPLOADED]: 'Queued for processing',
  [MEETING_STATUS.TRANSCRIBING]: 'Transcribing audio',
  [MEETING_STATUS.TRANSCRIBED]: 'Transcript ready',
  [MEETING_STATUS.SUMMARIZING]: 'Generating summary',
  [MEETING_STATUS.COMPLETED]: 'Completed',
  [MEETING_STATUS.FAILED]: 'Failed',
});

// Audio/video — sent to OpenAI Whisper (transcript.parsers/mp4.parser.js).
export const ALLOWED_AUDIO_VIDEO_MIME_TYPES = Object.freeze([
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/webm',
  'audio/flac',
  'audio/ogg',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

// Subtitles / plain text — parsed directly, no Whisper call. See
// FROM_MEETING_TO_JSON_PLAN.md §3. MIME sniffing for .srt is unreliable (no
// registered type), so the validator accepts these primarily by extension —
// this list is the secondary sanity check, not the primary gate.
export const ALLOWED_TEXT_MIME_TYPES = Object.freeze([
  'text/vtt',
  'application/x-subrip',
  'text/plain',
  'text/markdown',
]);

export const ALLOWED_UPLOAD_MIME_TYPES = Object.freeze([
  ...ALLOWED_AUDIO_VIDEO_MIME_TYPES,
  ...ALLOWED_TEXT_MIME_TYPES,
]);

export const ALLOWED_UPLOAD_EXTENSIONS = Object.freeze([
  '.mp3', '.m4a', '.wav', '.webm', '.flac', '.ogg',
  '.mp4', '.mov',
  '.vtt', '.srt', '.txt', '.md',
]);

// One place for the status machine (OOP_PATTERNS_GUIDE.md §3: a guard
// function, not a class-based State pattern — 7 states doesn't earn one
// either). `failed` has two forward edges because retry re-enters at the
// earliest incomplete stage (ARCHITECTURE.md §4.1): back to `transcribing`
// if no transcript exists yet, or straight to `summarizing` (resummarize) if
// one does. Every other edge is strictly forward.
//
// `transcribed` additionally allows `completed`/`failed` directly, not just
// `summarizing` — processing.events.js and summary.events.js both listen to
// the same `transcript:created` event and race (nothing makes one wait for
// the other): summary generation can finish and emit `summary:created` or
// `pipeline:failed` before processing's own `markTranscribed` ->
// `markSummarizing` write has landed. Without this, that race leaves the
// meeting stuck at `transcribed` forever even though the summary genuinely
// succeeded (or failed) — reproduces reliably with MOCK_AI=true, where the
// mock summary generator has no artificial delay to lose the race with.
const MEETING_STATUS_TRANSITIONS = Object.freeze({
  [MEETING_STATUS.DRAFT]: [MEETING_STATUS.UPLOADED],
  [MEETING_STATUS.UPLOADED]: [MEETING_STATUS.TRANSCRIBING],
  [MEETING_STATUS.TRANSCRIBING]: [MEETING_STATUS.TRANSCRIBED, MEETING_STATUS.FAILED],
  [MEETING_STATUS.TRANSCRIBED]: [MEETING_STATUS.SUMMARIZING, MEETING_STATUS.COMPLETED, MEETING_STATUS.FAILED],
  [MEETING_STATUS.SUMMARIZING]: [MEETING_STATUS.COMPLETED, MEETING_STATUS.FAILED],
  [MEETING_STATUS.COMPLETED]: [MEETING_STATUS.SUMMARIZING],
  [MEETING_STATUS.FAILED]: [MEETING_STATUS.TRANSCRIBING, MEETING_STATUS.SUMMARIZING],
});

export function isValidTransition(from, to) {
  return MEETING_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// point_category enum — mirrors MODELS.md §1. Topic tagging the brief requires.
export const POINT_CATEGORIES = Object.freeze([
  'decision', 'action', 'question', 'blocker', 'risk', 'discussion',
]);

// FROM_MEETING_TO_JSON_PLAN.md §4.1: caps the summarization prompt enforces
// and the validator re-checks, not just a service-layer afterthought.
export const MAX_SUMMARY_POINTS = 25;
export const MAX_ACTION_ITEMS = 20;
export const MAX_SUMMARY_SPEAKERS = 12;
