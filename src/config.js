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

/**
 * Base layers for the map and imagery viewer.
 * To add a layer (e.g. Aerial, deferred), append an entry. `type` is
 * 'xyz' or 'wms'. A layer with `blendWith` shows the blend slider, which
 * fades that layer over this one.
 */
export const LAYERS = [
  {
    id: 'street',
    label: 'Street',
    type: 'xyz',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: { maxZoom: 19, maxNativeZoom: 19 },
    attribution: OSM_ATTRIBUTION,
    tip: 'Look for footpaths, field boundaries and access before you go.',
    source: 'OpenStreetMap standard tiles (ODbL)',
  },
];

export const BLEND_LAYER_ID = 'street';

// Geocoding: https://operations.osmfoundation.org/policies/nominatim/
export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
