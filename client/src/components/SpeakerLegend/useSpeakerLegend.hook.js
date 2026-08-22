import { renameSpeaker } from '../../utils/mockData.js';

// Real: calls speakerLegend.service.js (PATCH /api/meetings/:id/speakers, bulk). Until then
// writes straight to the reactive mock store.
export function useSpeakerLegend(meetingId) {
  return {
    rename: (speakerId, displayName) => renameSpeaker(meetingId, speakerId, displayName),
  };
}
