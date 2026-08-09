import { z } from 'zod';

// Validates :id params for process/resummarize/status. See ENDPOINTS.md §3.
export const meetingIdParam = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});
