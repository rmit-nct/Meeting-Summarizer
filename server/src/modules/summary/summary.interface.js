// Exposes getSummaryForOwner() and generateSummary(). See ARCHITECTURE.md §2.1.
// `processing` calls generateSummary() directly to drive resummarize; the
// module's own summary.events.js calls summary.service the same way for the
// transcript:created-triggered path — both point at the same function.
import { summaryRepository } from './summary.repository.js';
import { speakerRepository } from './speaker.repository.js';
import { summaryService } from './summary.service.js';

async function getSummaryForOwner(meetingId, userId) {
  const [summary, points, speakers] = await Promise.all([
    summaryRepository.findByMeetingId(meetingId, userId),
    summaryRepository.findPointsWithSpeaker(meetingId, userId),
    speakerRepository.findByMeetingId(meetingId, userId),
  ]);
  return { summary, points, speakers };
}

export const summaryInterface = {
  getSummaryForOwner,
  generateSummary: summaryService.generateSummary,
};
