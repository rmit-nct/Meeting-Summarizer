// Adapts the composed GET /api/meetings/:id payload (overview.interface.js)
// into the shape export.model.js's buildDocumentModel() expects — close to
// the raw LLM SUMMARY_SCHEMA (flat speakerLabel strings, no ids), which is
// what export.markdown.js/export.pdf.js/export.docx.js were built and
// manually tested against (see export.test.manual.js's mock fixture).
//
// Real persisted data differs in two ways this bridges:
//   1. summary.points[].speaker is a nested {id,label,displayName,color}
//      object (or null), not a flat string.
//   2. A speaker's real inferred name lives in displayName, not label
//      (label is always the generic "Speaker N") — using label alone would
//      export "Speaker 1" even when the real name is known, the same class
//      of bug already fixed in TranscriptView/SpeakerLegend for the UI.
function speakerName(speaker) {
  return speaker?.displayName ?? speaker?.label ?? null;
}

export function toExportSummary({ summary, actionItems, speakers }) {
  return {
    overview: summary?.overview ?? '',
    speakers: (speakers ?? []).map((s) => ({ label: speakerName(s), color: s.color ?? null })),
    points: (summary?.points ?? []).map((p) => ({
      content: p.content,
      category: p.category,
      speakerLabel: speakerName(p.speaker),
      startMs: p.startMs,
    })),
    actionItems: (actionItems ?? []).map((a) => ({
      content: a.content,
      ownerLabel: a.ownerLabel,
      dueDate: a.dueDate,
      isDone: a.isDone ?? false,
    })),
  };
}

// meta is intentionally NOT part of the summary JSON (see export.model.js's
// own doc comment) — the export module reads it from the meeting row itself.
export function toExportMeta(meeting) {
  return {
    title: meeting.title,
    date: meeting.meetingDate ?? meeting.createdAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    durationSeconds: meeting.durationSeconds ?? null,
  };
}

// The export previously never included the transcript at all. Mirrors
// TranscriptView's own fallback: real per-turn segments (with a raw
// speakerLabel, per text.parser.js's turn detection) when present, else the
// flat fullText as paragraphs (a .txt upload with no detectable turn
// structure), else omitted — never a "no transcript" placeholder in the
// export, that case just means there's nothing to append.
export function toExportTranscript(transcript) {
  if (!transcript) return null;
  if (transcript.segments?.length) {
    return {
      kind: 'segments',
      segments: transcript.segments.map((s) => ({
        startMs: s.startMs,
        speakerLabel: s.speakerLabel ?? null,
        text: s.text,
      })),
    };
  }
  if (transcript.fullText) {
    return { kind: 'text', text: transcript.fullText };
  }
  return null;
}
