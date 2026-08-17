// Signed-URL issuance for direct browser-to-Storage uploads, plus the MIME/size allowlist. See ENDPOINTS.md §7, MODELS.md §4.
import { supabase } from './supabase.js';
import { env } from './env.js';

// {user_id}/{meeting_id}/{original_filename} — matches the storage.objects RLS
// policy in MODELS.md §4, which checks (storage.foldername(name))[1] against
// auth.uid(). Sanitize the filename: it lands in a URL path segment and must
// not let the user smuggle a `/` to escape their own folder.
function buildStoragePath(userId, meetingId, originalFilename) {
  const safeName = originalFilename.replace(/[/\\]/g, '_').trim() || 'file';
  return `${userId}/${meetingId}/${safeName}`;
}

export async function createSignedUploadUrl(userId, meetingId, originalFilename) {
  const path = buildStoragePath(userId, meetingId, originalFilename);
  const { data, error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .createSignedUploadUrl(path);
  if (error) throw error;

  return { signedUrl: data.signedUrl, path: data.path, token: data.token };
}
