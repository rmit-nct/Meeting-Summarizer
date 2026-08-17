// Zod schemas: create, update, upload, list query. See ENDPOINTS.md §2.
import { z } from 'zod';
import { ALLOWED_UPLOAD_MIME_TYPES, MEETING_STATUS } from '../../shared/constants.js';
import { env } from '../../config/env.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

export const create = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(2000).optional(),
  meetingDate: isoDate.optional(),
});

// Editable fields only (ENDPOINTS.md §2) — anything else is ignored because
// only these keys are ever read off `result.data` by the service.
export const update = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  meetingDate: isoDate.nullable().optional(),
});

export const upload = z.object({
  sourceType: z.enum(['upload', 'recording']),
  originalFilename: z.string().trim().min(1).max(255),
  mimeType: z.enum(ALLOWED_UPLOAD_MIME_TYPES, {
    errorMap: () => ({ message: 'Unsupported file type' }),
  }),
  sizeBytes: z.coerce.number().int().positive().max(env.MAX_UPLOAD_BYTES, 'File is too large'),
});

export const listQuery = z.object({
  q: z.string().trim().min(1).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  status: z.enum(Object.values(MEETING_STATUS)).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const meetingIdParam = z.object({ id: z.string().uuid('id must be a valid UUID') });
