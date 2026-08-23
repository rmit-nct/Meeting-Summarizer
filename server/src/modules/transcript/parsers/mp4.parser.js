// TranscriptParser strategy for audio/video: ffmpeg normalize (+ chunk if
// needed) then Groq Whisper per chunk. Moved here unchanged from
// transcript.service.js — see OOP_PATTERNS_GUIDE.md §1 (Strategy + Factory)
// and AI_INTEGRATION.md §2.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { groq } from '../../../config/groq.js';
import { env } from '../../../config/env.js';
import { logger } from '../../../shared/logger.js';
import { downloadToFile } from './download.js';
import { PipelineError } from './pipelineError.js';

// ffmpeg splits on this boundary only because Groq's per-request audio size
// limit forces it, not to dodge a platform timeout. See AI_INTEGRATION.md §2.
const SEGMENT_SECONDS = 600;
const MAX_WHISPER_ATTEMPTS = 3;

const execFileAsync = promisify(execFile);

export class Mp4Parser {
  sourceKind = 'whisper';

  async parse(meeting) {
    const workDir = await makeWorkDir();
    try {
      const inputPath = await downloadToFile(meeting, workDir);
      const normalizedPath = path.join(workDir, 'normalized.flac');
      await normalizeAudio(inputPath, normalizedPath);

      const durationSeconds = await getDurationSeconds(normalizedPath);
      const chunkPaths = await maybeSplitIntoChunks(normalizedPath, workDir);

      const fullTextParts = [];
      const segments = [];
      let language;

      for (let i = 0; i < chunkPaths.length; i += 1) {
        const offsetMs = i * SEGMENT_SECONDS * 1000;
        const chunk = await transcribeChunkWithRetry(chunkPaths[i]);
        language ??= chunk.language;
        fullTextParts.push(chunk.text);
        for (const seg of chunk.segments) {
          segments.push({
            id: segments.length,
            start: seg.start + offsetMs / 1000,
            end: seg.end + offsetMs / 1000,
            text: seg.text,
          });
        }
      }

      return {
        fullText: fullTextParts.join(' ').trim(),
        segments,
        language: language ?? null,
        durationSeconds,
        sourceKind: this.sourceKind,
      };
    } finally {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function makeWorkDir() {
  const dir = path.join(os.tmpdir(), `nct-transcribe-${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

// Extracts audio (if video) and normalizes to 16 kHz mono FLAC in one pass.
// -vn is a no-op on audio-only input, so this command is safe for both.
async function normalizeAudio(inputPath, outputPath) {
  try {
    await execFileAsync('ffmpeg', [
      '-y', '-i', inputPath,
      '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'flac',
      outputPath,
    ]);
  } catch (err) {
    logger.error('ffmpeg normalize failed', err);
    throw new PipelineError('transcription_failed', 'Could not read the audio in this file.');
  }
}

async function getDurationSeconds(filePath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath,
    ]);
    const seconds = parseFloat(stdout.trim());
    return Number.isFinite(seconds) ? seconds : null;
  } catch (err) {
    logger.error('ffprobe duration probe failed', err);
    return null;
  }
}

// Only chunks when the normalized file still exceeds Groq's per-request
// audio size limit — never to dodge a wall-clock timeout.
async function maybeSplitIntoChunks(normalizedPath, workDir) {
  const { size } = await fs.stat(normalizedPath);
  if (size <= env.GROQ_AUDIO_MAX_BYTES) return [normalizedPath];

  const pattern = path.join(workDir, 'chunk-%03d.flac');
  await execFileAsync('ffmpeg', [
    '-y', '-i', normalizedPath,
    '-f', 'segment', '-segment_time', String(SEGMENT_SECONDS), '-c', 'copy',
    pattern,
  ]);

  const files = (await fs.readdir(workDir))
    .filter((name) => name.startsWith('chunk-') && name.endsWith('.flac'))
    .sort();
  return files.map((name) => path.join(workDir, name));
}

async function transcribeChunkWithRetry(filePath) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_WHISPER_ATTEMPTS; attempt += 1) {
    try {
      const res = await groq.audio.transcriptions.create({
        file: createReadStream(filePath),
        model: env.GROQ_TRANSCRIPTION_MODEL,
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
        temperature: 0,
      });
      return {
        text: res.text ?? '',
        language: res.language,
        segments: (res.segments ?? []).map((seg) => ({ start: seg.start, end: seg.end, text: seg.text })),
      };
    } catch (err) {
      lastErr = err;
      const status = err?.status ?? err?.response?.status;
      if (status === 429) {
        const retryAfterMs = Number(err?.headers?.['retry-after']) * 1000 || 2000 * attempt;
        await sleep(retryAfterMs);
        continue;
      }
      if (status >= 500 || !status) {
        await sleep(1000 * attempt);
        continue;
      }
      throw new PipelineError('transcription_failed', 'Transcription service unavailable, please retry.');
    }
  }
  logger.error('whisper call exhausted retries', lastErr);
  throw new PipelineError('transcription_failed', 'Transcription service unavailable, please retry.');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
