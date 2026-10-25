// Every external endpoint, layer and attribution string lives here.
// See README.md "Data sources" for licences and verification notes.

// England plus a margin. The map cannot be panned far outside this.
export const ENGLAND_BOUNDS = [
  [49.8, -6.6],
  [55.9, 2.1],
];
export const ENGLAND_CENTRE = [52.6, -1.5];

const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

// Historic map tiles need a MapTiler key (NLS's route for third-party sites).
// Supplied at build time only; without it the Historic layer is disabled.
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY || '';

/**
 * Base layers for the map and imagery viewer.
 * To add a layer (e.g. Aerial, deferred), append an entry. `type` is
 * 'xyz', 'wms' or 'tilejson' (URL template read from a TileJSON document).
 * On any layer other than BLEND_LAYER_ID the imagery viewer shows a slider
 * that fades BLEND_LAYER_ID over it. When Aerial is added, point
 * BLEND_LAYER_ID at it so the slider becomes "Blend with aerial".
 * A layer with `variantOf` is not a switcher button of its own; it shows as
 * an alternative (e.g. Ground / Surface) under its parent layer.
 */
export const LAYERS = [
  {
    id: 'street',
    label: 'Street',
    type: 'xyz',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: { maxZoom: 19, maxNativeZoom: 19 },
    attribution: OSM_ATTRIBUTION,
    tip: 'footpaths, field boundaries and access before you go.',
    source: 'OpenStreetMap standard tiles (ODbL)',
  },
  {
    id: 'lidar',
    label: 'LiDAR',
    variantLabel: 'Ground',
    type: 'wms',
    // EA LIDAR Composite DTM 1m (2022), hillshade rendering.
    url: 'https://environment.data.gov.uk/geoservices/datasets/13787b9a-26a4-4775-8523-806d13af58fc/wms',
    wms: { layers: 'Lidar_Composite_Hillshade_DTM_1m', format: 'image/jpeg', version: '1.3.0', styles: '' },
    options: { minZoom: 10, maxZoom: 19, tileSize: 256 },
    attribution:
      '© Environment Agency copyright and/or database right 2022. All rights reserved. ' +
      '<a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" target="_blank" rel="noopener">OGL v3.0</a>',
    tip: 'banks, ditches, mounds, ridge and furrow, and old field boundaries.',
    source: 'Environment Agency LIDAR Composite DTM 1m (2022), bare-ground hillshade',
  },
  {
    id: 'lidar-dsm',
    label: 'LiDAR surface',
    variantOf: 'lidar',
    variantLabel: 'Surface',
    type: 'wms',
    // EA LIDAR Composite DSM 1m (2022), hillshade: includes trees, hedges, buildings.
    url: 'https://environment.data.gov.uk/geoservices/datasets/9ba4d5ac-d596-445a-9056-dae3ddec0178/wms',
    wms: { layers: 'Lidar_Composite_Hillshade_LZ_DSM_1m', format: 'image/jpeg', version: '1.3.0', styles: '' },
    options: { minZoom: 10, maxZoom: 19, tileSize: 256 },
    attribution:
      '© Environment Agency copyright and/or database right 2022. All rights reserved. ' +
      '<a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" target="_blank" rel="noopener">OGL v3.0</a>',
    tip: 'hedges, trees and buildings. Compare with Ground: earthworks that only show on Ground are hidden under vegetation.',
    source: 'Environment Agency LIDAR Composite DSM 1m (2022), surface hillshade',
  },
  {
    id: 'historic',
    label: 'Historic',
    type: 'tilejson',
    // NLS: Great Britain, Ordnance Survey 1:1 million to 1:10,560, 1900s.
    url: `https://api.maptiler.com/tiles/uk-osgb1888/tiles.json?key=${MAPTILER_KEY}`,
    options: { maxZoom: 19 },
    attribution:
      'Historic OS map: <a href="https://maps.nls.uk/" target="_blank" rel="noopener">National Library of Scotland</a> (CC BY) ' +
      'via <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">© MapTiler</a>',
    tip: 'lost buildings, old tracks, wells, ponds and vanished field boundaries.',
    source: 'National Library of Scotland, OS maps c. 1888–1913',
    disabled: !MAPTILER_KEY,
    // Without a key, the Historic button opens the free NLS viewer instead.
    disabledReason: 'Opens the National Library of Scotland historic map viewer in a new tab.',
  },
];

// The Map screen always shows this layer.
export const MAP_LAYER_ID = 'street';
// The layer the imagery blend slider fades over the active layer.
// Must be an 'xyz' or 'wms' layer (the blend overlay does not read TileJSON).
export const BLEND_LAYER_ID = 'street';
// The layer the imagery viewer opens on.
export const DEFAULT_IMAGERY_LAYER_ID = 'lidar';

// Geocoding: https://operations.osmfoundation.org/policies/nominatim/
export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

// Historic England National Heritage List for England (NHLE), OGL v3.0.
// Layers are matched by name from the service's layer list at runtime.
export const NHLE_URL =
  'https://services-eu1.arcgis.com/ZOdPfBS3aqqDYPUQ/arcgis/rest/services/National_Heritage_List_for_England_NHLE_v02_VIEW/FeatureServer';
export const NHLE_SCHEDULED_FALLBACK_ID = 6;
export const NHLE_MIN_ZOOM = 13;
export const NHLE_POINTS_MIN_ZOOM = 16;

const year = new Date().getFullYear();
export const NHLE_ATTRIBUTION =
  `Heritage: © <a href="https://historicengland.org.uk/listing/the-list/" target="_blank" rel="noopener">Historic England</a> ${year}. ` +
  `Contains Ordnance Survey data © Crown copyright and database right ${year}. ` +
  '<a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" target="_blank" rel="noopener">OGL v3.0</a>';

// National Library of Scotland side-by-side viewer (historic OS maps beside
// a modern map). Linked to, not embedded, so no key or tile licence needed.
export const NLS_VIEWER_URL = 'https://maps.nls.uk/geo/explore/side-by-side/';
