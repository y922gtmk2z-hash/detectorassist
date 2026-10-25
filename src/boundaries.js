// Permission boundaries drawn on saved spots. Shown on the map, named on
// the spot card, and with live GPS on, you are warned on leaving one.
import L from 'leaflet';
import { areaHa, distanceM, formatArea, pointInPolygon, selfIntersects, simplifyPath } from './geo.js';
import { hold, onPosition, release } from './location.js';
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
// Three ways to draw: tap corners (with draggable corners and "+" handles
// to insert one), trace freehand with a finger, or walk the boundary with
// GPS. Any of them can be followed by another, e.g. walk then tidy up.

const bar = $('#draw-bar');
const FREEHAND_TOLERANCE_M = 1.5;
const WALK_MAX_ACCURACY_M = 15;
const WALK_MIN_STEP_M = 3;
const MAX_HANDLES = 120; // beyond this, handles clutter more than they help

const vertexIcon = L.divIcon({ className: 'vertex-handle', iconSize: [22, 22] });
const midIcon = L.divIcon({ className: 'mid-handle', html: '+', iconSize: [20, 20] });

const round = (ll) => [+ll.lat.toFixed(6), +ll.lng.toFixed(6)];

function snapshot() {
  draft.history.push(draft.points.map((p) => [...p]));
  if (draft.history.length > 500) draft.history.shift();
}

function redrawDraft({ handles = true } = {}) {
  draft.layer.setLatLngs(draft.points);
  if (handles) drawHandles();
  const n = draft.points.length;
  const hints = {
    tap: `Tap the map at each corner of “${draft.spot.name}”. Drag a corner to move it, tap + to add one.`,
    freehand: 'Trace round the edge with one finger. Use two fingers to move the map.',
    walk: draft.walking ? 'Walk along the edge. Points are added as you go.' : 'Waiting for a good GPS fix…',
  };
  const crosses = n >= 4 && selfIntersects(draft.points);
  $('#draw-info').textContent =
    n < 3 ? hints[draft.mode] : crosses ? 'The outline crosses itself. Undo or drag a corner to fix it.' : `${n} points · ${formatArea(areaHa(draft.points))}`;
  $('#draw-hint').textContent = n >= 3 && !crosses ? hints[draft.mode] : '';
  $('#draw-save').disabled = n < 3 || crosses;
  $('#draw-undo').disabled = !draft.history.length;
  for (const b of document.querySelectorAll('[data-draw-mode]')) b.setAttribute('aria-checked', String(b.dataset.drawMode === draft.mode));
}

function drawHandles() {
  draft.handles.clearLayers();
  const pts = draft.points;
  if (draft.mode !== 'tap' || pts.length > MAX_HANDLES) {
    for (const p of pts) L.circleMarker(p, { radius: 3, color: '#12211A', weight: 1, fillColor: '#F2B632', fillOpacity: 1, interactive: false }).addTo(draft.handles);
    return;
  }
  pts.forEach((p, i) => {
    L.marker(p, { icon: vertexIcon, draggable: true, keyboard: false, title: `Corner ${i + 1}` })
      .on('dragstart', snapshot)
      .on('drag', (e) => {
        pts[i] = round(e.target.getLatLng());
        redrawDraft({ handles: false });
      })
      .on('dragend', () => redrawDraft())
      .addTo(draft.handles);
  });
  if (pts.length < 3) return;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    L.marker([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], { icon: midIcon, keyboard: false, title: 'Add a corner here' })
      .on('click', (e) => {
        snapshot();
        pts.splice(i + 1, 0, round(e.target.getLatLng()));
        redrawDraft();
      })
      .addTo(draft.handles);
  });
}

// Freehand: one-finger trace replaces the outline; two fingers still pan/zoom.
const pointers = new Set();
let stroke = null;

function onPointerDown(e) {
  pointers.add(e.pointerId);
  if (pointers.size > 1) {
    cancelStroke();
    getMap().dragging.enable();
    return;
  }
  if (e.target.closest('.leaflet-control, .leaflet-marker-icon')) return;
  getMap().dragging.disable();
  stroke = { points: [], line: L.polyline([], { color: '#F2B632', weight: 4, interactive: false }).addTo(getMap()) };
  addStrokePoint(e);
}

const CLOSE_PX = 18; // finishing this close to the start closes the loop

function addStrokePoint(e) {
  const map = getMap();
  const cp = map.mouseEventToContainerPoint(e);
  const last = stroke.last;
  if (last && last.distanceTo(cp) < 4) return;
  stroke.start ??= cp;
  const fromStart = stroke.start.distanceTo(cp);
  stroke.far ||= fromStart > CLOSE_PX * 4;
  // Back near the start after going round: close here, ignore any overshoot.
  if (stroke.far && fromStart < CLOSE_PX) {
    stroke.closed = true;
    return;
  }
  if (stroke.closed) return;
  stroke.last = cp;
  const ll = map.containerPointToLatLng(cp);
  stroke.points.push(round(ll));
  stroke.line.addLatLng(ll);
}

