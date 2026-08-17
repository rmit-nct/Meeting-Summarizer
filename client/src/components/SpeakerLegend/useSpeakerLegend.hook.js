import { useState } from 'react';
import { renameSpeakers } from './speakerLegend.service.js';

// Owns the working copy of this meeting's speakers, seeded from the parent's
// fetch. Renames are optimistic against the bulk PATCH endpoint
// (ENDPOINTS.md §5) with a rollback on failure — a rename doesn't
// automatically propagate into SummaryView's already-fetched points in the
// same tick; MeetingDetail's next full refetch (e.g. on a later status
// change) picks up the resolved server value.
export function useSpeakerLegend(meetingId, initialSpeakers) {
  const [speakers, setSpeakers] = useState(initialSpeakers ?? []);

  function rename(speakerId, displayName) {
    const previous = speakers;
    setSpeakers((current) => current.map((s) => (s.id === speakerId ? { ...s, displayName } : s)));
    renameSpeakers(meetingId, [{ id: speakerId, displayName }]).catch((err) => {
      setSpeakers(previous);
      throw err;
    });
  }

  return { speakers, rename };
}
