# FV+ Reporte Completo page details implementation plan

## 1. Connect extracted PDF sections to the result page

- In `js/modules/filter.js`, add a renderer for the `parseSections()` output from `js/modules/metapla-report.js`.
- Render the parser's executive summary and each section's key/value fields, table rows, subsection labels, and free-text rows. Preserve unmapped values and use the existing HTML escaping helper.
- Pass `meta.onSecciones` to the existing PDF generation call so page details and PDF use one extraction pass.
- Check: use representative section fixtures to verify all row types, source order, safe escaping, and no duplicate summary fields.

## 2. Preserve graceful PDF fallbacks and interactions

- Keep the current PDF card, generated PDF output, original-PDF fallback, and scanned annexes.
- Keep bot-provided fields visible if extraction fails and add a clear incomplete-extraction status without inventing data.
- Ensure the page result and PDF controls remain valid if the user starts a new consultation while generation is in progress.
- Check: simulate successful extraction, missing/invalid PDF, generator failure, and leaving the result during generation.

## 3. Style and publish the result

- Add focused responsive styles in the existing report stylesheets; keep all sections readable in normal page scroll on desktop and mobile.
- Bump `filter.js` and service-worker cache versions as needed.
- Check: run report-related tests and the repository suite; review a representative result at desktop and mobile widths; verify PDF view/download controls.
- Publish the static frontend to its existing Cloudflare Pages deployment after maintenance server enforcement has shipped.
