// Saved spots, stored in this browser's localStorage only.
import L from 'leaflet';
import { LAYERS, MAP_LAYER_ID } from './config.js';
import { pointInPolygon } from './geo.js';
import { latLngToGridRef } from './gridref.js';
import { getBaseLayerId, getSelected, goTo, layerDef, selectPoint } from './map.js';
import { onScreenChange, showScreen } from './router.js';
import { $, esc, toast } from './ui.js';

const KEY = 'detectorassist.spots.v1';
const TAGS = {
  granted: 'Permission granted',
  ask: 'Ask landowner',
};

let filter = 'all';

export function loadSpots() {
  try {
    const spots = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(spots) ? spots : [];
  } catch {
    return [];
  }
}

/** Saved spots whose permission boundary contains this point. */
export function spotsContaining(lat, lng) {
  return loadSpots().filter((s) => s.boundary?.length >= 3 && pointInPolygon({ lat, lng }, s.boundary));
}

export function updateSpot(id, patch) {
  return storeSpots(loadSpots().map((s) => (s.id === id ? { ...s, ...patch } : s)));
}

function storeSpots(spots) {
  try {
    localStorage.setItem(KEY, JSON.stringify(spots));
    document.dispatchEvent(new CustomEvent('spots-changed'));
    return true;
  } catch {
    toast('Could not save: storage on this device is full or blocked.');
    return false;
  }
}

function newId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// --- Save dialog ---------------------------------------------------------

const dialog = $('#save-dialog');
const form = $('#save-form');

function openSaveDialog() {
  const s = getSelected();
  if (!s) return toast('Tap the map to drop a pin first.');
  form.reset();
  form.elements.name.value = s.name && s.name !== 'My location' ? s.name : '';
  $('#save-grid').textContent = latLngToGridRef(s.lat, s.lng) ?? '';
  dialog.showModal();
  form.elements.name.focus();
}

form.addEventListener('submit', (e) => {
  if (e.submitter?.value === 'cancel') return;
  const s = getSelected();
  if (!s) return;
  const layer = document.body.dataset.screen === 'imagery' ? getBaseLayerId() : MAP_LAYER_ID;
  const spot = {
    id: newId(),
    name: form.elements.name.value.trim() || 'Unnamed spot',
    lat: s.lat,
    lng: s.lng,
    gridRef: latLngToGridRef(s.lat, s.lng),
    layer,
    permission: form.elements.permission.value,
    savedAt: new Date().toISOString(),
  };
  if (storeSpots([spot, ...loadSpots()])) toast('Spot saved on this device.');
});

// --- List screen ---------------------------------------------------------

const list = $('#spots-list');

function thumbHtml(spot) {
  // One standard OSM tile at the spot, with a dot over the exact point.
  const z = 16;
  const p = L.CRS.EPSG3857.latLngToPoint(L.latLng(spot.lat, spot.lng), z);
  const x = Math.floor(p.x / 256);
  const y = Math.floor(p.y / 256);
  const street = LAYERS.find((l) => l.id === MAP_LAYER_ID);
  const src = street.url.replace('{z}', z).replace('{x}', x).replace('{y}', y);
  const left = 36 - (p.x - x * 256);
  const top = 36 - (p.y - y * 256);
  return `<div class="thumb" aria-hidden="true">
      <img src="${esc(src)}" alt="" loading="lazy" width="256" height="256" style="left:${left}px;top:${top}px" />
      <span class="thumb-dot"></span></div>`;
}

function renderList() {
  const spots = loadSpots().filter((s) => filter === 'all' || s.permission === filter);
  for (const b of document.querySelectorAll('.filter')) b.setAttribute('aria-pressed', String(b.dataset.filter === filter));
  if (!spots.length) {
    list.innerHTML = `<li class="spots-empty">${
      filter === 'all' ? 'No saved spots yet. Drop a pin on the map and tap “Save spot”.' : 'No spots with this tag.'
    }</li>`;
    return;
  }
  list.innerHTML = spots
    .map(
      (s) => `<li class="spot" data-id="${esc(s.id)}">
        <button type="button" class="spot-main" data-act="open">
          ${thumbHtml(s)}
          <span class="spot-text">
            <span class="spot-name">${esc(s.name)}</span>
            <span class="spot-grid mono">${esc(s.gridRef ?? '')}</span>
            <span class="spot-layer">Layer: ${esc(layerDef(s.layer)?.label ?? s.layer)}</span>
          </span>
        </button>
        <div class="spot-actions">
          <button type="button" class="tag tag-${esc(s.permission)}" data-act="toggle" title="Change permission tag">${esc(TAGS[s.permission] ?? s.permission)}</button>
          <button type="button" class="icon-btn flat" data-act="delete" aria-label="Delete ${esc(s.name)}">
            <svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
          </button>
        </div>
      </li>`,
    )
    .join('');
}

list.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  const id = e.target.closest('.spot')?.dataset.id;
  if (!act || !id) return;
  const spots = loadSpots();
  const spot = spots.find((s) => s.id === id);
  if (!spot) return;
  if (act === 'open') {
    selectPoint(spot.lat, spot.lng, spot.name);
    showScreen('map');
    goTo(spot.lat, spot.lng, 16);
  } else if (act === 'toggle') {
    spot.permission = spot.permission === 'granted' ? 'ask' : 'granted';
    storeSpots(spots);
    renderList();
  } else if (act === 'delete' && confirm(`Delete “${spot.name}” from this device?`)) {
    storeSpots(spots.filter((s) => s.id !== id));
    renderList();
  }
});

export function initSpots() {
  // Offline or blocked tiles: show the plain thumbnail box instead of a broken image.
  list.addEventListener('error', (e) => e.target.tagName === 'IMG' && (e.target.hidden = true), true);
  document.addEventListener('save-spot', openSaveDialog);
  for (const b of document.querySelectorAll('[data-act="save-spot"]')) b.addEventListener('click', openSaveDialog);
  for (const b of document.querySelectorAll('.filter')) {
    b.addEventListener('click', () => {
      filter = b.dataset.filter;
      renderList();
    });
  }
  onScreenChange((screen) => screen === 'spots' && renderList());
}
