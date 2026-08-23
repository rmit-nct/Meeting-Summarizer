// TranscriptParser strategy for .vtt/.srt — already timestamped, no Whisper
// call needed. See FROM_MEETING_TO_JSON_PLAN.md §3, OOP_PATTERNS_GUIDE.md §1.
import { downloadToText } from './download.js';
import { PipelineError } from './pipelineError.js';

// Matches both "00:00:04.000 --> 00:00:09.000" (VTT) and
// "00:00:04,000 --> 00:00:09,000" (SRT), with an optional leading hour group.
const CUE_TIME_LINE = /(\d{1,2}:)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{1,2}:)?(\d{2}):(\d{2})[.,](\d{3})/;

function timeToSeconds(hourPart, mm, ss, ms) {
  const h = hourPart ? parseInt(hourPart, 10) : 0;
  return h * 3600 + parseInt(mm, 10) * 60 + parseInt(ss, 10) + parseInt(ms, 10) / 1000;
}

// Strips VTT inline markup (<b>, <00:00:01.000>, position/align cue settings)
// down to plain text.
function stripMarkup(line) {
  return line.replace(/<[^>]*>/g, '').trim();
}

export function parseCues(content) {
  const blocks = content
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const segments = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    const timeLineIndex = lines.findIndex((l) => CUE_TIME_LINE.test(l));
    if (timeLineIndex === -1) continue; // header ("WEBVTT"), NOTE block, or a bare cue index

    const match = lines[timeLineIndex].match(CUE_TIME_LINE);
    const start = timeToSeconds(match[1]?.replace(':', ''), match[2], match[3], match[4]);
    const end = timeToSeconds(match[5]?.replace(':', ''), match[6], match[7], match[8]);

    const text = lines
      .slice(timeLineIndex + 1)
      .map(stripMarkup)
      .filter(Boolean)
      .join(' ');
    if (!text) continue;

    segments.push({ id: segments.length, start, end, text });
  }
  return segments;
}

export class SubtitleParser {
  constructor(sourceKind) {
    // 'parsed_vtt' | 'parsed_srt' — set by the factory from the extension.
    this.sourceKind = sourceKind;
  }

  async parse(meeting) {
    const content = await downloadToText(meeting);
    const segments = parseCues(content);
    if (segments.length === 0) {
      throw new PipelineError('transcription_failed', 'No speech detected in the recording.');
    }

    return {
      fullText: segments.map((s) => s.text).join(' ').trim(),
      segments,
      language: null,
      durationSeconds: segments[segments.length - 1]?.end ?? null,
      sourceKind: this.sourceKind,
    };
  }
}
