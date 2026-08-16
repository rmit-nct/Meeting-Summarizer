// Zod schemas: create, update, list query. See ENDPOINTS.md §4.
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const actionItemValidator = {
  // POST /api/action-items — manual add from the detail page.
  create: z.object({
    meetingId: z.uuid(),
    content: z.string().trim().min(1, 'Content is required').max(1000),
    ownerLabel: z.string().trim().max(120).optional(),
    dueDate: isoDate.optional(),
  }),

  // PATCH /api/action-items/:id — this is what the checkbox calls, so isDone
  // alone must be a valid body.
  //
  // ownerId is deliberately absent: it's a FK to speakers, and reassigning an
  // item to a different speaker isn't in the brief. ownerLabel covers manual
  // entry of someone who never spoke.
  update: z
    .object({
      content: z.string().trim().min(1).max(1000).optional(),
      ownerLabel: z.string().trim().max(120).nullable().optional(),
      dueDate: isoDate.nullable().optional(),
      isDone: z.boolean().optional(),
      orderIndex: z.number().int().min(0).optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: 'Provide at least one field to update',
    }),

  listQuery: z.object({
    meetingId: z.uuid().optional(),
    // Query strings are always strings — 'false' is truthy, so coerce explicitly.
    isDone: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
};