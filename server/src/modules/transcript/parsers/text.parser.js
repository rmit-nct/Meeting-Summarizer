// TranscriptParser strategy for .txt/.md. Used as-is when the content has no
// recognizable structure. When it looks like a per-turn export from a meeting
// tool (Zoom/Google Meet/Teams-style "Name <worded duration>" cue lines), we
// split it into real timestamped segments instead — see parseTurns() below.
// See FROM_MEETING_TO_JSON_PLAN.md §3, OOP_PATTERNS_GUIDE.md §1.
import { downloadToText } from './download.js';
import { PipelineError } from './pipelineError.js';

// Confidence gate for "this file has real turn structure" vs. "it's just
// prose that happens to contain a duration-shaped phrase" — tune here if a
// real export shape stops being detected or a plain paragraph starts being
// mis-split. Named, not inlined, precisely so they're easy to revisit later.
const MIN_TURNS = 2;
const MAX_PREAMBLE_LINES = 5;
const MAX_DROPPED_RATIO = 0.3;

// Anchored on ending in "second(s)" deliberately: real cue lines always end
// with the seconds unit ("0 minutes 12 seconds"), while some exports also
// emit a duplicate "glued clock" line right after the name
// ("0 minutes 12 seconds0:12") that must NOT be treated as a second, empty
// cue — anchoring on the word ending excludes it automatically, no special
// case needed.
const CUE_LINE_RE = /^(.+?)\s+((?:\d+\s*hours?\s*)?(?:\d+\s*minutes?\s*)?\d+\s*seconds?)$/i;
const START_STOP_RE = /^\S.*\s(?:started|stopped)\s+transcription$/i;

function parseWordedDuration(phrase) {
  const h = /(\d+)\s*hours?/i.exec(phrase);
  const m = /(\d+)\s*minutes?/i.exec(phrase);
  const s = /(\d+)\s*seconds?/i.exec(phrase);
  return (h ? Number(h[1]) * 3600 : 0) + (m ? Number(m[1]) * 60 : 0) + (s ? Number(s[1]) : 0);
}

// Pure and storage-independent on purpose — testable without touching
// Supabase. Returns [] when the content doesn't confidently look like a
// per-turn export; callers must treat that as "no structure detected", not
// an error.
export function parseTurns(content) {
  const lines = content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !START_STOP_RE.test(l));

  const segments = [];
  let current = null;
  let cueMatches = 0;
  let droppedCues = 0;
  let preambleLines = 0;

  function flush() {
    if (!current) return;
    const text = current.textLines.join(' ').trim();
    if (text) {
      segments.push({ speakerLabel: current.speakerLabel, start: current.start, text });
    } else {
      droppedCues += 1;
    }
    current = null;
  }

  for (const line of lines) {
    const match = CUE_LINE_RE.exec(line);
    if (match) {
      cueMatches += 1;
      flush();
      current = { speakerLabel: match[1].trim(), start: parseWordedDuration(match[2]), textLines: [] };
    } else if (current) {
      current.textLines.push(line);
    } else {
      preambleLines += 1;
    }
  }
  flush();

  const droppedRatio = cueMatches > 0 ? droppedCues / cueMatches : 0;
  if (segments.length < MIN_TURNS || preambleLines > MAX_PREAMBLE_LINES || droppedRatio >= MAX_DROPPED_RATIO) {
    return [];
  }

  return segments.map((seg, i) => ({
    id: i,
    start: seg.start,
    end: i + 1 < segments.length ? segments[i + 1].start : seg.start + 5,
    text: seg.text,
    speakerLabel: seg.speakerLabel,
  }));
}

export class TextParser {
  sourceKind = 'raw_text';

  async parse(meeting) {
    const content = (await downloadToText(meeting)).trim();
    if (!content) {
      throw new PipelineError('transcription_failed', 'No speech detected in the recording.');
    }

    const segments = parseTurns(content);

    return {
      fullText: content,
      segments,
      language: null,
      durationSeconds: segments.length > 0 ? segments[segments.length - 1].end : null,
      sourceKind: this.sourceKind,
    };
  }
}
