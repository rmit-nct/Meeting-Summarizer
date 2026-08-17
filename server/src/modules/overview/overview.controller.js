// HTTP-shaped: detail. See ENDPOINTS.md §2.
import { success } from '../../shared/response.js';
import { overviewService } from './overview.service.js';

async function detail(req, res, next) {
  try {
    const data = await overviewService.getDetail(req.params.id, req.user.id);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export const overviewController = { detail };
