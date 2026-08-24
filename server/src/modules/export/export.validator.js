// Zod schema for GET /:id/export's query string. See ENDPOINTS.md §6.
// docx is deliberately not exposed here — not part of the documented
// contract or the client UI, even though export.service.js can render one;
// export.docx.js stays available for a future format if that changes.
import { z } from 'zod';

export const exportQuery = z.object({
  format: z.enum(['md', 'pdf']),
});
