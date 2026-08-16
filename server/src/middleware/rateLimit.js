import { rateLimit as createRateLimit } from 'express-rate-limit';
import { failure } from '../shared/response.js';

const handler = (req, res) => res.status(429).json(failure('rate_limited', 'Too many attempts', {
  retryAfterMs: Math.max(0, Number(res.getHeader('Retry-After') ?? 0) * 1000),
}));
export const loginRateLimit = createRateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false, handler });
export const registerRateLimit = createRateLimit({ windowMs: 3_600_000, limit: 10, standardHeaders: true, legacyHeaders: false, handler });
export function rateLimit(req, res, next) { next(); }
