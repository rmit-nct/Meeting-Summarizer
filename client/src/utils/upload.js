// Shared upload utility. Dropzone and Recorder both call `performUpload`.
// The signed-URL/XHR/processing-trigger sequence is identical for both — the
// only difference is the caller (drop-a-File vs record-a-Blob).
import { http } from './http.js';
import { ENDPOINTS } from '../config/endpoints.js';

function requestSignedUrl(meetingId, meta) {
  return http.post(ENDPOINTS.meetings.upload(meetingId), meta);
}

// XHR, not fetch — fetch has no upload-progress event, and byte progress is
// the whole point of UploadProgress. This PUTs straight to Supabase Storage;
// media bytes never pass through our API (CLAUDE.md rule #6).
function uploadBytes(signedUrl, blob, mimeType, { onProgress, signal }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('Content-Type', mimeType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (HTTP ${xhr.status})`));
    xhr.onerror = () => reject(new Error('Network error during upload'));
    signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(blob);
  });
}

function triggerProcessing(meetingId) {
  return http.post(ENDPOINTS.meetings.process(meetingId));
}

/**
 * Full upload flow: signed URL → PUT to Storage → kick off processing.
 * Same call site for Dropzone (File) and Recorder (Blob).
 */
export async function performUpload(meetingId, blob, meta, { onProgress, signal } = {}) {
  const { upload } = await requestSignedUrl(meetingId, meta);
  await uploadBytes(upload.signedUrl, blob, meta.mimeType, { onProgress, signal });
  return triggerProcessing(meetingId);
}
