# SCAFFOLD.md

Instructions for Claude Code to scaffold this repository from zero, following
`ARCHITECTURE.md`. Run the steps below **in order**, in the project root.

---

## 0. What this produces, and the one design trade-off

Two files exist for every module: **business files** and **wiring files**.

| Kind | Files | What's inside |
| --- | --- | --- |
| Business | `*.service.js`, `*.repository.js`, `*.controller.js`, `*.validator.js`, `*.dto.js`, `*.interface.js`, `*.prompts.js`, export renderers | **Genuinely empty** — one comment line pointing at the doc section to implement from. Nothing to run yet. |
| Wiring | `index.js`, `app.js`, `config/*`, `middleware/errorHandler.js` + `validate.js`, `*.routes.js`, `*.events.js`, `*.socket.js`, `model.js` | **Minimally real** — just enough for the process to boot, routes to 404 correctly instead of crashing, and the event bus / socket registration to have somewhere to attach to later. |

This split is what makes "no business logic yet" and "runs today" both true at once.
`.env` values are placeholders (`replace-me`) — they satisfy validation so the server boots;
they do **not** need to be real Supabase/Groq credentials yet. Real credentials become
necessary starting at Stage 3 (`DELIVERABLES.md` §5).

At the end of this file: an exact smoke test with expected output for both apps.

---

## 1. Root

```bash
mkdir -p nct-meeting-summarizer && cd nct-meeting-summarizer
git init

cat > .gitignore <<'EOF'
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
EOF

cat > README.md <<'EOF'
# NCT Meeting Summarizer

<!-- Live URL: TODO -->
<!-- Demo video: TODO -->

## Purpose

TODO

## Setup instructions

TODO — see SETUP.md for the full guide.

## Library dependencies

TODO

## Team contribution table

| Name | GitHub | Role |
| --- | --- | --- |
| | | |

## Environment variables

TODO — see SETUP.md §3 for the full table.

## Extra features

TODO
EOF
```

Place `CLAUDE.md`, `ARCHITECTURE.md`, `MODELS.md`, `ENDPOINTS.md`, `AI_INTEGRATION.md`,
`FRONTEND.md`, `SETUP.md`, `DELIVERABLES.md`, `LESSONS_FROM_TUTORBOT.md` at this same repo
root (they already exist — just copy them in).

---

## 2. Server — init and dependencies

```bash
mkdir -p server && cd server
npm init -y

npm pkg set type="module"
npm pkg set main="src/index.js"
npm pkg set engines.node=">=20"
npm pkg set scripts.dev="nodemon src/index.js"
npm pkg set scripts.start="node src/index.js"
npm pkg set scripts.lint="eslint ."

npm install express cors dotenv socket.io @supabase/supabase-js groq-sdk zod
npm install --save-dev nodemon eslint

cat > eslint.config.js <<'EOF'
export default [
  { languageOptions: { ecmaVersion: 2023, sourceType: 'module' } },
];
EOF

cat > .env.example <<'EOF'
PORT=4000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-me
SUPABASE_JWT_SECRET=replace-me
SUPABASE_STORAGE_BUCKET=recordings
GROQ_API_KEY=replace-me
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3
GROQ_SUMMARY_MODEL=llama-3.3-70b-versatile
GROQ_AUDIO_MAX_BYTES=26214400
MAX_UPLOAD_BYTES=524288000
LIVE_SESSION_TTL_HOURS=4
MOCK_AI=false
EOF
cp .env.example .env

mkdir -p supabase/migrations fixtures
touch supabase/migrations/.gitkeep fixtures/.gitkeep
```

---

## 3. Server — directory tree

```bash
mkdir -p src/config src/middleware src/shared
mkdir -p src/modules/{auth,user,meeting,transcript,summary,action-item,live-session,processing,overview,export}
```

---

## 4. Server — helper functions for this session

Paste this once; it defines two helpers used by every step below.

```bash
# A genuinely empty business file: one comment line, nothing else.
new_stub() {
  mkdir -p "$(dirname "$1")"
  cat > "$1" <<EOF
// $2
EOF
}

# A table-mapping file for a module that owns a model.
new_model() {
  mkdir -p "$(dirname "$1")"
  cat > "$1" <<EOF
// Table mapping for \`$2\`. See $3. No ORM — supabase-js queries the table by
// name directly; this file documents the shape and the table name.
export const TABLE = '$2';
EOF
}
```

---

## 5. Server — config layer

