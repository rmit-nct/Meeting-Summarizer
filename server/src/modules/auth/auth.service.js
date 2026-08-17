// Verifies Supabase JWTs, resolves the request user. See ARCHITECTURE.md §2.2.
// The server never issues its own token — sign-in/up/out happen client-side
// against Supabase Auth (ENDPOINTS.md §0); this only verifies what Supabase
// already signed, using the project's JWT secret (HS256).
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { unauthorized } from '../../shared/errors.js';

function verifyToken(token) {
  if (!token) throw unauthorized('Missing bearer token');
  try {
    return jwt.verify(token, env.SUPABASE_JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    throw unauthorized('Invalid or expired token');
  }
}

function getUser(token) {
  const payload = verifyToken(token);
  if (!payload.sub) throw unauthorized('Token has no subject');
  return { id: payload.sub, email: payload.email ?? null };
}

export const authService = { verifyToken, getUser };
