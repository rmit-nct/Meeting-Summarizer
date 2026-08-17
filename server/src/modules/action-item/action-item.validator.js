// Zod schemas: create, update, list query. See ENDPOINTS.md §4.
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

export const create = z.object({
  meetingId: z.string().uuid(),
  content: z.string().trim().min(1).max(500),
  ownerLabel: z.string().trim().min(1).max(100).optional(),
  dueDate: isoDate.optional(),
});

export const update = z.object({
  content: z.string().trim().min(1).max(500).optional(),
  ownerLabel: z.string().trim().min(1).max(100).nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  isDone: z.boolean().optional(),
  orderIndex: z.number().int().min(0).optional(),
});

export const listQuery = z.object({
  meetingId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const actionItemIdParam = z.object({ id: z.string().uuid('id must be a valid UUID') });
