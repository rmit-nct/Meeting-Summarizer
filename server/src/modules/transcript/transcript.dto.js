// Shapes transcript rows for the API boundary. Composes with shared/dto.js.
// Not part of the original scaffold — added alongside overview.service.js,
// which is the only consumer (ENDPOINTS.md §2's `transcript` slice).
import { shape } from '../../shared/dto.js';

// segments are stored as { id, start, end, text } in SECONDS (Whisper's
// native unit, AI_INTEGRATION.md §2); the client's TranscriptView works in
// milliseconds (utils/format.js's formatTimestamp) — converted once here so
// no component re-derives it. There is no per-segment speaker: Whisper
// doesn't diarize (AI_INTEGRATION.md §4) — TranscriptView already renders
// gracefully when a segment has no speakerId.
export function toTranscriptDto(row) {
  if (!row) return null;
  const { fullText, segments, language } = shape(row);
  return {
    fullText,
    language,
    segments: (segments ?? []).map((s) => ({
      id: String(s.id),
      startMs: Math.round(s.start * 1000),
      endMs: Math.round(s.end * 1000),
      text: s.text,
    })),
  };
}
