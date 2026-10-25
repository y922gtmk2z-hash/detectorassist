// The single Leaflet map shared by the Map and Imagery screens.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BLEND_LAYER_ID, ENGLAND_BOUNDS, ENGLAND_CENTRE, LAYERS, MAP_LAYER_ID } from './config.js';

let map;
let pin = null;
let selected = null;
let base = null;
let baseId = null;
let blend = null;
let blendPercent = 0;
let layerRequest = 0;
const tileJson = new Map();
const selectListeners = new Set();
const layerListeners = new Set();

const pinIcon = L.divIcon({
  className: 'pin',
  html:
    '<svg viewBox="0 0 32 44" width="32" height="44" aria-hidden="true">' +
    '<path d="M16 42S3 26.5 3 16a13 13 0 0 1 26 0c0 10.5-13 26-13 26Z" fill="#F2B632" stroke="#12211A" stroke-width="2.5"/>' +
    '<circle cx="16" cy="16" r="5" fill="#12211A"/></svg>',
  iconSize: [32, 44],
  iconAnchor: [16, 42],
});

export function getMap() {
  return map;
}

export function layerDef(id) {
  return LAYERS.find((l) => l.id === id);
}

// Turn a 'tilejson' definition into an 'xyz' one by reading its TileJSON.
async function resolve(def) {
  if (def.type !== 'tilejson') return def;
  if (!tileJson.has(def.id)) {
    tileJson.set(
      def.id,
      fetch(def.url).then((r) => {
        if (!r.ok) throw new Error(`${def.label} tiles unavailable (${r.status})`);
        return r.json();
      }),
    );
  }
  let tj;
  try {
    tj = await tileJson.get(def.id);
  } catch (err) {
    tileJson.delete(def.id);
    throw err;
  }
  const b = tj.bounds;
  return {
    ...def,
    type: 'xyz',
    url: tj.tiles[0],
    options: {
      ...def.options,
      maxNativeZoom: tj.maxzoom,
      ...(b ? { bounds: [[b[1], b[0]], [b[3], b[2]]] } : {}),
    },
  };
}

function makeLayer(def, pane) {
  const opts = { attribution: def.attribution, pane, ...def.options };
  if (def.type === 'wms') return L.tileLayer.wms(def.url, { ...def.wms, ...opts });
  return L.tileLayer(def.url, opts);
}

export function initMap() {
  map = L.map('map', {
    zoomControl: false,
    attributionControl: false,
    minZoom: 6,
    maxZoom: 19,
    maxBounds: L.latLngBounds(ENGLAND_BOUNDS).pad(0.15),
    maxBoundsViscosity: 0.8,
  }).setView(ENGLAND_CENTRE, 7);

  L.control
    .attribution({ position: 'bottomright', prefix: '<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>' })
    .addTo(map);

  // Street layer blended over LiDAR/Historic sits above the base tile pane.
  map.createPane('blend').style.zIndex = 250;

  map.on('click', (e) => selectPoint(e.latlng.lat, e.latlng.lng));
  setBaseLayer(MAP_LAYER_ID);
  return map;
}

/** Switch the base layer. Rejects if the layer cannot be loaded. */
export async function setBaseLayer(id) {
  const def = layerDef(id);
  if (!def || def.disabled || id === baseId) return;
  const request = ++layerRequest;
  const resolved = await resolve(def);
  if (request !== layerRequest) return; // a later switch won
  if (base) map.removeLayer(base);
  base = makeLayer(resolved, 'tilePane').addTo(map);
  baseId = id;
  updateBlend();
  for (const fn of layerListeners) fn(id);
}

export function getBaseLayerId() {
  return baseId;
}

export function onBaseLayerChange(fn) {
  layerListeners.add(fn);
}

/** Fade the blend layer (Street) over the current base, 0-100. */
export function setBlend(percent) {
  blendPercent = percent;
  updateBlend();
}

function updateBlend() {
  const show = baseId !== BLEND_LAYER_ID && blendPercent > 0;
  if (!show) {
    // Remove rather than hide at 0% so no tiles are requested for nothing.
    if (blend) map.removeLayer(blend);
    blend = null;
    return;
  }
  if (!blend) blend = makeLayer(layerDef(BLEND_LAYER_ID), 'blend').addTo(map);
  blend.setOpacity(blendPercent / 100);
}

export function getSelected() {
  return selected;
}

export function onSelect(fn) {
  selectListeners.add(fn);
}

/** Drop or move the pin. `name` is optional (e.g. from a search result). */
export function selectPoint(lat, lng, name = null) {
  selected = { lat, lng, name };
  if (!pin) {
    pin = L.marker([lat, lng], { icon: pinIcon, draggable: true, keyboard: true, title: 'Selected spot' }).addTo(map);
    pin.on('dragend', () => {
      const p = pin.getLatLng();
      selectPoint(p.lat, p.lng);
    });
  } else {
    pin.setLatLng([lat, lng]);
  }
  for (const fn of selectListeners) fn(selected);
}

export function clearSelection() {
  if (pin) map.removeLayer(pin);
  pin = null;
  selected = null;
  for (const fn of selectListeners) fn(null);
}

export function goTo(lat, lng, zoom = 16) {
  map.setView([lat, lng], Math.max(zoom, map.getZoom()));
}

/**
 * The map container changes size when panels show/hide. Runs synchronously
 * so a following setView uses the new size; skipped while the map is hidden
 * (it would measure 0x0). pan:false keeps the top-left fixed so a pin stays
 * under the finger when the spot card opens.
 */
export function refreshSize() {
  if (map?.getContainer().offsetWidth) map.invalidateSize({ pan: false });
}
