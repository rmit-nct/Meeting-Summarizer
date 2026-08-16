import { verifyAccessToken } from '../modules/auth/auth.interface.js';
import { unauthorized } from '../shared/errors.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(unauthorized('Missing bearer token'));
  try { req.user = verifyAccessToken(header.slice(7)); return next(); }
  catch (error) { return next(error); }
}
