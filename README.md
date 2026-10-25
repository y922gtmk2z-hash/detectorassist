# Detectorist Map

A free, non-monetised map for metal detectorists in **England**. It runs as a
static site on GitHub Pages: no backend, no accounts, no analytics, no
cookies. Saved spots stay in your browser's localStorage on your device.

**Screens:** Map · Search · Imagery (Street / LiDAR / Historic with a blend
slider) · Saved spots · My finds · Heritage overlay (Scheduled Monument
warnings).

**My finds** is a personal finds log: drop a pin, tap "Log find", and record
what it is, date, depth, category, period, a photo, notes and whether it's
recorded with the PAS. Finds show as amber dots on the map. Records are kept
in localStorage and photos (shrunk to 1600 px JPEG) in IndexedDB, on the
device only. Export to CSV or GPX from the Finds tab; photos are not
exported.

**In the field:**
- **Live location:** the locate button toggles a live GPS dot with an
  accuracy circle; the map follows you until you pan.
- **Search tracks:** the record button logs where you walk, drawn as a swath
  about one sweep (1.5 m) wide so missed ground shows. Fixes worse than 25 m
  are ignored. A web page cannot use GPS with the screen off, so recording
  keeps the screen awake (Screen Wake Lock) where the browser supports it.
  Tracks are listed on the Spots tab with GPX export; an interrupted
  recording is saved on next load.
- **Permission boundaries:** draw the outline of land you have permission
  for on any saved spot (area in hectares and acres, measured on the OS
  grid). Boundaries show on the map, the spot card says which one a pin is
  in, and with live location on you get a warning and vibration when you
  walk out of one.
- **Share links:** the address bar always holds the current pin or view
  (`#pin=lat,lng&z=17&n=name`), so it can be bookmarked; the share button
  on the spot card uses the phone's share sheet or copies the link.

## Develop

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # grid ref converter tests
npm run build    # static site in dist/
```

Stack: Vite, Leaflet, proj4, vanilla JS. Fonts (Instrument Sans,
JetBrains Mono) are self-hosted from `@fontsource`, so the page makes no
font CDN requests.

## Deploy

`.github/workflows/deploy.yml` tests, builds and deploys on every push to
`main`. One-time setup: **Settings → Pages → Build and deployment → Source:
GitHub Actions**.

### Optional: enable the Historic layer

The NLS historic maps are served to third-party sites through MapTiler, which
needs an API key (see the Historic map row in the table below). Without a key the Historic button
shows as unavailable and everything else works.

1. Create a free MapTiler account and key. Restrict it to your Pages origin.
2. Add it as a repository **variable** (not a secret, because it ships in
   the public JavaScript): Settings → Secrets and variables → Actions →
   Variables → `MAPTILER_KEY`.
3. Re-run the deploy workflow. For local dev, put
   `VITE_MAPTILER_KEY=...` in `.env.local` (git-ignored).

## Data sources, licences and attribution

Attribution for each visible layer appears in the map's attribution control
and changes with the active layer. All endpoints are in `src/config.js`.

| Layer / service | Endpoint | Licence / terms | Attribution shown |
|---|---|---|---|
| **Street**: OpenStreetMap standard tiles | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | Data ODbL; [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/) | © OpenStreetMap contributors (links to /copyright) |
| **LiDAR (Ground)**: Environment Agency LIDAR Composite DTM 1m (2022), hillshade | WMS `https://environment.data.gov.uk/geoservices/datasets/13787b9a-26a4-4775-8523-806d13af58fc/wms`, layer `Lidar_Composite_Hillshade_DTM_1m` | [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/) | © Environment Agency copyright and/or database right 2022. All rights reserved. + OGL link |
| **LiDAR (Surface)**: Environment Agency LIDAR Composite DSM 1m (2022), hillshade | WMS `https://environment.data.gov.uk/geoservices/datasets/9ba4d5ac-d596-445a-9056-dae3ddec0178/wms`, layer `Lidar_Composite_Hillshade_LZ_DSM_1m` | Open Government Licence v3.0 | as LiDAR (Ground) |
| **Historic**: National Library of Scotland, OS GB 1:1M to 1:10,560, 1900s (`uk-osgb1888`) | TileJSON `https://api.maptiler.com/tiles/uk-osgb1888/tiles.json?key=…` | NLS Historic Maps API: CC BY, attribution to NLS with a link; free MapTiler tier is for non-commercial use (≤100k tiles/month) | Historic OS map: National Library of Scotland (CC BY) via © MapTiler |
| **Search**: Nominatim | `https://nominatim.openstreetmap.org/search` | [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/); data ODbL | "Address search by Nominatim, data © OpenStreetMap contributors" on the Search screen |
| **Heritage**: Historic England NHLE | `https://services-eu1.arcgis.com/ZOdPfBS3aqqDYPUQ/arcgis/rest/services/National_Heritage_List_for_England_NHLE_v02_VIEW/FeatureServer` | Open Government Licence v3.0 | Heritage: © Historic England {year}. Contains Ordnance Survey data © Crown copyright and database right {year}. + OGL link |
| **Grid refs**: OS National Grid (EPSG:27700) | none (local proj4, 7-parameter Helmert, about 5 m accuracy) | n/a | n/a |

