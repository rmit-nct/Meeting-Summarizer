import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { AppError, invalidState, unauthorized } from '../../shared/errors.js';
import { toPublicUser } from './auth.dto.js';
import * as repository from './auth.repository.js';

const DUMMY_HASH = '$2b$12$9Q2J3t6F5L5Y9MRR8Y7zQOzQ4xGqWqJzM7PCP0oHH8vEH8xDxl7dK';
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
function signAccessToken(user) {
  const expireAt = Date.now() + env.ACCESS_TOKEN_TTL_MIN * 60_000;
  return jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role, expireAt, jti: crypto.randomUUID() }, env.JWT_ACCESS_SECRET, { expiresIn: `${env.ACCESS_TOKEN_TTL_MIN}m` });
}
// jti makes every token unique even when two are signed for the same user in
// the same second — jwt.sign is otherwise deterministic (iat has 1s
// granularity), so two concurrent refreshes would sign byte-identical
// tokens and the second insertRefreshToken would collide on the
// refresh_tokens.token_hash unique constraint.
function signRefreshToken(user) {
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  const token = jwt.sign({ id: user.id, type: 'refresh', jti: crypto.randomUUID() }, env.JWT_REFRESH_SECRET, { expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d` });
  return { token, tokenHash: hashToken(token), expiresAt };
}
async function issueSession(user) {
  const refreshTokenData = signRefreshToken(user);
  await repository.insertRefreshToken({ userId: user.id, ...refreshTokenData });
  return { user: toPublicUser(user), accessToken: signAccessToken(user), refreshToken: refreshTokenData.token };
}
export async function register(input) {
  if (await repository.findUserByEmail(input.email)) throw invalidState('Email is already registered');
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  try { return await issueSession(await repository.createUser({ ...input, passwordHash })); }
  catch (error) { if (error.code === '23505') throw invalidState('Email is already registered'); throw error; }
}
export async function login(input) {
  const user = await repository.findUserByEmail(input.email);
  const valid = await bcrypt.compare(input.password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !valid) throw unauthorized('Invalid email or password');
  return issueSession(user);
}
export async function refresh(refreshToken) {
  let payload;
  try { payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET); }
  catch { throw unauthorized('Invalid or expired refresh token'); }
  if (payload.type !== 'refresh') throw unauthorized('Invalid refresh token');
  const tokenHash = hashToken(refreshToken);
  const stored = await repository.findRefreshTokenByHash(tokenHash);
  if (!stored || stored.revoked_at || new Date(stored.expires_at) <= new Date()) throw unauthorized('Refresh token has been revoked or expired');
  const user = await repository.findUserById(payload.id);
  if (!user) throw unauthorized('User no longer exists');
  await repository.revokeRefreshToken(tokenHash);
  return issueSession(user);
}
export async function logout(refreshToken) { await repository.revokeRefreshToken(hashToken(refreshToken)); }
export function verifyAccessToken(token) {
  try { const payload = jwt.verify(token, env.JWT_ACCESS_SECRET); if (!payload.id || payload.type === 'refresh') throw new Error(); return payload; }
  catch (error) { if (error.name === 'TokenExpiredError') throw new AppError('token_expired', 'Access token expired', 401); throw unauthorized('Invalid access token'); }
}
export async function getUserById(id) {
  const user = await repository.findUserById(id); if (!user) throw unauthorized('User no longer exists'); return toPublicUser(user);
}
