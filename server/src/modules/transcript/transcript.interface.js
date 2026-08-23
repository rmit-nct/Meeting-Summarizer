// Exposes getTranscriptForOwner(). See ARCHITECTURE.md §2.1.
import { transcriptRepository } from './transcript.repository.js';

async function getTranscriptForOwner(meetingId, userId) {
  return transcriptRepository.findByMeetingId(meetingId, userId);
}

export const transcriptInterface = { getTranscriptForOwner };
