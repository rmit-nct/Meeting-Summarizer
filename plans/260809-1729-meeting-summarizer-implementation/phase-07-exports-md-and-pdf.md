# Phase 7 — Exports (MD + PDF)

## Context Links
- Phase 6 (`overview.service.detail` returns the composed payload)
- `docs/server.doc/ENDPOINTS.md` §6 (export endpoint contract, file-download not envelope)
- `docs/system.doc/AI_INTEGRATION.md` §? (Vietnamese diacritic font warning — carried into MD/PDF)
- Brainstorm §3.6 (re-download NEVER re-calls OpenAI)

## Overview
- **Priority:** High — MD + PDF are Core requirements (`DELIVERABLES.md` §4)
- **Status:** pending
- **Description:** `export` module reads composed payload from `overview.interface`, renders to Markdown (in-tree template) or PDF (`pdfkit` with embedded Be Vietnam Pro font). Response is a file download with `Content-Disposition`, **not** an envelope. Re-download never calls OpenAI.

## Key Insights
- MD renderer is a pure function from payload → string. Trivially unit-testable — one of the two mandatory unit tests from `LESSONS_FROM_TUTORBOT.md` §2
- PDF **must** embed a Vietnamese-diacritic-capable font (Be Vietnam Pro or Noto Sans). Default `pdfkit` font drops diacritics silently.
- `pdfkit` chosen over `puppeteer` (brainstorm §4 open decisions §8):
  - No headless-browser dep → faster server cold start on Render free tier
  - No system Chrome install → simpler Dockerfile
  - Full control over Vietnamese font embedding
  - Trade-off accepted: PDF is less "pretty" than a browser-rendered HTML→PDF, but this is meeting minutes not a marketing brochure
- **Never re-calls OpenAI.** Both renderers read from `overview.interface.detail` (or directly from `summaries.raw_response` — both are stored data)

## Requirements
- **Functional:** `GET /api/meetings/:id/export?format=md|pdf` streams a file with correct filename slug + extension. Both formats include the same content (title, date, duration, participants, overview, bullets grouped by category, action item table)
- **Non-functional:** Vietnamese diacritics render in the PDF. Renderers run <500 ms for a typical meeting.

## Architecture
```
export.controller.download(req, res):
  const format = req.query.format   // 'md' | 'pdf'
  const data   = await overview.interface.detail(meetingId, userId)   // reuses Phase 6
  const filename = slugify(data.meeting.title) + (format==='md' ? '.md' : '.pdf')
  res.setHeader('Content-Type', format==='md' ? 'text/markdown' : 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  format==='md' ? res.send(renderMarkdown(data)) : renderPdf(data, res)  // pdfkit pipes to res
```

No LLM call. No file re-generation from raw material. Reads DB → renders → serves.

## Related Code Files
Fill:
- `server/src/modules/export/export.service.js` — thin orchestrator: fetch data, call correct renderer
- `server/src/modules/export/export.markdown.js` — pure `renderMarkdown(data) → string`
- `server/src/modules/export/export.pdf.js` — `renderPdf(data, res)` pipes to response
- `server/src/modules/export/export.controller.js` — Express handler, sets headers, calls service, streams
- `server/src/modules/export/export.routes.js` — uncomment `GET /:id/export`
- `server/src/modules/overview/overview.interface.js` — expose `detail(meetingId, userId)` so `export` doesn't reach into the controller

Add:
- `server/src/modules/export/be-vietnam-pro-regular.ttf` — bundled font (open license). Reference from `export.pdf.js`.
- `server/src/modules/export/be-vietnam-pro-bold.ttf` — for headings

Update:
- `server/package.json` — `npm install pdfkit`
- `client/src/components/ExportMenu/*` — real: two links, one per format. Uses `client/src/config/endpoints.js` `.meetings.export(id, format)`. Opens in a new tab to trigger download.

## Implementation Steps

1. **Bundle fonts** — download Be Vietnam Pro (OFL, free) regular + bold. Place under `server/src/modules/export/`. Add license notice.
2. **`overview.interface.detail(...)`** — expose the same composition Phase 6 built. Both `overview.controller` (for HTTP) and `export.service` (for exports) call through this interface.
3. **`export.service.download(meetingId, userId, format)`** — fetches data, dispatches to `renderMarkdown` or `renderPdf`.
4. **`export.markdown.js` — `renderMarkdown(data)`:**
   ```
   # <title>
   Date: <YYYY-MM-DD>
   Duration: <mm:ss>
   Participants: <Speaker 1 (display_name), Speaker 2, ...>

   ## Overview
   <summary.overview>

   ## Bullets
   ### Decisions
   - <content>  — <Speaker>  [<mm:ss>]

   ### Actions
   ... (grouped by category, empty groups omitted)

   ## Action Items
   | Task | Owner | Due | Done |
   |---|---|---|---|
   | ... | ... | ... | [x]/[ ] |
   ```
   Pure function. Unit test with the Phase 5 fixture summary.
