// TranscriptParser strategy for .txt/.md — used as-is, no timestamps unless
// present in the content (there never are, for this simple strategy). See
// FROM_MEETING_TO_JSON_PLAN.md §3, OOP_PATTERNS_GUIDE.md §1.
import { downloadToText } from './download.js';
import { PipelineError } from './pipelineError.js';

export class TextParser {
  sourceKind = 'raw_text';

  async parse(meeting) {
    const content = (await downloadToText(meeting)).trim();
    if (!content) {
      throw new PipelineError('transcription_failed', 'No speech detected in the recording.');
    }

    return {
      fullText: content,
      segments: [],
      language: null,
      durationSeconds: null,
      sourceKind: this.sourceKind,
    };
  }
}
