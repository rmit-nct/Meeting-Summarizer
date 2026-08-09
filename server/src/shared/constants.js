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

export const ALLOWED_UPLOAD_MIME_TYPES = Object.freeze([
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
