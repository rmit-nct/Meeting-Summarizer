// Role checks. The brief defines no roles beyond "authenticated user" today —
// this exists for the scaffolded 'elevated' tier. See ARCHITECTURE.md §5.4.
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    // TODO: check req.user.role against allowedRoles once roles exist.
    next();
  };
}
