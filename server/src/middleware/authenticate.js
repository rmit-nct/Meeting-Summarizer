// Verifies the Supabase access token and sets req.user. See ENDPOINTS.md §0.
export function authenticate(req, res, next) {
  // TODO: verify the bearer token via modules/auth/auth.interface.js, set req.user,
  // and reject with 401 unauthorized on failure.
  next();
}
