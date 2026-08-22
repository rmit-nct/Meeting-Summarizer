import { http } from '../../utils/http.js';
import { ENDPOINTS } from '../../config/endpoints.js';

// Not called yet — see useActionItemList.hook.js. Shapes match ENDPOINTS.md §4.
export const create = (data) => http.post(ENDPOINTS.actionItems.list(), data);
export const patch = (id, data) => http.patch(ENDPOINTS.actionItems.byId(id), data);
export const remove = (id) => http.delete(ENDPOINTS.actionItems.byId(id));
