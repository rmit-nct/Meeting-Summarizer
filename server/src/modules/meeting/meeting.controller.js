// HTTP-shaped: create, list, update, upload, remove. See ENDPOINTS.md §2, §5.
import { meetingService } from './meeting.service.js';
import { meetingValidator } from './meeting.validator.js';
import { success, paginate } from '../../shared/response.js';
import { validationFailed } from '../../shared/errors.js';

// Controllers do three things and no more: read req, call the service, shape
// the response. No supabase, no business rules, and no res.status(4xx) —
// errors are thrown and middleware/errorHandler.js formats them.

export async function create(req, res, next) {
  try {
    const meeting = await meetingService.create(req.user.id, req.body);
    res.status(201).json(success({ meeting }));
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    // middleware/validate.js only parses req.body, so query params are
    // validated here. In Express 5 req.query is a getter and cannot be
    // reassigned — keep the parsed result in a local.
    const parsed = meetingValidator.listQuery.safeParse(req.query);
    if (!parsed.success) {
      throw validationFailed('Invalid query parameters', parsed.error.flatten());
    }

    const { page, limit } = parsed.data;
    const { meetings, total } = await meetingService.list(req.user.id, parsed.data);
    res.json(success({ meetings }, paginate(page, limit, total)));
  } catch (err) {
    next(err);
  }
}

export async function detail(req, res, next) {
  try {
    const meeting = await meetingService.getById(req.user.id, req.params.id);
    res.json(success({ meeting }));
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const meeting = await meetingService.update(req.user.id, req.params.id, req.body);
    res.json(success({ meeting }));
  } catch (err) {
    next(err);
  }
}

// Returns { meeting, upload: { signedUrl, path, token } }. The client then PUTs
// the file to signedUrl itself — this endpoint never touches the bytes.
export async function upload(req, res, next) {
  try {
    const result = await meetingService.attachUpload(req.user.id, req.params.id, req.body);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const result = await meetingService.remove(req.user.id, req.params.id);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export const meetingController = { create, list, detail, update, upload, remove };