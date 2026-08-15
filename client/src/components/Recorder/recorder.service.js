// Recorder-scoped upload wrapper. Same shared upload flow as Dropzone.
import { performUpload } from '../../utils/upload.js';

export function uploadRecording(meetingId, blob, mimeType, { onProgress, signal } = {}) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const extension = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'm4a' : 'ogg';
  const filename = `recording-${stamp}.${extension}`;

  return performUpload(
    meetingId,
    blob,
    {
      sourceType: 'recording',
      originalFilename: filename,
      mimeType,
      sizeBytes: blob.size,
    },
    { onProgress, signal },
  );
}
