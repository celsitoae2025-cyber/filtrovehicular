# FV+ Reporte Completo page details

## Goal

Show the full readable text and tables from Reporte Completo on the consultation result page, alongside the existing generated PDF. Keep scanned annex images in the PDF.

## Current behavior

- `js/modules/filter.js` renders a compact summary and detail list from the bot's `parsed.secciones`.
- `js/modules/metapla-report.js` extracts the source PDF into structured sections and builds the current PDF from those sections.
- The parser already calls `meta.onSecciones(secciones)`, but the page does not pass that callback. Information available only in the source PDF therefore stays out of the browser result.

## Design

Reuse the one PDF extraction pass. Pass an `onSecciones` callback from the Reporte Completo renderer and render the extracted sections in the existing result panel. Do not reopen or parse the PDF a second time.

The page will show:

1. The existing executive summary and vehicle identity.
2. Every recognized report section, in source order, with its headings, field/value rows, free text, and tables rendered as semantic HTML.
3. The existing generated PDF card and download/view actions, with scanned annex images remaining in the PDF.

Keep all extracted data visible, including fields the normalized model does not recognize. Use the parser's summary score and indicators where present, without recalculating or changing the existing verdict. Escape all provider text before inserting HTML. Make the long result readable on desktop and mobile; sections stay available in the page's normal scroll flow.

If PDF extraction succeeds, its sections supply the complete page detail. If extraction or PDF generation fails, preserve the original PDF and show any bot-provided fields already available, with a clear notice that complete extracted details could not be prepared. Never invent missing values or represent unavailable data as zero.

## Scope boundaries

- Keep the existing PDF generation and its scanned annexes.
- Do not alter provider data, report pricing, credit rules, the Telegram bridge, or unrelated query renderers.
- Do not change the report risk calculation as part of this work.

## Verification

- Test rendering for executive summary data and every parsed row type: key/value, table row, subsection, and free text.
- Verify unmapped fields remain visible and are escaped safely.
- Verify the browser fallback keeps the original PDF and bot-provided fields when extraction fails.
- Review the result at desktop and mobile widths; keep PDF download/view controls working.
