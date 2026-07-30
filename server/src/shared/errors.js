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