function onPointerMove(e) {
  if (stroke && pointers.size === 1) addStrokePoint(e);
}

function onPointerUp(e) {
  pointers.delete(e.pointerId);
  if (!pointers.size) getMap().dragging.disable();
  if (!stroke) return;
  const pts = simplifyPath(stroke.points, FREEHAND_TOLERANCE_M);
  cancelStroke();
  if (pts.length < 3) return;
  snapshot();
  draft.points = pts;
  redrawDraft();
}

function cancelStroke() {
  stroke?.line.remove();
  stroke = null;
}

function setFreehand(on) {
  const el = getMap().getContainer();
  const fn = on ? 'addEventListener' : 'removeEventListener';
  el[fn]('pointerdown', onPointerDown);
  el[fn]('pointermove', onPointerMove);
  window[fn]('pointerup', onPointerUp);
  window[fn]('pointercancel', onPointerUp);
  pointers.clear();
  cancelStroke();
  if (on) getMap().dragging.disable();
  else getMap().dragging.enable();
}

function onWalkFix(pos) {
  if (draft?.mode !== 'walk' || pos.accuracy > WALK_MAX_ACCURACY_M) return;
  const last = draft.points.at(-1);
  if (last && distanceM(last, pos) < WALK_MIN_STEP_M) return;
  snapshot(); // every walked point can be undone
  if (!draft.walking) {
    // A walk starts a fresh outline; Undo brings back the old one.
    draft.points = [];
    draft.walking = true;
  }
  draft.points.push([+pos.lat.toFixed(6), +pos.lng.toFixed(6)]);
  redrawDraft();
}

/** Drop points at the end of a loop that just come back to the start. */
function trimClosing(points, metres) {
  const out = points.slice();
  while (out.length > 3 && distanceM(out.at(-1), out[0]) < metres) out.pop();
  return out;
}

function finishWalk() {
  if (!draft?.walking && draft?.mode !== 'walk') return;
  release('boundary');
  if (draft.walking && draft.points.length >= 3) draft.points = trimClosing(simplifyPath(draft.points, 1), WALK_MIN_STEP_M * 2);
  draft.walking = false;
}

function setMode(mode) {
  if (draft.mode === 'walk') finishWalk();
  if (draft.mode === 'freehand') setFreehand(false);
  draft.mode = mode;
  setClickOverride(
    mode === 'tap'
      ? (ll) => {
          snapshot();
          draft.points.push(round(ll));
          redrawDraft();
        }
      : () => {},
  );
  if (mode === 'freehand') setFreehand(true);
  if (mode === 'walk' && !hold('boundary')) return setMode('tap');
  redrawDraft();
}

export function startDrawing(spot) {
  if (draft) stopDrawing();
  showScreen('map');
  goTo(spot.lat, spot.lng, 17);
  const map = getMap();
  draft = {
    spot,
    mode: 'tap',
    walking: false,
    history: [],
    points: spot.boundary ? spot.boundary.map((p) => [...p]) : [],
    layer: L.polygon([], { color: '#F2B632', weight: 3, dashArray: '8 6', fillOpacity: 0.12, interactive: false }).addTo(map),
    handles: L.layerGroup().addTo(map),
  };
  renderShapes();
  document.body.dataset.drawing = 'true';
  bar.hidden = false;
  $('#draw-clear').hidden = !spot.boundary;
  setMode('tap');
}

function stopDrawing() {
  finishWalk();
  if (draft.mode === 'freehand') setFreehand(false);
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
  onPosition(onWalkFix);
  onScreenChange((screen) => draft && screen !== 'map' && stopDrawing());

  $('#draw-undo').addEventListener('click', () => {
    if (!draft.history.length) return;
    draft.points = draft.history.pop();
    redrawDraft();
  });
  for (const b of document.querySelectorAll('[data-draw-mode]')) {
    b.addEventListener('click', () => draft && setMode(b.dataset.drawMode));
  }
  $('#draw-cancel').addEventListener('click', stopDrawing);
  $('#draw-clear').addEventListener('click', () => {
    if (!confirm(`Remove the boundary from “${draft.spot.name}”?`)) return;
    updateSpot(draft.spot.id, { boundary: null });
    stopDrawing();
    toast('Boundary removed.');
  });
  $('#draw-save').addEventListener('click', () => {
    finishWalk();
    const { spot, points } = draft;
    if (updateSpot(spot.id, { boundary: points })) toast(`Boundary saved: ${formatArea(areaHa(points))}.`);
    stopDrawing();
  });
}
