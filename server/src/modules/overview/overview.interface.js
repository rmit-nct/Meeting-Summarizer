// Public contract: exposes the composed meeting-detail payload to modules
// that need the exact same view GET /api/meetings/:id renders — currently
// just `export`, which must never disagree with what the screen shows
// (ENDPOINTS.md §6). See ARCHITECTURE.md §2.1.
import { overviewService } from './overview.service.js';

export const overviewInterface = {
  getDetail: overviewService.getDetail,
};
