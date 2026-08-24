export function toPublicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role,
    avatarUrl: user.avatar_url ?? null, createdAt: user.created_at, updatedAt: user.updated_at };
}
