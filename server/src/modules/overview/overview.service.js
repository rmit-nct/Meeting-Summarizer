// Composes meeting + transcript + summary + action-item interfaces into one detail payload. See ENDPOINTS.md §2.
import { meetingInterface } from '../meeting/meeting.interface.js';
import { transcriptInterface } from '../transcript/transcript.interface.js';
import { summaryInterface } from '../summary/summary.interface.js';
import { actionItemInterface } from '../action-item/action-item.interface.js';
import { toMeetingDto } from '../meeting/meeting.dto.js';
import { toTranscriptDto } from '../transcript/transcript.dto.js';
import { toSummaryDto, toSpeakersDto } from '../summary/summary.dto.js';

async function getDetail(meetingId, userId) {
  // Ownership gate first — a missing/foreign meeting must 404 as a whole,
  // not return partial nulls for the other slices.
  const meeting = await meetingInterface.getMeetingForOwner(meetingId, userId);

  const [transcript, summaryData, actionItems] = await Promise.all([
    transcriptInterface.getTranscriptForOwner(meetingId, userId),
    summaryInterface.getSummaryForOwner(meetingId, userId),
    actionItemInterface.listForOwner(meetingId, userId),
  ]);

  return {
    meeting: toMeetingDto(meeting),
    transcript: toTranscriptDto(transcript),
    summary: toSummaryDto(summaryData.summary, summaryData.points),
    actionItems,
    speakers: toSpeakersDto(summaryData.speakers),
  };
}

export const overviewService = { getDetail };
