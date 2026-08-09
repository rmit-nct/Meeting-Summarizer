import { Router } from 'express';
import { validateParams } from '../../middleware/validate.js';
import { processingController } from './processing.controller.js';
import { meetingIdParam } from './processing.validator.js';

// Mounted at /api/meetings in app.js. See ENDPOINTS.md §3.
const router = Router();

router.post('/:id/process', validateParams(meetingIdParam), processingController.process);
router.get('/:id/status', validateParams(meetingIdParam), processingController.status);

// TODO: router.post('/:id/resummarize', processingController.resummarize);
// Needs the summary module (Groq Llama call + parsing), not yet implemented.

export default router;