```bash
cat > src/config/env.js <<'EOF'
import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.string().default('4000'),
  NODE_ENV: z.string().default('development'),
  CLIENT_URL: z.string().min(1),
  SUPABASE_URL: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().default('recordings'),
  GROQ_API_KEY: z.string().min(1),
  GROQ_TRANSCRIPTION_MODEL: z.string().default('whisper-large-v3'),
  GROQ_SUMMARY_MODEL: z.string().default('llama-3.3-70b-versatile'),
  GROQ_AUDIO_MAX_BYTES: z.coerce.number().default(26214400),
  MAX_UPLOAD_BYTES: z.coerce.number().default(524288000),
  LIVE_SESSION_TTL_HOURS: z.coerce.number().default(4),
  MOCK_AI: z.coerce.boolean().default(false),
});

// Fails loudly at boot rather than mysteriously later. See SETUP.md §3.
// Placeholder values (e.g. "replace-me") pass this check — it only requires
// presence, not a real working credential.
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
EOF

cat > src/config/supabase.js <<'EOF'
import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Service-role client. Bypasses RLS — every repository call MUST scope by
// userId. See MODELS.md §3.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
EOF

cat > src/config/groq.js <<'EOF'
import Groq from 'groq-sdk';
import { env } from './env.js';

// See AI_INTEGRATION.md. When MOCK_AI=true, this should resolve to a
// fixture-backed stub instead, so the pipeline can be developed and demoed
// without hitting the Groq API. That swap is a TODO for transcript/summary.
export const groq = env.MOCK_AI ? null : new Groq({ apiKey: env.GROQ_API_KEY });
EOF

cat > src/config/socket.js <<'EOF'
import { Server } from 'socket.io';
import { env } from './env.js';

// Bootstraps the single /rt namespace. Per-connection auth verification and
// module handler registration happen in index.js. See ARCHITECTURE.md §3.2.
export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL.split(',') },
  });
  return io.of('/rt');
}
EOF

new_stub src/config/database.js "Reserved for a direct Postgres connection if one is ever needed alongside supabase-js. Not used yet — see ARCHITECTURE.md §2.3."
new_stub src/config/upload.js "Signed-URL issuance for direct browser-to-Storage uploads, plus the MIME/size allowlist. See ENDPOINTS.md §7."
new_stub src/config/swagger.js "OpenAPI generation. Wire into app.js once the REST contract in ENDPOINTS.md stabilizes."
new_stub src/shared/constants.js "Shared enums/limits mirroring MODELS.md §1 and ENDPOINTS.md §7. Keep this and client/src/utils/constants.js in sync."
```

---

## 6. Server — middleware layer

```bash
cat > src/middleware/errorHandler.js <<'EOF'
import { AppError } from '../shared/errors.js';
import { failure } from '../shared/response.js';

// The ONLY place a failure response is formatted. Controllers throw AppError;
// they never call res.status(...).json(...) directly. See ARCHITECTURE.md §2.5.
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json(failure(err.code, err.message, err.details));
  }
  console.error(err);
  return res.status(500).json(failure('internal_error', 'Something went wrong'));
}

export function notFoundHandler(req, res) {
  res.status(404).json(failure('not_found', `No route for ${req.method} ${req.originalUrl}`));
}
EOF

cat > src/middleware/validate.js <<'EOF'
// Runs a module's Zod schema against the request body before controller logic
// runs. Usage: router.post('/', validate(meetingValidator.create), meetingController.create)
export function validate(schema) {
  return (req, res, next) => {
    if (!schema) return next(); // TODO: remove once every route passes a real schema.
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'validation_failed', message: 'Validation failed', details: result.error.flatten() },
      });
    }
    req.body = result.data;
    next();
  };
}
EOF

cat > src/middleware/authenticate.js <<'EOF'
// Verifies the Supabase access token and sets req.user. See ENDPOINTS.md §0.
export function authenticate(req, res, next) {
  // TODO: verify the bearer token via modules/auth/auth.interface.js, set req.user,
  // and reject with 401 unauthorized on failure.
  next();
}
EOF

cat > src/middleware/authorize.js <<'EOF'
// Role checks. The brief defines no roles beyond "authenticated user" today —
// this exists for the scaffolded 'elevated' tier. See ARCHITECTURE.md §5.4.
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    // TODO: check req.user.role against allowedRoles once roles exist.
    next();
  };
}
EOF

cat > src/middleware/rateLimit.js <<'EOF'
// Centralized rate limiting. See ARCHITECTURE.md §2.5. Wire express-rate-limit
// (or similar) here once Groq usage needs protecting.
export function rateLimit(req, res, next) {
  next();
}
EOF
```

---

## 7. Server — shared layer

