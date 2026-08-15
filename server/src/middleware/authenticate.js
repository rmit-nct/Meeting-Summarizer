// Verifies the access token and sets req.user. See ENDPOINTS.md §0.
import { unauthorized } from '../shared/errors.js';

// =============================================================================
// TEMPORARY DEV SHIM — DELETE WHEN Tâm's auth MODULE MERGES (phase-03, card #07)
//
// Every downstream file reads req.user.id and nothing else, so swapping the
// real implementation in changes nothing outside this file.
//
// To use: put a real uuid from your `users` table in DEV_USER_ID below.
// Create one first, because meetings.user_id has a FK to users(id) and an
// insert with a made-up uuid will fail:
//
//   insert into public.users (email, password_hash, name)
//   values ('kiet@dev.local', 'not-a-real-hash', 'Kiet')
//   returning id;
//
// The shim is gated on NODE_ENV !== 'production' so that if this file ever
// reaches a deploy by accident, it fails closed with a 401 instead of handing
// every anonymous request a real user's data.
// =============================================================================
const DEV_USER_ID = '8c6a975b-0315-4db5-a8c6-3539ed6b121f' || 'paste-a-uuid-from-your-users-table';

export function authenticate(req, res, next) {
  // TODO: replace the whole body with:
  //   const payload = await authInterface.verifyAccessToken(bearerFrom(req));
  //   req.user = { id: payload.sub, email: payload.email, role: payload.role };
  if (process.env.NODE_ENV === 'production') {
    return next(unauthorized('Auth module not wired yet'));
  }

  req.user = { id: DEV_USER_ID, email: 'kiet@dev.local', role: 'user' };
  next();
}