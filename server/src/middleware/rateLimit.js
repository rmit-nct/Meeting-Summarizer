// Centralized rate limiting. See ARCHITECTURE.md §2.5. General request cap
// applied globally in app.js, plus a stricter cap on the two endpoints that
// actually spend a Groq call — protects the free-tier limits
// AI_INTEGRATION.md §7 calls out ("never re-transcribe in a loop").
import rateLimitLib from 'express-rate-limit';
import { failure } from '../shared/response.js';

function tooMany(message) {
  return (req, res) => res.status(429).json(failure('rate_limited', message));
}

export const rateLimit = rateLimitLib({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany('Too many requests, please slow down.'),
});

export const aiPipelineRateLimit = rateLimitLib({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany('Too many processing requests, please wait a moment before retrying.'),
});
