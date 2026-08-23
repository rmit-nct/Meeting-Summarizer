// HTTP-shaped: renameSpeakers. See ENDPOINTS.md §5.
import { success } from '../../shared/response.js';
import { speakerRepository } from './speaker.repository.js';
import { toSpeakersDto } from './summary.dto.js';
import { meetingInterface } from '../meeting/meeting.interface.js';

async function renameSpeakers(req, res, next) {
  try {
    // Ownership check: bulkRename scopes by userId per-row, but confirming
    // the meeting itself belongs to this user first gives a clean 404
    // instead of a silent no-op on a foreign meetingId.
    await meetingInterface.assertOwnership(req.params.id, req.user.id);
    const updated = await speakerRepository.bulkRename(req.user.id, req.body.speakers);
    res.json(success({ speakers: toSpeakersDto(updated) }));
  } catch (err) {
    next(err);
  }
}

export const summaryController = { renameSpeakers };
