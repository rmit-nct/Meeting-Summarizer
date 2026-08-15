// Zod schemas: create, update, list query. See ENDPOINTS.md §2.
import { z } from 'zod';
import { MEETING_STATUS } from '../../shared/constants.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const meetingValidator = {
  // POST /api/meetings — creates a draft. No file fields here: a meeting is
  // created first, then the upload attaches to it. See ARCHITECTURE.md §4.1.
  create: z.object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    description: z.string().trim().max(2000).optional(),
    meetingDate: isoDate.optional(),
  }),

  // PATCH /api/meetings/:id — only user-editable metadata. Status, storagePath
  // and the file columns are NOT patchable from the client; the processing
  // module owns those transitions.
  update: z
    .object({
      title: z.string().trim().min(1).max(200).optional(),
      description: z.string().trim().max(2000).nullable().optional(),
      meetingDate: isoDate.nullable().optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: 'Provide at least one field to update',
    }),

  // GET /api/meetings — query string, so everything arrives as a string and
  // has to be coerced.
  listQuery: z
    .object({
      q: z.string().trim().min(1).max(200).optional(),
      status: z.enum(Object.values(MEETING_STATUS)).optional(),
      from: isoDate.optional(),
      to: isoDate.optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    })
    .refine((query) => !query.from || !query.to || query.from <= query.to, {
      message: '`from` must be on or before `to`',
      path: ['from'],
    }),
};