```bash
cat > src/shared/response.js <<'EOF'
// The project-wide response envelope. Every route uses these. See ARCHITECTURE.md §2.5.
export function success(data, meta) {
  return meta ? { success: true, data, meta } : { success: true, data };
}

export function failure(code, message, details) {
  return { success: false, error: { code, message, ...(details ? { details } : {}) } };
}

export function paginate(page, limit, total) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
EOF

cat > src/shared/errors.js <<'EOF'
// Typed application errors carrying a machine code and an HTTP status.
// Modules throw these; only middleware/errorHandler.js turns them into a response.
export class AppError extends Error {
  constructor(code, message, status = 400, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const notFound = (message = 'Not found', details) => new AppError('not_found', message, 404, details);
export const unauthorized = (message = 'Unauthorized', details) => new AppError('unauthorized', message, 401, details);
export const forbidden = (message = 'Forbidden', details) => new AppError('forbidden', message, 403, details);
export const validationFailed = (message = 'Validation failed', details) => new AppError('validation_failed', message, 400, details);
export const invalidState = (message = 'Invalid state', details) => new AppError('invalid_state', message, 409, details);
EOF

cat > src/shared/eventBus.js <<'EOF'
import { EventEmitter } from 'node:events';

// The in-process event bus for cross-module, fire-and-forget side effects.
// See ARCHITECTURE.md §2.1 and §4. Replace with a durable queue later if this
// ever needs to scale beyond one process — no module code should have to change.
class EventBus extends EventEmitter {}

export const eventBus = new EventBus();
EOF

cat > src/shared/dto.js <<'EOF'
// The project-wide serialization transform. Every module's *.dto.js composes
// with this so internal fields never reach a client. See MODELS.md §0, ARCHITECTURE.md §2.5.
const INTERNAL_FIELDS = ['user_id', 'storage_path', 'raw_response'];

export function stripInternal(row) {
  if (!row) return row;
  const clean = { ...row };
  for (const field of INTERNAL_FIELDS) delete clean[field];
  return clean;
}

// snake_case (DB) -> camelCase (API). TODO: implement the recursive key
// transform once the first module needs it.
export function toCamel(row) {
  return row;
}
EOF

cat > src/shared/logger.js <<'EOF'
// Minimal logger placeholder — swap for pino/winston later if needed.
export const logger = {
  info: (...args) => console.log('[info]', ...args),
  error: (...args) => console.error('[error]', ...args),
};
EOF
```

---

## 8. Server — modules

### 8.1 `auth` (no model, no REST surface)

```bash
new_stub src/modules/auth/auth.service.js "Verifies Supabase JWTs, resolves the request user. See ARCHITECTURE.md §2.2."
new_stub src/modules/auth/auth.interface.js "Public contract: exposes verifyToken()/getUser() to middleware/authenticate.js and socket handshakes."
```

### 8.2 `user` — `/api/users`

```bash
new_model src/modules/user/user.model.js profiles "MODELS.md §2"
new_stub  src/modules/user/user.repository.js "ALL data access for profiles. Every method takes and scopes on userId. See MODELS.md §3."
new_stub  src/modules/user/user.service.js "Business rules for the user module. See ARCHITECTURE.md §2.4."
new_stub  src/modules/user/user.controller.js "HTTP-shaped: reads req, calls user.service, returns the envelope. See ENDPOINTS.md §1."
new_stub  src/modules/user/user.validator.js "Zod schemas for this module's inbound requests. See ENDPOINTS.md §1."
new_stub  src/modules/user/user.dto.js "Shapes profile rows for the API boundary. Composes with shared/dto.js."
new_stub  src/modules/user/user.interface.js "The ONLY way other modules may reach into user. See ARCHITECTURE.md §2.1."

cat > src/modules/user/user.routes.js <<'EOF'
import { Router } from 'express';

// Mounted at /api/users in app.js. See ENDPOINTS.md §1.
const router = Router();

// TODO: router.get('/me', userController.me);
// TODO: router.patch('/me', validate(userValidator.update), userController.update);

export default router;
EOF
```

### 8.3 `meeting` — `/api/meetings` (CRUD + history)

```bash
new_model src/modules/meeting/meeting.model.js meetings "MODELS.md §2"
new_stub  src/modules/meeting/meeting.repository.js "ALL data access for meetings. Every method takes and scopes on userId. See MODELS.md §3, §5 (search_meetings rpc)."
new_stub  src/modules/meeting/meeting.service.js "Business rules for meetings: create as a draft, and the draft->uploaded transition on upload(). Status from uploaded onward belongs to processing, not here. See ARCHITECTURE.md §2.2, §4. Publishes meeting:deleted on removal."
new_stub  src/modules/meeting/meeting.controller.js "HTTP-shaped: create, list, update, remove, upload. See ENDPOINTS.md §2."
new_stub  src/modules/meeting/meeting.validator.js "Zod schemas: create (title/description/meetingDate only), upload (sourceType/originalFilename/mimeType/sizeBytes), update, list query. See ENDPOINTS.md §2."
new_stub  src/modules/meeting/meeting.dto.js "Shapes meeting rows for the API boundary. Composes with shared/dto.js."
new_stub  src/modules/meeting/meeting.interface.js "Exposes getMeetingForOwner, assertOwnership, markFailed, etc. to other modules. See ARCHITECTURE.md §2.1."

cat > src/modules/meeting/meeting.routes.js <<'EOF'
import { Router } from 'express';

// Mounted at /api/meetings in app.js. See ENDPOINTS.md §2.
const router = Router();

// TODO: router.post('/', validate(meetingValidator.create), meetingController.create);       // creates a draft card, no file
// TODO: router.get('/', meetingController.list);
// TODO: router.post('/:id/upload', validate(meetingValidator.upload), meetingController.upload); // draft -> uploaded
// TODO: router.patch('/:id', validate(meetingValidator.update), meetingController.update);
// TODO: router.delete('/:id', meetingController.remove);

export default router;
EOF
```

