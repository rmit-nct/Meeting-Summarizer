// HTTP-shaped: list, create, update, remove. See ENDPOINTS.md §4.
import { success, paginate } from '../../shared/response.js';
import { actionItemService } from './action-item.service.js';

async function list(req, res, next) {
  try {
    const { page, limit } = req.query;
    const { items, total } = await actionItemService.list(req.user.id, req.query);
    res.json(success(items, paginate(page, limit, total)));
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const item = await actionItemService.create(req.user.id, req.body);
    res.status(201).json(success({ actionItem: item }));
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const item = await actionItemService.update(req.user.id, req.params.id, req.body);
    res.json(success({ actionItem: item }));
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const data = await actionItemService.remove(req.user.id, req.params.id);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export const actionItemController = { list, create, update, remove };
