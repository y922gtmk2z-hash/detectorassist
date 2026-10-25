// Search tracks: record where you have walked with live GPS and draw it as
// a swath roughly one detector sweep wide, so gaps in coverage show up.
// Stored on this device only. A web page cannot read GPS while the screen
// is off, so recording keeps the screen awake where the browser allows.
import L from 'leaflet';
import { trackToGpx } from './export.js';
import { distanceM, formatDistance, metresPerPixel, pathLengthM } from './geo.js';
import { hold, onPosition, release } from './location.js';
import { getMap } from './map.js';
import { onScreenChange, showScreen } from './router.js';
import { spotsContaining } from './spots.js';
import { $, download, esc, toast } from './ui.js';

const KEY = 'detectorassist.tracks.v1';
const LIVE_KEY = 'detectorassist.track-live.v1';
const SWEEP_WIDTH_M = 1.5; // typical coil width plus overlap
const MAX_ACCURACY_M = 25; // ignore fixes worse than this
const MIN_STEP_M = 2; // ignore jitter while standing still

let recording = null; // { startedAt, points: [[lat, lng, t]] }
let wakeLock = null;
let liveLine = null;
const shown = new Map(); // track id -> polyline

export function loadTracks() {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(t) ? t : [];
  } catch {
    return [];
  }
}

function storeTracks(tracks) {
  try {
    localStorage.setItem(KEY, JSON.stringify(tracks));
    return true;
  } catch {
    toast('Could not save the track: storage on this device is full or blocked.');
    return false;
  }
}

function sweepWeight() {
  const map = getMap();
  return Math.max(3, SWEEP_WIDTH_M / metresPerPixel(map.getCenter().lat, map.getZoom()));
}

function swath(points, live) {
  return L.polyline(
    points.map(([lat, lng]) => [lat, lng]),
    {
      color: live ? '#F2B632' : '#1E4D3B',
      opacity: live ? 0.75 : 0.5,
      weight: sweepWeight(),
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false,
    },
  ).addTo(getMap());
}

function restyle() {
  const weight = sweepWeight();
  liveLine?.setStyle({ weight });
  for (const line of shown.values()) line.setStyle({ weight });
}

// --- Recording --------------------------------------------------------------

async function keepAwake() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    wakeLock = null;
  }
}

function onVisibility() {
  if (recording && document.visibilityState === 'visible') keepAwake();
}

function saveLive() {
  try {
    localStorage.setItem(LIVE_KEY, JSON.stringify(recording));
  } catch {
    /* best effort */
  }
}

function onFix(pos) {
  if (!recording || pos.accuracy > MAX_ACCURACY_M) return;
  const pts = recording.points;
  const prev = pts[pts.length - 1];
  if (prev && distanceM(prev, [pos.lat, pos.lng]) < Math.max(MIN_STEP_M, pos.accuracy / 4)) return;
  pts.push([+pos.lat.toFixed(6), +pos.lng.toFixed(6), Math.round(pos.time / 1000)]);
  liveLine.addLatLng([pos.lat, pos.lng]);
  saveLive();
  renderStatus();
}

function renderStatus() {
  const el = $('#track-status');
  el.hidden = !recording;
  for (const b of document.querySelectorAll('[data-act="track"]')) b.setAttribute('aria-pressed', String(!!recording));
  if (!recording) return;
  const mins = Math.floor((Date.now() - recording.startedAt) / 60000);
  $('#track-status-text').textContent =
    `Recording · ${formatDistance(pathLengthM(recording.points))} · ${mins} min` +
    (recording.points.length ? '' : ' · waiting for GPS');
}

function startRecording() {
  if (!hold('track')) return;
  recording = { startedAt: Date.now(), points: [] };
  liveLine = swath([], true);
  keepAwake();
  saveLive();
  renderStatus();
  toast('Recording your search track. Keep this screen on.');
}

