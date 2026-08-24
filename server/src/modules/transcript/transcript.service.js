// Dispatches to the right TranscriptParser strategy (OOP_PATTERNS_GUIDE.md §1)
// and persists the result. Publishes transcript:created (success) or
// pipeline:failed (any stage). See AI_INTEGRATION.md §2, §6,
// FROM_MEETING_TO_JSON_PLAN.md §3.
import { eventBus } from '../../shared/eventBus.js';
import { logger } from '../../shared/logger.js';
import { env } from '../../config/env.js';
import { meetingInterface } from '../meeting/meeting.interface.js';
import { transcriptRepository } from './transcript.repository.js';
import { ParserFactory } from './parsers/parser.factory.js';
import { PipelineError } from './parsers/pipelineError.js';

async function transcribeMeeting(meetingId, userId) {
  try {
    const meeting = await meetingInterface.getMeetingForOwner(meetingId, userId);

    // sourceKind (which parser produced this — transcript/parsers/) isn't
    // persisted; see the comment in transcript.repository.js#create.
    const result = env.MOCK_AI ? mockTranscription() : await runParser(meeting);
    const { fullText, segments, language, durationSeconds } = result;

    if (!fullText || !fullText.trim()) {
      throw new PipelineError('transcription_failed', 'No speech detected in the recording.');
    }

    const transcript = await transcriptRepository.create(userId, {
      meetingId,
      fullText,
      segments,
      language: language ?? null,
      model: env.OPENAI_TRANSCRIPTION_MODEL,
      wordCount: countWords(fullText),
    });

    eventBus.emit('transcript:created', {
      meetingId,
      userId,
      transcriptId: transcript.id,
      durationSeconds: durationSeconds ?? null,
    });
  } catch (err) {
    logger.error(`transcription failed for meeting ${meetingId}`, err);
    eventBus.emit('pipeline:failed', {
      meetingId,
      userId,
      code: err instanceof PipelineError ? err.code : 'transcription_failed',
      message: err instanceof PipelineError ? err.message : 'Transcription service unavailable, please retry.',
    });
  }
}

async function runParser(meeting) {
  const parser = ParserFactory.create(meeting.original_filename);
  return parser.parse(meeting);
}

function mockTranscription() {
  return {
    fullText: 'This is a mock transcript generated because MOCK_AI is enabled. ' +
      'The deadline moved to the seventeenth and the team agreed to redo the Gantt chart.',
    segments: [
      { id: 0, start: 0, end: 4, text: 'This is a mock transcript generated because MOCK_AI is enabled.' },
      { id: 1, start: 4, end: 9, text: 'The deadline moved to the seventeenth.' },
      { id: 2, start: 9, end: 13, text: 'The team agreed to redo the Gantt chart.' },
    ],
    language: 'en',
    durationSeconds: 13,
    sourceKind: 'whisper',
  };
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export const transcriptService = { transcribeMeeting };