### 8.4 `transcript` (no REST surface — driven by the event bus)

```bash
new_model src/modules/transcript/transcript.model.js transcripts "MODELS.md §2"
new_stub  src/modules/transcript/transcript.repository.js "ALL data access for transcripts. Scoped by userId. See MODELS.md §3."
new_stub  src/modules/transcript/transcript.service.js "ffmpeg preprocessing + Groq Whisper call + segment storage. Publishes transcript:created. See AI_INTEGRATION.md §2."
new_stub  src/modules/transcript/transcript.interface.js "Exposes getTranscriptForOwner(). See ARCHITECTURE.md §2.1."

cat > src/modules/transcript/transcript.events.js <<'EOF'
// Subscribes to meeting:uploaded and triggers transcription. See ARCHITECTURE.md §4.
export function register() {
  // TODO: eventBus.on('meeting:uploaded', async ({ meetingId }) => { ... });
}
EOF
```

### 8.5 `summary` — owns summaries, summary_points, speakers; `/api/meetings/:id/speakers`

```bash
new_model src/modules/summary/summary.model.js summaries "MODELS.md §2"
new_model src/modules/summary/speaker.model.js speakers "MODELS.md §2"
new_stub  src/modules/summary/summary.repository.js "ALL data access for summaries + summary_points. Scoped by userId. See MODELS.md §3."
new_stub  src/modules/summary/speaker.repository.js "ALL data access for speakers. Scoped by userId. See MODELS.md §3."
new_stub  src/modules/summary/summary.service.js "Groq Llama call + JSON parsing/normalization. Publishes summary:created and summary:action-items-extracted. See AI_INTEGRATION.md §3."
new_stub  src/modules/summary/summary.prompts.js "SUMMARY_SYSTEM_PROMPT + PROMPT_VERSION. Never inline a prompt elsewhere. See AI_INTEGRATION.md §5."
new_stub  src/modules/summary/summary.controller.js "HTTP-shaped: renameSpeakers. See ENDPOINTS.md §5."
new_stub  src/modules/summary/summary.validator.js "Zod schema for the speaker rename payload. See ENDPOINTS.md §5."
new_stub  src/modules/summary/summary.dto.js "Shapes summary/point/speaker rows for the API boundary."
new_stub  src/modules/summary/summary.interface.js "Exposes getSummaryForOwner(). See ARCHITECTURE.md §2.1."

cat > src/modules/summary/summary.events.js <<'EOF'
// Subscribes to transcript:created and triggers summarization. See ARCHITECTURE.md §4.
export function register() {
  // TODO: eventBus.on('transcript:created', async ({ meetingId }) => { ... });
}
EOF

cat > src/modules/summary/summary.routes.js <<'EOF'
import { Router } from 'express';

// Mounted at /api/meetings in app.js, alongside meeting.routes.js. See ENDPOINTS.md §5.
const router = Router();

// TODO: router.patch('/:id/speakers', validate(summaryValidator.renameSpeakers), summaryController.renameSpeakers);

export default router;
EOF
```

### 8.6 `action-item` — `/api/action-items`

```bash
new_model src/modules/action-item/action-item.model.js action_items "MODELS.md §2"
new_stub  src/modules/action-item/action-item.repository.js "ALL data access for action_items. Scoped by userId. See MODELS.md §3."
new_stub  src/modules/action-item/action-item.service.js "Business rules for action items, including the merge-not-replace rule on resummarize. See ENDPOINTS.md §3."
new_stub  src/modules/action-item/action-item.controller.js "HTTP-shaped: list, create, update, remove. See ENDPOINTS.md §4."
new_stub  src/modules/action-item/action-item.validator.js "Zod schemas: create, update. See ENDPOINTS.md §4."
new_stub  src/modules/action-item/action-item.dto.js "Shapes action item rows for the API boundary."
new_stub  src/modules/action-item/action-item.interface.js "Exposes seedFromSummary(), mergeOnResummarize(). See ARCHITECTURE.md §2.1."

cat > src/modules/action-item/action-item.events.js <<'EOF'
// Subscribes to summary:action-items-extracted and seeds rows. See ARCHITECTURE.md §4.
export function register() {
  // TODO: eventBus.on('summary:action-items-extracted', async ({ meetingId, items }) => { ... });
}
EOF

cat > src/modules/action-item/action-item.routes.js <<'EOF'
import { Router } from 'express';

// Mounted at /api/action-items in app.js. See ENDPOINTS.md §4.
const router = Router();

// TODO: router.get('/', actionItemController.list);
// TODO: router.post('/', validate(actionItemValidator.create), actionItemController.create);
// TODO: router.patch('/:id', validate(actionItemValidator.update), actionItemController.update);
// TODO: router.delete('/:id', actionItemController.remove);

export default router;
EOF
```