function trackName(t) {
  const first = t.points[0];
  const spot = first && spotsContaining(first[0], first[1])[0];
  const when = new Date(t.startedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return spot ? `${spot.name}, ${when}` : when;
}

function finish(t) {
  if (t.points.length < 2) return false;
  const track = {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    name: trackName(t),
    startedAt: new Date(t.startedAt).toISOString(),
    endedAt: new Date((t.points.at(-1)[2] ?? Date.now() / 1000) * 1000).toISOString(),
    distanceM: Math.round(pathLengthM(t.points)),
    points: t.points,
  };
  return storeTracks([track, ...loadTracks()]) ? track : false;
}

function stopRecording() {
  const t = recording;
  recording = null;
  release('track');
  wakeLock?.release().catch(() => {});
  wakeLock = null;
  liveLine?.remove();
  liveLine = null;
  localStorage.removeItem(LIVE_KEY);
  renderStatus();
  const saved = finish(t);
  if (saved) {
    showTrack(saved);
    toast(`Track saved: ${formatDistance(saved.distanceM)}. See it under Spots.`);
  } else {
    toast('Track discarded: not enough GPS points.');
  }
}

/** A recording interrupted by a reload or crash is saved, not lost. */
function recoverLive() {
  let t = null;
  try {
    t = JSON.parse(localStorage.getItem(LIVE_KEY) || 'null');
  } catch {
    /* ignore */
  }
  localStorage.removeItem(LIVE_KEY);
  if (t?.points?.length >= 2 && finish(t)) toast('An unfinished track was saved under Spots.');
}

// --- Display and list ----------------------------------------------------------

function showTrack(t) {
  if (shown.has(t.id)) return;
  shown.set(t.id, swath(t.points, false));
}

function hideTrack(id) {
  shown.get(id)?.remove();
  shown.delete(id);
}

const list = $('#tracks-list');

function renderList() {
  const tracks = loadTracks();
  if (!tracks.length) {
    list.innerHTML = '<li class="spots-empty">No tracks yet. Tap the record button on the map while you search.</li>';
    return;
  }
  list.innerHTML = tracks
    .map((t) => {
      const mins = Math.round((Date.parse(t.endedAt) - Date.parse(t.startedAt)) / 60000);
      return `<li class="spot track" data-id="${esc(t.id)}">
        <div class="spot-text">
          <span class="spot-name">${esc(t.name)}</span>
          <span class="spot-layer">${esc(formatDistance(t.distanceM))} · ${mins} min</span>
        </div>
        <div class="track-actions">
          <button type="button" class="filter" data-act="toggle" aria-pressed="${shown.has(t.id)}">${shown.has(t.id) ? 'Shown' : 'Show'}</button>
          <button type="button" class="filter" data-act="view">View</button>
          <button type="button" class="filter" data-act="gpx">GPX</button>
          <button type="button" class="icon-btn flat" data-act="delete" aria-label="Delete track ${esc(t.name)}">
            <svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
          </button>
        </div>
      </li>`;
    })
    .join('');
}

list.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  const id = e.target.closest('.track')?.dataset.id;
  const t = loadTracks().find((x) => x.id === id);
  if (!t) return;
  if (act === 'toggle') shown.has(id) ? hideTrack(id) : showTrack(t);
  if (act === 'view') {
    showTrack(t);
    showScreen('map');
    getMap().fitBounds(L.latLngBounds(t.points.map(([a, b]) => [a, b])), { padding: [40, 40], maxZoom: 19 });
  }
  if (act === 'gpx') download(trackToGpx(t), 'application/gpx+xml', `track-${t.startedAt.slice(0, 10)}.gpx`);
  if (act === 'delete' && confirm(`Delete track “${t.name}”?`)) {
    hideTrack(id);
    storeTracks(loadTracks().filter((x) => x.id !== id));
  }
  renderList();
});

export function initTracks() {
  for (const b of document.querySelectorAll('[data-act="track"]')) {
    b.addEventListener('click', () => (recording ? stopRecording() : startRecording()));
  }
  $('#track-stop').addEventListener('click', stopRecording);
  onPosition(onFix);
  getMap().on('zoomend', restyle);
  document.addEventListener('visibilitychange', onVisibility);
  setInterval(() => recording && renderStatus(), 30000);
  onScreenChange((s) => s === 'spots' && renderList());
  recoverLive();
}
