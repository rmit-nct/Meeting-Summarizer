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
