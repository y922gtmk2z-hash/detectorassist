# CLAUDE.md

Detectorist Map: a free, non-monetised, England-only static web app for metal
detectorists. Vite + Leaflet + proj4, vanilla JS (ES modules). Deployed to
GitHub Pages by `.github/workflows/deploy.yml`. No backend, accounts,
analytics, cookies or API keys.

## Commands
- `npm run dev`: local dev server
- `npm test`: unit tests (vitest)
- `npm run build`: production build to `dist/`

## Layout
- `src/config.js`: every external endpoint, layer definition and attribution string. Change sources here only.
- `src/router.js`: screen switching (Map / Imagery / Spots, plus the Search overlay).
- `src/map.js`: the single shared Leaflet map, pin, base layers and blend.
- `src/gridref.js`: OS grid ref <-> WGS84 (local, no network).
- `src/geocode.js`: Nominatim client (rate limited; submit-only, no autocomplete).
- `src/heritage.js`: Historic England NHLE overlay.
- `src/location.js`: live GPS (shared watch; `hold`/`release`).
- `src/tracks.js`: search track recording, swath display, GPX export.
- `src/boundaries.js`: permission boundaries on saved spots, leave warning.
- `src/share.js` + `src/link.js`: URL hash state and share button.
- `src/geo.js`: distance, area (on the OS grid), point-in-polygon.
- `src/spots.js`: saved spots (localStorage).
- `src/finds.js`: personal finds log (localStorage) with photos in IndexedDB (`src/photos.js`) and CSV/GPX export (`src/export.js`).
- `design/`: design reference export.

## Rules
- Visible attribution on every map view, updated with the active layer.
- Respect the OSM tile and Nominatim usage policies: no prefetching or bulk
  download, at most 1 Nominatim request per second, never per keystroke.
- No API keys or secrets committed. The Historic layer only turns on when a
  key is supplied at build time (see README).
- No legal advice in the UI. Keep to the screens in the brief plus the finds log.
- Deferred, do not build: Aerial imagery, PAS finds.
- Adding a layer = one entry in `LAYERS` in `src/config.js`.
