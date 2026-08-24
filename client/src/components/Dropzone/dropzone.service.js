// Dropzone-scoped upload wrapper. The full sequence (signed URL → PUT →
// trigger processing) lives in utils/upload.js and is shared with Recorder.
import { performUpload } from '../../utils/upload.js';

export function uploadDroppedFile(meetingId, file, { onProgress, signal } = {}) {
  return performUpload(
    meetingId,
    file,
    {
      // 'upload' is how the file got here (vs. 'recording'/'live') — content
      // type (audio/video/text transcript) is decided server-side by the
      // transcript module's parser factory off mimeType, not sourceType.
      // 'text' isn't a valid meeting_source (MODELS.md §1) and was rejected
      // by both the zod validator and the DB enum.
      sourceType: 'upload',
      originalFilename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    },
    { onProgress, signal },
  );
}
