// HTTP-shaped: create, list, update, remove, upload. See ENDPOINTS.md §2.
import { success, paginate } from '../../shared/response.js';
import { meetingService } from './meeting.service.js';

async function create(req, res, next) {
  try {
    const meeting = await meetingService.createMeeting(req.user.id, req.body);
    res.status(201).json(success({ meeting }));
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const { page, limit } = req.query;
    const { items, total } = await meetingService.listMeetings(req.user.id, req.query);
    res.json(success(items, paginate(page, limit, total)));
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const meeting = await meetingService.updateMeeting(req.params.id, req.user.id, req.body);
    res.json(success({ meeting }));
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const data = await meetingService.removeMeeting(req.params.id, req.user.id);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

async function upload(req, res, next) {
  try {
    const data = await meetingService.attachUpload(req.params.id, req.user.id, req.body);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export const meetingController = { create, list, update, remove, upload };
