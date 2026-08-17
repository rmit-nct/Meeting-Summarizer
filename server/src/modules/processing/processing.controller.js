// HTTP-shaped: process, resummarize, status. See ENDPOINTS.md §3.
import { success } from '../../shared/response.js';
import { processingService } from './processing.service.js';

async function process(req, res, next) {
  try {
    const meeting = await processingService.startProcessing(req.params.id, req.user.id);
    res.status(202).json(success({ meetingId: meeting.id, status: meeting.status }));
  } catch (err) {
    next(err);
  }
}

async function resummarize(req, res, next) {
  try {
    const meeting = await processingService.resummarize(req.params.id, req.user.id);
    res.status(202).json(success({ meetingId: meeting.id, status: meeting.status }));
  } catch (err) {
    next(err);
  }
}

async function status(req, res, next) {
  try {
    const data = await processingService.getStatus(req.params.id, req.user.id);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export const processingController = { process, resummarize, status };
