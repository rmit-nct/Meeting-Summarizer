// HTTP-shaped: file download, not the JSON envelope (ENDPOINTS.md §6 — "Not
// an envelope response"). Reads the same composed payload GET /:id renders
// (overview.interface.js) so an export can never disagree with the screen.
import { overviewInterface } from '../overview/overview.interface.js';
import { exportSummary } from './export.service.js';
import { toExportSummary, toExportMeta } from './export.adapter.js';
import { invalidState } from '../../shared/errors.js';

const CONTENT_TYPES = { md: 'text/markdown; charset=utf-8', pdf: 'application/pdf' };

// Mirrors config/upload.js#sanitizeFilename's accent-stripping approach —
// titles are very often Vietnamese ("Hop nhom tuan 3").
function slugify(title) {
  const slug = (title ?? 'meeting')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // combining accents
    .replace(/đ/g, 'd') // đ
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'meeting';
}

async function download(req, res, next) {
  try {
    const { format } = req.query;
    const overview = await overviewInterface.getDetail(req.params.id, req.user.id);

    if (!overview.summary) {
      throw invalidState('This meeting has no summary yet — process or resummarize it first.');
    }

    const body = await exportSummary(
      format,
      toExportSummary(overview),
      toExportMeta(overview.meeting),
    );

    res.setHeader('Content-Type', CONTENT_TYPES[format]);
    res.setHeader('Content-Disposition', `attachment; filename="${slugify(overview.meeting.title)}.${format}"`);
    res.send(body);
  } catch (err) {
    next(err);
  }
}

export const exportController = { download };
