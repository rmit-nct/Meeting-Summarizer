// HTTP-shaped: list, create, update, remove. See ENDPOINTS.md §4.
import { actionItemService } from './action-item.service.js';
import { actionItemValidator } from './action-item.validator.js';
import { success, paginate } from '../../shared/response.js';
import { validationFailed } from '../../shared/errors.js';

export async function list(req, res, next) {
  try {
    const parsed = actionItemValidator.listQuery.safeParse(req.query);
    if (!parsed.success) {
      throw validationFailed('Invalid query parameters', parsed.error.flatten());
    }

    const { page, limit } = parsed.data;
    const { actionItems, total } = await actionItemService.list(req.user.id, parsed.data);
    res.json(success({ actionItems }, paginate(page, limit, total)));
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const actionItem = await actionItemService.create(req.user.id, req.body);
    res.status(201).json(success({ actionItem }));
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const actionItem = await actionItemService.update(req.user.id, req.params.id, req.body);
    res.json(success({ actionItem }));
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const result = await actionItemService.remove(req.user.id, req.params.id);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export const actionItemController = { list, create, update, remove };