### 8.7 `live-session` (transient — `/rt` socket only, no REST)

```bash
new_model src/modules/live-session/live-session.model.js live_sessions "MODELS.md §2"
new_stub  src/modules/live-session/live-session.repository.js "ALL data access for live_sessions. Scoped by userId. See MODELS.md §2."
new_stub  src/modules/live-session/live-session.service.js "Chunk handling + materialization into Meeting/Transcript/Summary on end. See ARCHITECTURE.md §3.3."
new_stub  src/modules/live-session/live-session.interface.js "Exposes materialize(sessionId). See ARCHITECTURE.md §2.1."

cat > src/modules/live-session/live-session.socket.js <<'EOF'
// Handles live:start / live:chunk / live:end on the /rt namespace. See ENDPOINTS.md §8.
export function register(socket, rt) {
  // TODO: socket.on('live:start', ...); socket.on('live:chunk', ...); socket.on('live:end', ...);
}
EOF

cat > src/modules/live-session/live-session.sweeper.js <<'EOF'
// Periodic sweep of expired live_sessions -> materialize whatever exists, or
// mark failed if there's no usable transcript. See MODELS.md §2.
export function startSweeper() {
  // TODO: setInterval(() => { ... }, 60_000);
}
EOF
```

### 8.8 `processing` (no model — orchestrator) — `/api/meetings/:id/{process,resummarize,status}`

```bash
new_stub src/modules/processing/processing.service.js "Owns meeting.status transitions via meeting.interface. See ARCHITECTURE.md §4.1."
new_stub src/modules/processing/processing.controller.js "HTTP-shaped: process, resummarize, status. See ENDPOINTS.md §3."
new_stub src/modules/processing/processing.validator.js "Validates :id params if needed. See ENDPOINTS.md §3."

cat > src/modules/processing/processing.events.js <<'EOF'
// Subscribes to the pipeline's domain events and turns them into status
// transitions + socket progress emission. See ARCHITECTURE.md §4.
export function register(rt) {
  // TODO: eventBus.on('transcript:created', ...) -> markTranscribed, emit meeting:progress
  // TODO: eventBus.on('summary:created', ...)    -> markCompleted, emit meeting:completed
  // TODO: eventBus.on('pipeline:failed', ...)     -> markFailed, emit meeting:failed
}
EOF

cat > src/modules/processing/processing.socket.js <<'EOF'
// Handles meeting:subscribe / meeting:unsubscribe on the /rt namespace. See ENDPOINTS.md §8.
export function register(socket, rt) {
  // TODO: socket.on('meeting:subscribe', ({ meetingId }) => { ... join user:{userId} room-scoped meeting room ... });
  // TODO: socket.on('meeting:unsubscribe', ({ meetingId }) => { ... });
}
EOF

cat > src/modules/processing/processing.routes.js <<'EOF'
import { Router } from 'express';

// Mounted at /api/meetings in app.js. See ENDPOINTS.md §3.
const router = Router();

// TODO: router.post('/:id/process', processingController.process);
// TODO: router.post('/:id/resummarize', processingController.resummarize);
// TODO: router.get('/:id/status', processingController.status);

export default router;
EOF
```

### 8.9 `overview` (no model — aggregator) — `GET /api/meetings/:id`

```bash
new_stub src/modules/overview/overview.service.js "Composes meeting + transcript + summary + action-item interfaces into one detail payload. See ENDPOINTS.md §2."
new_stub src/modules/overview/overview.controller.js "HTTP-shaped: detail. See ENDPOINTS.md §2."

cat > src/modules/overview/overview.routes.js <<'EOF'
import { Router } from 'express';

// Mounted at /api/meetings in app.js, alongside meeting.routes.js. See ENDPOINTS.md §2.
const router = Router();

// TODO: router.get('/:id', overviewController.detail);

export default router;
EOF
```

### 8.10 `export` (no model) — `GET /api/meetings/:id/export`

