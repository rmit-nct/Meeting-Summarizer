// Signed-URL issuance for direct browser-to-Storage uploads, plus the MIME/size allowlist. See ENDPOINTS.md §7.
import path from 'node:path';
import { supabase } from './supabase.js';
import { env } from './env.js';
import { ALLOWED_UPLOAD_MIME_TYPES } from '../shared/constants.js';

export const MAX_UPLOAD_BYTES = env.MAX_UPLOAD_BYTES;

export function isAllowedMimeType(mimeType) {
  return ALLOWED_UPLOAD_MIME_TYPES.includes(mimeType);
}

// Storage keys are a restricted character set, and these filenames will very
// often be Vietnamese ("Họp nhóm tuần 3.m4a"). Strip diacritics, collapse
// everything else to a hyphen, and keep the extension so the MIME stays
// guessable when someone browses the bucket.
export function sanitizeFilename(original) {
  const ext = path.extname(original).toLowerCase().slice(0, 10);
  const base = path.basename(original, path.extname(original));

  const ascii = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // combining accents
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

  const safe = ascii
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 100);

  return `${safe || 'recording'}${ext}`;
}

// {user_id}/{meeting_id}/{filename} — see MODELS.md §4. Putting the user id
// first means a future storage policy can scope on the path prefix, and it
// keeps one user's objects together when you're debugging in the dashboard.
export function buildStoragePath(userId, meetingId, originalFilename) {
  return `${userId}/${meetingId}/${sanitizeFilename(originalFilename)}`;
}

// Returns { signedUrl, token, path }. The browser PUTs the bytes straight to
// signedUrl — media never traverses this API (ARCHITECTURE.md §1).
//
// The token is valid for two hours, which is Supabase's fixed default for
// upload URLs and is not configurable per-call.
export async function createSignedUploadUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error) throw error;
  return { signedUrl: data.signedUrl, token: data.token, path: data.path ?? storagePath };
}

// Short-lived download URL, used by the processing module to fetch the object
// and by the client to re-download an original file.
export async function createSignedDownloadUrl(storagePath, expiresInSeconds = 300) {
  const { data, error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) throw error;
  return data.signedUrl;
}

// True once the browser has actually finished PUTting the object.
//
// Needed because POST /:id/upload flips status to 'uploaded' when it issues the
// URL, before any bytes exist. If the browser upload then fails, the row claims
// a file that was never written. Call this before processing, and to decide
// whether a re-upload should be allowed.
export async function objectExists(storagePath) {
  const dir = path.posix.dirname(storagePath);
  const name = path.posix.basename(storagePath);

  const { data, error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .list(dir, { search: name, limit: 100 });

  if (error) throw error;
  return (data ?? []).some((entry) => entry.name === name);
}

export async function removeObject(storagePath) {
  if (!storagePath) return;
  const { error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .remove([storagePath]);
  if (error) throw error;
}