### How the app follows the usage policies

- **OSM tiles:** tiles load only when shown on the map. There is no
  prefetching, bulk download or offline caching. The page sends its origin as
  the Referer (`<meta name="referrer">`). The blend overlay is removed at
  0% so it requests no tiles. Saved-spot thumbnails are one visible tile
  each. If traffic grows, move Street to a tile host
  (`LAYERS` in `src/config.js`).
- **Nominatim:** queries go out only when you press Enter or tap "Search
  for …", never per keystroke (the policy forbids autocomplete). Requests are
  spaced at least 1.1 s apart and results are cached for the session. The
  browser's Referer identifies the app; a web page cannot set User-Agent.
  Grid refs and coordinates are parsed locally and update as you type.
- **NHLE:** one query per layer for the visible bounds, only at zoom 13 or
  closer (listed building points at 16 or closer). Moves are debounced and
  stale requests cancelled. Polygons are simplified to about one screen pixel.

### Verification status

Direct HTTP access to these services was blocked from the build environment,
so the following were checked against published documentation and catalogues
rather than live responses. **Check them in a browser before launch:**

- [ ] **LiDAR:** the brief's `…/spatialdata/lidar-composite-digital-terrain-model-dtm-1m-2022/wms`
      endpoint does not list a hillshade layer in any source found. The app
      uses the EA geoservices endpoint and layer name taken from the
      OpenStreetMap editor-layer-index (as shipped in iD 2.42). Confirm with
      `GetCapabilities` on the URL above. The Surface (DSM) endpoint and
      layer come from the same index and need the same check.
- [ ] **NHLE:** Scheduled Monuments is reported as layer 6. The app reads
      the service's layer list and matches names (`/scheduled monument/i`,
      battlefields, parks and gardens, World Heritage Sites, protected wrecks,
      listed building points), falling back to layer 6. Confirm field names
      (`Name`, `ListEntry`, `hyperlink`) and that `f=geojson` is supported.
- [ ] **NHLE attribution:** the wording above follows Historic England's
      usual NHLE wording. The Open Data Hub terms page could not be
      read; confirm the exact text there.
- [ ] **NLS:** the free S3/`geo.nls.uk` tile URLs are NLS's own website
      infrastructure; the NLS API page directs third-party sites to MapTiler.
      Confirm the `uk-osgb1888` tileset and the current non-commercial terms.
- [ ] **Code of Practice:** the disclaimer names the Code but links only to
      the PAS home page (finds.org.uk); add a direct link once confirmed.

## Deferred (not built)

- **Aerial imagery:** no provider chosen. To add it, append an entry to
  `LAYERS` in `src/config.js` and set `BLEND_LAYER_ID = 'aerial'` so the
  slider reads "Blend with aerial".
- **PAS finds:** terms and API availability unverified; find-spots are
  likely generalised. Not to be built until the terms are read.

## Disclaimer

This app is a map, not legal advice. Always get the landowner's permission,
follow the Code of Practice for Responsible Metal Detecting in England and
Wales, and record finds with the [Portable Antiquities Scheme](https://finds.org.uk/).
