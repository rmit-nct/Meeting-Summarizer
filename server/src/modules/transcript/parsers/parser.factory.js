// ParserFactory — the ONLY place that maps a file extension to a parser
// strategy. Never branch on extension anywhere else. Adding a new file type
// later = one new class + one line here. See OOP_PATTERNS_GUIDE.md §1.
import path from 'node:path';
import { Mp4Parser } from './mp4.parser.js';
import { SubtitleParser } from './subtitle.parser.js';
import { TextParser } from './text.parser.js';
import { PipelineError } from './pipelineError.js';

const AUDIO_VIDEO_EXT = new Set(['.mp3', '.m4a', '.wav', '.webm', '.flac', '.ogg', '.mp4', '.mov']);

export const ParserFactory = {
  create(originalFilename) {
    const ext = path.extname(originalFilename || '').toLowerCase();

    if (AUDIO_VIDEO_EXT.has(ext)) return new Mp4Parser();
    if (ext === '.vtt') return new SubtitleParser('parsed_vtt');
    if (ext === '.srt') return new SubtitleParser('parsed_srt');
    if (ext === '.txt' || ext === '.md') return new TextParser();

    throw new PipelineError('transcription_failed', `Unsupported file type "${ext || 'unknown'}".`);
  },
};