5. **`export.pdf.js` — `renderPdf(data, res)`:**
   ```js
   const doc = new PDFDocument({ margins: { top: 60, bottom: 60, left: 60, right: 60 } });
   doc.registerFont('body', path.join(__dirname, 'be-vietnam-pro-regular.ttf'));
   doc.registerFont('bold', path.join(__dirname, 'be-vietnam-pro-bold.ttf'));
   doc.pipe(res);
   doc.font('bold').fontSize(20).text(data.meeting.title);
   doc.font('body').fontSize(10).text(`Date: ${...}  ·  Duration: ${...}`).moveDown();
   doc.font('bold').fontSize(14).text('Overview').moveDown(0.25);
   doc.font('body').fontSize(11).text(data.summary.overview).moveDown();
   // bullets grouped by category — category header + bullet body + speaker + timestamp
   // action items as a simple table (pdfkit tables are manual — just aligned columns is fine)
   doc.end();
   ```
   Font embed **before** any `text()` call. Verify Vietnamese chars render in a real generated PDF.
6. **`export.controller.download`** — handler. `format` validated: `md`, `pdf`, else 400 `validation_failed`. Auth from `req.user`.
7. **`export.routes.js`** — `router.get('/:id/export', exportController.download);` mounted at `/api/meetings`.
8. **Client `ExportMenu`** — two `<a>` tags pointing at the endpoint URLs. `target="_blank" rel="noopener"`. Include `Authorization` header? No — `<a>` can't set headers. Two options:
   - **A.** Add `?token=<supabase_access_token>` query param → server middleware also accepts query-param token for the export endpoint only. Simple but leaks token in browser history.
   - **B.** Fetch the file via `http.js` (which adds the bearer header), turn into a `Blob`, create an object URL, trigger a synthetic download. More code but doesn't leak.
   - **Recommendation: B.** Small `useExportMenu.hook.js` handles the fetch+blob+download dance.
9. **Unit tests:**
   - `renderMarkdown` — given the fixture summary, produces expected string (snapshot). One of two mandatory tests from `LESSONS_FROM_TUTORBOT.md` §2.
   - Test that MD renderer handles: no action items, no summary (yet), Vietnamese content, action item with `dueDate: null`.
10. **Smoke test:** open a completed Vietnamese meeting → click Export MD → check file content. Click Export PDF → open the PDF and verify diacritics (á, ế, ả, ữ, …) render correctly. Neither call hits OpenAI — verify by watching the OpenAI dashboard usage or `logger` line.

## Todo List
- [ ] `npm install pdfkit`; bundle Be Vietnam Pro fonts under `export/`
- [ ] `overview.interface.detail` exposure
- [ ] `export.service` + `.markdown` + `.pdf` + `.controller` + `.routes`
- [ ] Client `ExportMenu` with blob-download hook
- [ ] Unit test for `renderMarkdown` (per `LESSONS_FROM_TUTORBOT.md` §2)
- [ ] Verify PDF Vietnamese diacritics
- [ ] Verify NO OpenAI call on re-download
- [ ] Commit as `feat(export): md + pdf renderers, vietnamese font embedded`

## Success Criteria
- MD export downloads with correct filename, correct content, correct extension
- PDF export downloads, opens, and renders Vietnamese diacritics correctly
- Re-download an old meeting's PDF → confirmed no OpenAI call in the server logs
- Unit test for MD renderer passes on the fixture

## Risk Assessment
- **Risk:** pdfkit's TTF font embed subtly breaks on some diacritic combos. **Mitigation:** eyeball the PDF with a real Vietnamese meeting. Fallback font: Noto Sans Vietnamese (also OFL). Don't ship until visually verified.
- **Risk:** blob-download flow feels janky on mobile browsers. **Mitigation:** iOS Safari handles `Blob` + `<a download>` fine as of 2024+. If a specific browser breaks, fall back to option A (query-param token) with a short-lived token.
- **Risk:** meeting with no summary (still processing) is exported — renderers crash. **Mitigation:** service returns 409 `invalid_state` if `meeting.status !== 'completed'`; client `ExportMenu` only shown on completed.

## Security Considerations
- Blob-download avoids leaking the access token in URL/history (§ Impl 8B)
- Export endpoint enforces per-user ownership (via `overview.interface.detail` which uses per-repo `userId` scoping)
- No `res.status().json()` for errors — throw `AppError`; `errorHandler.js` formats. Exception: for the export endpoint, the failure response IS an envelope (JSON) even though success is a binary. That's fine — `Content-Type` on error is `application/json`.

## Next Steps
- Phase 8 deploys and ships submission artifacts