```bash
new_stub src/modules/export/export.service.js "Composes the export payload from overview.service. See ENDPOINTS.md §6."
new_stub src/modules/export/export.markdown.js "Renders the Markdown export. See ENDPOINTS.md §6."
new_stub src/modules/export/export.pdf.js "Renders the PDF export. Must embed a font with Vietnamese diacritic coverage. See ENDPOINTS.md §6."
new_stub src/modules/export/export.controller.js "HTTP-shaped: download. Sets Content-Disposition, not an envelope response."

cat > src/modules/export/export.routes.js <<'EOF'
import { Router } from 'express';

// Mounted at /api/meetings in app.js, alongside meeting.routes.js. See ENDPOINTS.md §6.
const router = Router();

// TODO: router.get('/:id/export', exportController.download);

export default router;
EOF
```

---

## 9. Server — entry files

```bash
cat > src/app.js <<'EOF'
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

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.CLIENT_URL.split(',') }));
  app.use(express.json());
  app.use(rateLimit);

  // No auth required — confirms the process booted. See SETUP.md §5.
  app.get('/api/health', (req, res) => res.json(success({ status: 'ok' })));

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
EOF

cat > src/index.js <<'EOF'
import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { createSocketServer } from './config/socket.js';
import { logger } from './shared/logger.js';

// Event-bus subscribers, registered once at boot. See ARCHITECTURE.md §4.
import { register as registerTranscriptEvents } from './modules/transcript/transcript.events.js';
import { register as registerSummaryEvents } from './modules/summary/summary.events.js';
import { register as registerActionItemEvents } from './modules/action-item/action-item.events.js';
import { register as registerProcessingEvents } from './modules/processing/processing.events.js';

// WebSocket handlers, registered per connection on the /rt namespace.
import { register as registerProcessingSocket } from './modules/processing/processing.socket.js';
import { register as registerLiveSessionSocket } from './modules/live-session/live-session.socket.js';
import { startSweeper } from './modules/live-session/live-session.sweeper.js';

const app = createApp();
const httpServer = http.createServer(app);
const rt = createSocketServer(httpServer);

registerTranscriptEvents();
registerSummaryEvents();
registerActionItemEvents();
registerProcessingEvents(rt);

rt.on('connection', (socket) => {
  registerProcessingSocket(socket, rt);
  registerLiveSessionSocket(socket, rt);
});

startSweeper();

httpServer.listen(env.PORT, () => {
  logger.info(`NCT Meeting Summarizer server listening on port ${env.PORT}`);
});
EOF
```

---

## 10. Client — init and dependencies

```bash
cd ..   # back to repo root
npm create vite@latest client -- --template react
cd client
npm install
npm install react-router-dom socket.io-client zustand @supabase/supabase-js zod

npm pkg set engines.node=">=20"

rm -f src/App.css src/assets/react.svg

cat > .env.example <<'EOF'
VITE_API_URL=http://localhost:4000
VITE_SOCKET_URL=http://localhost:4000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=replace-me
EOF
cp .env.example .env

mkdir -p src/routes src/pages/public src/pages/authenticated src/stores src/hooks src/config src/utils src/styles
```

---

## 11. Client — entry, routes, pages

```bash
cat > src/main.jsx <<'EOF'
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles/tokens.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
EOF

cat > src/App.jsx <<'EOF'
import { Routes, Route } from 'react-router-dom';
import { routeTable } from './routes/routeTable.js';
import { RouteGuard } from './routes/RouteGuard.jsx';

// Composition root. See FRONTEND.md §2 — assembles routes only; no business
// logic and no API calls belong here.
export default function App() {
  return (
    <Routes>
      {routeTable.map(({ path, Page, tier }) => (
        <Route
          key={path}
          path={path}
          element={
            <RouteGuard tier={tier}>
              <Page />
            </RouteGuard>
          }
        />
      ))}
    </Routes>
  );
}
EOF

cat > src/routes/routeTable.js <<'EOF'
import Landing from '../pages/public/Landing.jsx';
import Login from '../pages/public/Login.jsx';
import Signup from '../pages/public/Signup.jsx';
import AuthCallback from '../pages/public/AuthCallback.jsx';
import MeetingHistory from '../pages/authenticated/MeetingHistory.jsx';
import NewMeeting from '../pages/authenticated/NewMeeting.jsx';
import MeetingDetail from '../pages/authenticated/MeetingDetail.jsx';
import LiveSession from '../pages/authenticated/LiveSession.jsx';
import Settings from '../pages/authenticated/Settings.jsx';

// Centralized URL -> page -> access tier map. See FRONTEND.md §2.
// Add a page here, not as a scattered <Route> in App.jsx.
export const routeTable = [
  { path: '/', Page: Landing, tier: 'public' },
  { path: '/login', Page: Login, tier: 'public' },
  { path: '/signup', Page: Signup, tier: 'public' },
  { path: '/auth/callback', Page: AuthCallback, tier: 'public' },
  { path: '/meetings', Page: MeetingHistory, tier: 'authenticated' },
  { path: '/meetings/new', Page: NewMeeting, tier: 'authenticated' },
  { path: '/meetings/:id', Page: MeetingDetail, tier: 'authenticated' },
  { path: '/live', Page: LiveSession, tier: 'authenticated' },
  { path: '/settings', Page: Settings, tier: 'authenticated' },
];
EOF

cat > src/routes/RouteGuard.jsx <<'EOF'
// Enforces the tier before a page renders. UX affordance, not security — every
// rule here is enforced again by the server's middleware/authorize.js.
// See FRONTEND.md §2, ARCHITECTURE.md §5.4.
export function RouteGuard({ tier, children }) {
  // TODO: read stores/auth.store.js and redirect: 'public' away from signed-in
  // users, 'authenticated' away from signed-out users.
  return children;
}
EOF
```

