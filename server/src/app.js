import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { authenticate } from './middleware/authenticate.js';
import { rateLimit } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { success } from './shared/response.js';

// Module routes. Add a new import + app.use() here as a module gains a REST
// surface. See ENDPOINTS.md.
import userRoutes from './modules/user/user.routes.js';
import meetingRoutes from './modules/meeting/meeting.routes.js';
import overviewRoutes from './modules/overview/overview.routes.js';
import processingRoutes from './modules/processing/processing.routes.js';
import summaryRoutes from './modules/summary/summary.routes.js';
import exportRoutes from './modules/export/export.routes.js';
import actionItemRoutes from './modules/action-item/action-item.routes.js';
import authRoutes from './modules/auth/auth.routes.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.CLIENT_URL.split(',') }));
  app.use(express.json());
  app.use(rateLimit);

  // No auth required — confirms the process booted. See SETUP.md §5.
  app.get('/api/health', (req, res) => res.json(success({ status: 'ok' })));
  app.use('/api/auth', authRoutes);

  app.use('/api/users', authenticate, userRoutes);
  app.use('/api/meetings', authenticate, meetingRoutes);
  app.use('/api/meetings', authenticate, overviewRoutes);   // GET /:id detail
  app.use('/api/meetings', authenticate, processingRoutes); // /:id/process, /resummarize, /status
  app.use('/api/meetings', authenticate, summaryRoutes);    // /:id/speakers
  app.use('/api/meetings', authenticate, exportRoutes);     // /:id/export
  app.use('/api/action-items', authenticate, actionItemRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
