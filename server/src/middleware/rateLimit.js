// Centralized rate limiting. See ARCHITECTURE.md §2.5. Wire express-rate-limit
// (or similar) here once Groq usage needs protecting.
export function rateLimit(req, res, next) {
  next();
}