Pages — one helper, one call per page:

```bash
new_page() {
  mkdir -p "$(dirname "$1")"
  cat > "$1" <<EOF
export default function $2() {
  return <h1>$3</h1>;
}
EOF
}

new_page src/pages/public/Landing.jsx Landing "NCT Meeting Summarizer"
new_page src/pages/public/Login.jsx Login "Login — not implemented yet"
new_page src/pages/public/Signup.jsx Signup "Signup — not implemented yet"
new_page src/pages/public/AuthCallback.jsx AuthCallback "Signing you in…"
new_page src/pages/authenticated/MeetingHistory.jsx MeetingHistory "Your meetings — not implemented yet"
new_page src/pages/authenticated/NewMeeting.jsx NewMeeting "New meeting — not implemented yet"
new_page src/pages/authenticated/MeetingDetail.jsx MeetingDetail "Meeting detail — not implemented yet"
new_page src/pages/authenticated/LiveSession.jsx LiveSession "Live session — not implemented yet"
new_page src/pages/authenticated/Settings.jsx Settings "Settings — not implemented yet"
```

---

## 12. Client — component packages

```bash
new_component() {
  # $1 = PascalCase name, $2 = camelCase name
  local dir="src/components/$1"
  mkdir -p "$dir/sub-components"
  cat > "$dir/index.jsx" <<EOF
// $1 — see FRONTEND.md §3 for this package's responsibility.
export default function $1() {
  return <div className="$1">$1 — not implemented yet</div>;
}
EOF
  cat > "$dir/use$1.hook.js" <<EOF
// Stateful logic and event handlers for $1, decoupled from JSX. See FRONTEND.md §3.
EOF
  cat > "$dir/$2.service.js" <<EOF
// API calls scoped to $1. Uses utils/http.js and config/endpoints.js — never a bare fetch.
EOF
  touch "$dir/$1.css"
}

new_component Dropzone dropzone
new_component Recorder recorder
new_component UploadProgress uploadProgress
new_component ProcessingStatus processingStatus
new_component MeetingList meetingList
new_component SummaryView summaryView
new_component TranscriptView transcriptView
new_component ActionItemList actionItemList
new_component SpeakerLegend speakerLegend
new_component ExportMenu exportMenu
new_component LiveSessionPanel liveSessionPanel

cat > src/components/ProcessingStatus/sub-components/StatusStepper.jsx <<'EOF'
export default function StatusStepper() {
  return <div>StatusStepper — not implemented yet</div>;
}
EOF

cat > src/components/ProcessingStatus/sub-components/FailureNotice.jsx <<'EOF'
export default function FailureNotice() {
  return <div>FailureNotice — not implemented yet</div>;
}
EOF
```

---

## 13. Client — stores, hooks, config, utils, styles

