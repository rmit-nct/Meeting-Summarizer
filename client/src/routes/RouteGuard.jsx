// Enforces the tier before a page renders. UX affordance, not security — every
// rule here is enforced again by the server's middleware/authorize.js.
// See FRONTEND.md §2, ARCHITECTURE.md §5.4.
export function RouteGuard({ tier, children }) {
  // TODO: read stores/auth.store.js and redirect: 'public' away from signed-in
  // users, 'authenticated' away from signed-out users.
  return children;
}
