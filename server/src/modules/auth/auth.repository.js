import { supabase } from '../../config/supabase.js';

function unwrap(result) { if (result.error) throw result.error; return result.data; }
export async function createUser({ email, passwordHash, name }) {
  return unwrap(await supabase.from('users').insert({ email, password_hash: passwordHash, name }).select().single());
}
export async function findUserByEmail(email) {
  return unwrap(await supabase.from('users').select('*').ilike('email', email).maybeSingle());
}
export async function findUserById(id) {
  return unwrap(await supabase.from('users').select('*').eq('id', id).maybeSingle());
}
export async function insertRefreshToken({ userId, tokenHash, expiresAt }) {
  return unwrap(await supabase.from('refresh_tokens').insert({ user_id: userId, token_hash: tokenHash,
    expires_at: expiresAt.toISOString() }).select().single());
}
export async function findRefreshTokenByHash(tokenHash) {
  return unwrap(await supabase.from('refresh_tokens').select('*').eq('token_hash', tokenHash).maybeSingle());
}
export async function revokeRefreshToken(tokenHash) {
  return unwrap(await supabase.from('refresh_tokens').update({ revoked_at: new Date().toISOString() })
    .eq('token_hash', tokenHash).is('revoked_at', null).select());
}
