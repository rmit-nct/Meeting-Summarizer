// Shapes summary/point/speaker rows for the API boundary.
import { shape } from '../../shared/dto.js';

// MODELS.md §2: "UI shows coalesce(display_name, label)" — resolved once,
// here, so every consumer (SummaryView, TranscriptView, SpeakerLegend) reads
// a plain `displayName` and never re-implements the fallback.
function toSpeakerDto(row) {
  if (!row) return null;
  const { id, label, displayName, color } = shape(row);
  return { id, label, displayName: displayName ?? label, color: color ?? null };
}

function toPointDto(row) {
  const { id, content, category, startMs, orderIndex, speaker } = shape(row);
  return { id, content, category, startMs, orderIndex, speaker: speaker ? toSpeakerDto(speaker) : null };
}

export function toSummaryDto(summaryRow, pointRows) {
  if (!summaryRow) return null;
  const { overview, model, createdAt } = shape(summaryRow);
  return { overview, model, createdAt, points: (pointRows ?? []).map(toPointDto) };
}

export function toSpeakersDto(speakerRows) {
  return (speakerRows ?? []).map(toSpeakerDto);
}
