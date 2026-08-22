// Dropzone-scoped upload wrapper. The full sequence (signed URL → PUT →
// trigger processing) lives in utils/upload.js and is shared with Recorder.
import { performUpload } from '../../utils/upload.js';
import { categorizeMime } from '../../utils/constants.js';

export function uploadDroppedFile(meetingId, file, { onProgress, signal } = {}) {
  return performUpload(
    meetingId,
    file,
    {
      sourceType: categorizeMime(file.type) === 'text' ? 'text' : 'upload',
      originalFilename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    },
    { onProgress, signal },
  );
}
