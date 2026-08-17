// Zod schema for the LLM summarization response (FROM_MEETING_TO_JSON_PLAN.md
// §4-§5) and for the speaker rename payload (ENDPOINTS.md §5).
import { z } from 'zod';
import { POINT_CATEGORIES, MAX_SUMMARY_POINTS, MAX_ACTION_ITEMS, MAX_SUMMARY_SPEAKERS } from '../../shared/constants.js';

const SpeakerSchema = z.object({
  tempId: z.string().regex(/^spk_\d+$/),
  label: z.string().min(1),
  nameGuess: z.string().min(1).nullable().default(null),
  evidence: z.string().min(1),
});

const PointSchema = z.object({
  tempId: z.string().regex(/^pt_\d+$/),
  content: z.string().min(1),
  category: z.enum(POINT_CATEGORIES),
  speakerTempId: z.string().nullable().default(null),
  startMs: z.number().int().nonnegative().nullable().default(null),
});

const ActionItemSchema = z.object({
  tempId: z.string().regex(/^ai_\d+$/),
  content: z.string().min(1),
  ownerTempId: z.string().nullable().default(null),
  ownerLabelFallback: z.string().min(1).nullable().default(null),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  sourcePointTempId: z.string().nullable().default(null),
});

// Cross-reference check Zod's shape rules alone can't express — every
// speakerTempId/ownerTempId must resolve within this same response.
// FROM_MEETING_TO_JSON_PLAN.md §4.3: a dangling reference is a validation
// failure, not a soft warning.
export const SummaryResponseSchema = z.object({
  schemaVersion: z.literal('1.0'),
  language: z.string().min(1),
  overview: z.string().min(1),
  speakers: z.array(SpeakerSchema).min(1).max(MAX_SUMMARY_SPEAKERS),
  points: z.array(PointSchema).max(MAX_SUMMARY_POINTS),
  actionItems: z.array(ActionItemSchema).max(MAX_ACTION_ITEMS),
}).superRefine((data, ctx) => {
  const speakerIds = new Set(data.speakers.map((s) => s.tempId));

  data.points.forEach((p, i) => {
    if (p.speakerTempId && !speakerIds.has(p.speakerTempId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['points', i, 'speakerTempId'],
        message: `speakerTempId "${p.speakerTempId}" does not reference any speaker in speakers[]`,
      });
    }
  });

  data.actionItems.forEach((a, i) => {
    if (a.ownerTempId && !speakerIds.has(a.ownerTempId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['actionItems', i, 'ownerTempId'],
        message: `ownerTempId "${a.ownerTempId}" does not reference any speaker in speakers[]`,
      });
    }
  });
});

export const renameSpeakers = z.object({
  speakers: z.array(
    z.object({
      id: z.string().uuid(),
      displayName: z.string().trim().min(1).max(100).optional(),
      color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'must be a hex color').optional(),
    }),
  ).min(1),
});
