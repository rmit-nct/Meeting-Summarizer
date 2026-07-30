import { Router } from 'express';

// Mounted at /api/meetings in app.js, alongside meeting.routes.js. See ENDPOINTS.md §6.
const router = Router();

// TODO: router.get('/:id/export', exportController.download);

export default router;
