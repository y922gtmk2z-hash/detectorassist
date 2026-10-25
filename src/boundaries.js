// Permission boundaries drawn on saved spots. Shown on the map, named on
// the spot card, and with live GPS on, you are warned on leaving one.
import L from 'leaflet';
import { areaHa, formatArea, pointInPolygon } from './geo.js';
import { onPosition } from './location.js';
import { getMap, goTo, setClickOverride } from './map.js';
import { onScreenChange, showScreen } from './router.js';
import { addCardSection } from './spotcard.js';
import { loadSpots, spotsContaining, updateSpot } from './spots.js';
import { $, esc, toast } from './ui.js';

const COLOURS = { granted: '#1E4D3B', ask: '#B7791F' };
const LABELS = { granted: 'Permission granted', ask: 'Ask landowner' };

let shapes;
let draft = null; // { spot, points: [[lat, lng]], layer, handles }

// --- Display ----------------------------------------------------------------

function renderShapes() {
  shapes.clearLayers();
  for (const s of loadSpots()) {
    if (!(s.boundary?.length >= 3) || draft?.spot.id === s.id) continue;
    const colour = COLOURS[s.permission] ?? COLOURS.ask;
    L.polygon(s.boundary, { color: colour, weight: 3, fillColor: colour, fillOpacity: 0.08, interactive: false })
      .bindTooltip(esc(s.name), { permanent: false })
      .addTo(shapes);
  }
}

function cardSection(sel) {
  const inside = spotsContaining(sel.lat, sel.lng);
  if (!inside.length) return null;
  const el = document.createElement('div');
  el.className = `card-perm card-perm-${inside[0].permission}`;
  el.innerHTML = inside
    .map((s) => `Inside <strong>${esc(s.name)}</strong> · ${esc(LABELS[s.permission] ?? '')}`)
    .join('<br>');
  return el;
}

// --- Drawing ----------------------------------------------------------------

const bar = $('#draw-bar');

function redrawDraft() {
  draft.layer.setLatLngs(draft.points);
  draft.handles.clearLayers();
  for (const p of draft.points) {
    L.circleMarker(p, { radius: 6, color: '#12211A', weight: 2, fillColor: '#F2B632', fillOpacity: 1, interactive: false }).addTo(draft.handles);
  }
  const n = draft.points.length;
  $('#draw-info').textContent =
    n < 3 ? `Tap the map at each corner of “${draft.spot.name}”. ${n ? `${n} of 3+` : ''}` : `${n} corners · ${formatArea(areaHa(draft.points))}`;
  $('#draw-save').disabled = n < 3;
  $('#draw-undo').disabled = !n;
}

export function startDrawing(spot) {
  if (draft) stopDrawing();
  showScreen('map');
  goTo(spot.lat, spot.lng, 17);
  const map = getMap();
  draft = {
    spot,
    points: spot.boundary ? spot.boundary.map((p) => [...p]) : [],
    layer: L.polygon([], { color: '#F2B632', weight: 3, dashArray: '8 6', fillOpacity: 0.12, interactive: false }).addTo(map),
    handles: L.layerGroup().addTo(map),
  };
  renderShapes();
  document.body.dataset.drawing = 'true';
  bar.hidden = false;
  $('#draw-clear').hidden = !spot.boundary;
  setClickOverride((ll) => {
    draft.points.push([+ll.lat.toFixed(6), +ll.lng.toFixed(6)]);
    redrawDraft();
  });
  redrawDraft();
}

function stopDrawing() {
  setClickOverride(null);
  draft.layer.remove();
  draft.handles.remove();
  draft = null;
  delete document.body.dataset.drawing;
  bar.hidden = true;
  renderShapes();
}

// --- Leaving warning ----------------------------------------------------------

const insideIds = new Set();
const outsideStreak = new Map();

function onFix(pos) {
  if (pos.accuracy > 30) return;
  const spots = loadSpots().filter((s) => s.boundary?.length >= 3);
  const now = new Set(spots.filter((s) => pointInPolygon(pos, s.boundary)).map((s) => s.id));
  for (const id of insideIds) {
    if (now.has(id)) {
      outsideStreak.delete(id);
      continue;
    }
    // Two fixes in a row outside, so GPS wobble on the edge doesn't nag.
    const streak = (outsideStreak.get(id) ?? 0) + 1;
    outsideStreak.set(id, streak);
    if (streak >= 2) {
      const s = spots.find((x) => x.id === id);
      toast(`You have left the permission area for “${s?.name ?? 'a saved spot'}”.`);
      navigator.vibrate?.([250, 120, 250]);
      outsideStreak.delete(id);
      insideIds.delete(id);
    }
  }
  for (const id of now) insideIds.add(id);
}

// --- Wiring -------------------------------------------------------------------

export function initBoundaries() {
  shapes = L.layerGroup().addTo(getMap());
  renderShapes();
  document.addEventListener('spots-changed', renderShapes);
  document.addEventListener('draw-boundary', (e) => startDrawing(e.detail));
  addCardSection(cardSection);
  onPosition(onFix);
  onScreenChange((screen) => draft && screen !== 'map' && stopDrawing());

  $('#draw-undo').addEventListener('click', () => {
    draft.points.pop();
    redrawDraft();
  });
  $('#draw-cancel').addEventListener('click', stopDrawing);
  $('#draw-clear').addEventListener('click', () => {
    if (!confirm(`Remove the boundary from “${draft.spot.name}”?`)) return;
    updateSpot(draft.spot.id, { boundary: null });
    stopDrawing();
    toast('Boundary removed.');
  });
  $('#draw-save').addEventListener('click', () => {
    const { spot, points } = draft;
    if (updateSpot(spot.id, { boundary: points })) toast(`Boundary saved: ${formatArea(areaHa(points))}.`);
    stopDrawing();
  });
}
