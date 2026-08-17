// Verifies the Supabase access token and sets req.user. See ENDPOINTS.md §0.
import { authInterface } from '../modules/auth/auth.interface.js';
import { unauthorized } from '../shared/errors.js';

export function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw unauthorized();
    req.user = authInterface.getUser(token);
    next();
  } catch (err) {
    next(err);
  }
}
