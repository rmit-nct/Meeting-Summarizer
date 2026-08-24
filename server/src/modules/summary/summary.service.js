// OpenAI call + JSON parsing/normalization. Publishes summary:created and
// summary:action-items-extracted. Plain orchestrator function, not a Template
// Method (OOP_PATTERNS_GUIDE.md §4) — each step below is independently
// testable/mockable and the top-level function stays flat.
// See AI_INTEGRATION.md §3, FROM_MEETING_TO_JSON_PLAN.md §4-§6.
import { eventBus } from '../../shared/eventBus.js';
import { logger } from '../../shared/logger.js';
import { env } from '../../config/env.js';
import { transcriptInterface } from '../transcript/transcript.interface.js';
import { summaryRepository } from './summary.repository.js';
import { speakerRepository } from './speaker.repository.js';
import { SummaryGeneratorFactory } from './generators/summaryGenerator.factory.js';
import { SummaryResponseSchema } from './summary.validator.js';
import { PROMPT_VERSION } from './summary.prompts.js';
import { AppError } from '../../shared/errors.js';

const MAX_PARSE_ATTEMPTS = 2; // one shot + one retry-with-errors, per AI_INTEGRATION.md §3

async function generateSummary(meetingId, userId) {
  try {
    const transcript = await transcriptInterface.getTranscriptForOwner(meetingId, userId);
    if (!transcript) {
      throw new SummarizationError('summarization_failed', 'No transcript found for this meeting.');
    }

    const segments = normalizeSegments(transcript);
    const generator = SummaryGeneratorFactory.create();
    const { parsed, rawText } = await callAndValidate(generator, segments);

    const { actionItems } = await persist(meetingId, userId, parsed, rawText);

    eventBus.emit('summary:created', { meetingId, userId });
    if (actionItems.length > 0) {
      eventBus.emit('summary:action-items-extracted', { meetingId, userId, items: actionItems });
    }
  } catch (err) {
    logger.error(`summarization failed for meeting ${meetingId}`, err);
    eventBus.emit('pipeline:failed', {
      meetingId,
      userId,
      code: err instanceof SummarizationError ? err.code : 'summarization_failed',
      message: err instanceof SummarizationError ? err.message : 'Summarization service unavailable, please retry.',
    });
  }
}

class SummarizationError extends AppError {
  constructor(code, message) {
    super(code, message, 502);
  }
}

// Falls back to one synthetic segment for raw-text/no-timestamp sources
// (FROM_MEETING_TO_JSON_PLAN.md §3) so buildTranscriptPrompt() never has to
// special-case an empty segments array.
function normalizeSegments(transcript) {
  if (transcript.segments?.length) return transcript.segments;
  return [{ id: 0, start: 0, end: 0, text: transcript.full_text }];
}

// Step: call the model, then defensively parse + validate, retrying once
// with the validation error appended to the prompt. See AI_INTEGRATION.md §3
// "Parsing" and FROM_MEETING_TO_JSON_PLAN.md §5.1-5.2.
async function callAndValidate(generator, segments) {
  let retryHint;
  let lastRawText;

  for (let attempt = 1; attempt <= MAX_PARSE_ATTEMPTS; attempt += 1) {
    lastRawText = await generator.generateSummary(segments, { retryHint });

    const candidate = extractJson(lastRawText);
    if (candidate === null) {
      retryHint = 'your response was not a single valid JSON object.';
      continue;
    }

    const result = SummaryResponseSchema.safeParse(candidate);
    if (result.success) {
      return { parsed: result.data, rawText: lastRawText };
    }
    retryHint = summarizeZodErrors(result.error);
  }

  throw new SummarizationError(
    'summarization_failed',
    'The summarization model returned an invalid response after a retry.',
  );
}

// 1. Strip markdown fences the model sometimes adds despite JSON mode.
// 2. Fall back to the outermost {...} span if there is stray prose.
// 3. JSON.parse — a syntax failure here is not worth re-parsing.
function extractJson(text) {
  const stripped = text.replace(/```(?:json)?/gi, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    return null;
  }
}

function summarizeZodErrors(zodError) {
  return zodError.issues
    .slice(0, 5)
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('; ');
}

// Step: tempId -> DB row normalization. Order matters — speakers must exist
// before points/action-items reference them. raw_response is written as part
// of the summary insert, which happens before points/action-items so a later
// failure still leaves the raw model output durable for debugging.
// See FROM_MEETING_TO_JSON_PLAN.md §5.3-§6.
async function persist(meetingId, userId, parsed, rawText) {
  // Resummarize replaces summaries/summary_points/speakers wholesale
  // (ENDPOINTS.md §3) — safe as a no-op delete on first-time generation.
  await summaryRepository.deleteSummaryForMeeting(meetingId, userId);
  await speakerRepository.deleteByMeetingId(meetingId, userId);

  const summary = await summaryRepository.createSummary(userId, {
    meetingId,
    overview: parsed.overview,
    model: env.OPENAI_SUMMARY_MODEL,
    rawResponse: rawText,
    promptVersion: PROMPT_VERSION,
  });

  // Matched back by `label`, not array position — a bulk INSERT...RETURNING
  // preserving row order isn't a guarantee worth depending on, and `label`
  // is unique per meeting (DB constraint), so this is exact either way.
  const speakerRows = await speakerRepository.bulkCreate(userId, meetingId, parsed.speakers);
  const speakerIdByLabel = new Map(speakerRows.map((row) => [row.label, row.id]));
  const speakerIdByTempId = new Map(parsed.speakers.map((s) => [s.tempId, speakerIdByLabel.get(s.label) ?? null]));
  // Prefer the model's nameGuess (now also seeded onto the speaker row's
  // display_name in speakerRepository.bulkCreate) over the generic "Speaker
  // N" label when one was found — same snapshot rationale as before
  // (independent of any later manual rename), just capturing the better
  // value when the model knew a real name. See action-item.dto.js for why
  // this needs to be non-null whenever ownerId is a real speaker.
  const speakerLabelByTempId = new Map(parsed.speakers.map((s) => [s.tempId, s.nameGuess ?? s.label]));

  await summaryRepository.bulkCreatePoints(
    userId,
    meetingId,
    summary.id,
    parsed.points.map((p) => ({
      content: p.content,
      category: p.category,
      speakerId: p.speakerTempId ? speakerIdByTempId.get(p.speakerTempId) ?? null : null,
      startMs: p.startMs,
    })),
  );

  const actionItems = parsed.actionItems.map((a) => ({
    content: a.content,
    ownerId: a.ownerTempId ? speakerIdByTempId.get(a.ownerTempId) ?? null : null,
    ownerLabel: a.ownerLabelFallback ?? (a.ownerTempId ? speakerLabelByTempId.get(a.ownerTempId) ?? null : null),
    dueDate: a.dueDate,
  }));

  return { actionItems };
}

export const summaryService = { generateSummary };
