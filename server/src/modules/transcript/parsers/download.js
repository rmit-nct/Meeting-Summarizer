// Shared Storage download helpers used by every TranscriptParser strategy.
// Downloads server-side using the secret-key client — no signed URL needed,
// this call never crosses the network to a browser. See AI_INTEGRATION.md §2.
import fs from 'node:fs/promises';
import path from 'node:path';
import { supabase } from '../../../config/supabase.js';
import { env } from '../../../config/env.js';
import { PipelineError } from './pipelineError.js';

async function downloadBlob(meeting) {
  const { data, error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .download(meeting.storage_path);
  if (error) throw new PipelineError('transcription_failed', 'Could not read the recording from storage.');
  return data;
}

// For parsers that need a real file on disk (ffmpeg/Whisper).
export async function downloadToFile(meeting, workDir) {
  const blob = await downloadBlob(meeting);
  const buffer = Buffer.from(await blob.arrayBuffer());
  const ext = path.extname(meeting.original_filename || '') || '.bin';
  const inputPath = path.join(workDir, `input${ext}`);
  await fs.writeFile(inputPath, buffer);
  return inputPath;
}

// For parsers that only need the text content (subtitles, plain text).
export async function downloadToText(meeting) {
  const blob = await downloadBlob(meeting);
  return blob.text();
}
