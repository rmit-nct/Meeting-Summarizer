import { Router } from 'express';

// Mounted at /api/meetings in app.js, alongside meeting.routes.js. See ENDPOINTS.md §5.
const router = Router();

// TODO: router.patch('/:id/speakers', validate(summaryValidator.renameSpeakers), summaryController.renameSpeakers);

export default router;