```bash
cat > src/stores/auth.store.js <<'EOF'
import { create } from 'zustand';

// Supabase session, current user, signIn/signUp/signOut. The only place that
// talks to the Supabase auth client. See FRONTEND.md §6.
export const useAuthStore = create(() => ({
  // TODO: session, user, signIn, signUp, signOut
}));
EOF

cat > src/stores/socket.store.js <<'EOF'
import { create } from 'zustand';

// The one socket connection for the whole app. See ARCHITECTURE.md §3.2, FRONTEND.md §6.
export const useSocketStore = create(() => ({
  connected: false,
  // TODO: socket instance, connect(), disconnect()
}));
EOF

cat > src/stores/ui.store.js <<'EOF'
import { create } from 'zustand';

// Theme, toasts, global modals. See FRONTEND.md §6.
export const useUiStore = create(() => ({
  // TODO
}));
EOF

cat > src/hooks/useSocketEvent.js <<'EOF'
import { useEffect } from 'react';

// Subscribes to a socket event for the component's lifecycle. See FRONTEND.md §6.
export function useSocketEvent(event, handler) {
  useEffect(() => {
    // TODO: socket.on(event, handler); return () => socket.off(event, handler);
  }, [event, handler]);
}
EOF

new_stub src/hooks/useAuth.js "Thin convenience wrapper over stores/auth.store.js. See FRONTEND.md §6."

cat > src/config/endpoints.js <<'EOF'
// Single source of truth for backend paths. See ENDPOINTS.md §9.
export const ENDPOINTS = {
  meetings: {
    create:      () => '/api/meetings',
    list:        () => '/api/meetings',
    detail:      (id) => `/api/meetings/${id}`,
    process:     (id) => `/api/meetings/${id}/process`,
    resummarize: (id) => `/api/meetings/${id}/resummarize`,
    status:      (id) => `/api/meetings/${id}/status`,
    speakers:    (id) => `/api/meetings/${id}/speakers`,
    export:      (id, format) => `/api/meetings/${id}/export?format=${format}`,
  },
  actionItems: {
    list: () => '/api/action-items',
    byId: (id) => `/api/action-items/${id}`,
  },
  users: { me: () => '/api/users/me' },
};
EOF

cat > src/config/env.js <<'EOF'
import { z } from 'zod';

const schema = z.object({
  VITE_API_URL: z.string().min(1),
  VITE_SOCKET_URL: z.string().min(1),
  VITE_SUPABASE_URL: z.string().min(1),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
});

const parsed = schema.safeParse(import.meta.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
}

export const env = parsed.success ? parsed.data : import.meta.env;
EOF

cat > src/utils/http.js <<'EOF'
import { useAuthStore } from '../stores/auth.store.js';
import { env } from '../config/env.js';

// The only module that knows the response envelope shape and the 401 rule.
// See FRONTEND.md §7, ENDPOINTS.md §0.
async function request(path, init = {}) {
  const session = useAuthStore.getState().session; // TODO: once auth.store is implemented
  const res = await fetch(`${env.VITE_API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...init.headers,
    },
  });

  const body = await res.json().catch(() => ({}));

  if (res.status === 401) {
    // TODO: sign the user out via auth.store.js and redirect to /login
    throw new Error('unauthorized');
  }
  if (!res.ok || body.success === false) {
    throw new Error(body?.error?.message ?? res.statusText);
  }
  return body.data;
}

export const http = {
  get:    (path) => request(path),
  post:   (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  patch:  (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
EOF

cat > src/utils/supabase.js <<'EOF'
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

// Browser Supabase client — anon key only. See SETUP.md §3.
export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
EOF

new_stub src/utils/constants.js "MIME allowlist, size limit, category colours, status->step labels. Mirror ENDPOINTS.md §7 and MODELS.md §1 exactly — this and server/src/shared/constants.js must never drift."
new_stub src/utils/format.js "Duration, date, and timestamp formatting helpers. See FRONTEND.md §7."

cat > src/styles/tokens.css <<'EOF'
:root {
  /* Design tokens. See FRONTEND.md §8. Fill in the palette, spacing, and type
     scale once the visual direction is decided — components consume these,
     they do not define their own. */
}
EOF
```

---

## 14. Optional — root convenience script

```bash
cd ..   # repo root
npm init -y
npm pkg set private=true
npm pkg set scripts.dev="concurrently \"npm:dev:server\" \"npm:dev:client\""
npm pkg set scripts.dev:server="npm --prefix server run dev"
npm pkg set scripts.dev:client="npm --prefix client run dev"
npm install --save-dev concurrently
```

---

## 15. Smoke test — run this after every step above

```bash
# Terminal 1
cd server && npm run dev
# Expect: "NCT Meeting Summarizer server listening on port 4000" — no crash.

# Terminal 2
curl http://localhost:4000/api/health
# Expect: {"success":true,"data":{"status":"ok"}}

curl http://localhost:4000/api/meetings
# Expect a 404 envelope, e.g.:
# {"success":false,"error":{"code":"not_found","message":"No route for GET /api/meetings"}}
# This confirms routing + error handling wire correctly end to end, with no
# business logic implemented yet.

# Terminal 3
cd client && npm run dev
# Open http://localhost:5173 — expect an "NCT Meeting Summarizer" heading.

cd client && npm run build
# Expect a clean build with no errors.
```

If all four checks pass, both apps are wired correctly and the team can start
filling in `TODO`s — starting with Stage 1 in `DELIVERABLES.md` §5. Real Supabase
and Groq calls will fail until real credentials replace the `replace-me`
placeholders in `server/.env` — that is expected at this stage.

---

## 16. Commit

```bash
cd ..   # repo root
git add -A
git commit -m "chore: scaffold client/server skeleton per ARCHITECTURE.md"
```
