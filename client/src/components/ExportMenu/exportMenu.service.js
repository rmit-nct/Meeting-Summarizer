import { ENDPOINTS } from '../../config/endpoints.js';

// Not a JSON call — GET /api/meetings/:id/export?format=md|pdf is a file download
// (ENDPOINTS.md §6). Real usage is just handing this href to the browser, e.g. as an
// <a download href={exportUrl(meetingId, 'pdf')}>.
export const exportUrl = (meetingId, format) => ENDPOINTS.meetings.export(meetingId, format);
