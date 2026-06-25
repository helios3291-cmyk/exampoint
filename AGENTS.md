# AGENTS.md

## Cursor Cloud specific instructions

This repo is a single, dependency-free static web app (no build system, no package manager, no backend):

- `index.html` — markup/entry point
- `script.js` — all app logic (vanilla JS): score calculation, validation, Excel export
- `style.css` — styling

It is "고등학교 시험 배점 추천기" (high school exam score-allocation recommender): a Korean client-side tool that takes question counts per difficulty tier and example point values, generates 3 scoring proposals, lets you hand-edit per-question points with live validation, and exports to Excel.

### Running it (dev mode)

Serve the files over HTTP from the repo root and open in a browser:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000/
```

Opening via `file://` also works for everything except the Excel export.

### Build / lint / test

There is no build step, no linter config, and no automated test suite in this repo. Nothing to install or compile — edits to the three files take effect on browser refresh.

### Non-obvious caveats

- The "엑셀로보내기" (Export to Excel) button depends on SheetJS loaded from `https://cdn.sheetjs.com` (see `index.html`). It needs internet access; the rest of the app works fully offline. If the CDN fails to load, export shows an alert instead of downloading.
