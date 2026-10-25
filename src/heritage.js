// Heritage overlay from the Historic England NHLE FeatureServer.
// Scheduled Monuments are a warning layer; other designations are shown
// for information. Data is fetched for the visible map area only.
import L from 'leaflet';
import {
  NHLE_ATTRIBUTION,
  NHLE_MIN_ZOOM,
  NHLE_POINTS_MIN_ZOOM,
  NHLE_SCHEDULED_FALLBACK_ID,
  NHLE_URL,
} from './config.js';
import { getMap, onSelect } from './map.js';
import { onScreenChange } from './router.js';
import { addCardSection, renderCard } from './spotcard.js';
import { $, esc, toast } from './ui.js';

const PREF_KEY = 'detectorassist.heritage';

// Which NHLE layers to show, matched against the service's layer names.
const KINDS = [
  { key: 'scheduled', match: /scheduled monument/i, label: 'Scheduled Monument', warn: true },
  { key: 'battlefield', match: /battlefield/i, label: 'Registered Battlefield' },
  { key: 'park', match: /park.*garden/i, label: 'Registered Park and Garden' },
  { key: 'whs', match: /world heritage/i, label: 'World Heritage Site' },
  { key: 'wreck', match: /wreck/i, label: 'Protected Wreck' },
  { key: 'listed', match: /listed building/i, label: 'Listed Building', points: true },
];

let enabled = true;
let layers = null; // resolved [{...kind, id, group}]
let loadAbort = null;
let moveTimer = null;
let warnedError = false;

function prop(props, ...names) {
  const keys = Object.keys(props || {});
  for (const n of names) {
    const k = keys.find((x) => x.toLowerCase() === n.toLowerCase());
    if (k && props[k] != null && props[k] !== '') return props[k];
  }
  return null;
}

async function resolveLayers() {
  if (layers) return layers;
  let meta = [];
  try {
    const res = await fetch(`${NHLE_URL}?f=json`);
    meta = (await res.json()).layers ?? [];
  } catch {
    // Fall back to the documented Scheduled Monuments layer only.
  }
  const found = [];
  for (const kind of KINDS) {
    const candidates = meta.filter((l) => kind.match.test(l.name));
    // Listed buildings come as points and polygons; we want the points.
    const pick = kind.points
      ? candidates.find((l) => /point/i.test(l.geometryType) || /point/i.test(l.name))
      : candidates.find((l) => !/point/i.test(l.geometryType)) ?? candidates[0];
    const id = pick?.id ?? (kind.key === 'scheduled' ? NHLE_SCHEDULED_FALLBACK_ID : null);
    if (id != null) found.push({ ...kind, id });
  }
  layers = found.map((k) => ({
    ...k,
    group: L.geoJSON(null, {
      attribution: k.warn ? NHLE_ATTRIBUTION : undefined,
      style: () => styleFor(k),
      pointToLayer: (_f, latlng) => L.circleMarker(latlng, { radius: 6, ...styleFor(k) }),
      onEachFeature: (f, layer) => layer.bindPopup(() => popupHtml(k, f.properties)),
    }),
  }));
  return layers;
}

function styleFor(k) {
  if (k.warn) return { color: '#b3261e', weight: 2.5, fillColor: '#b3261e', fillOpacity: 0.22 };
  return { color: '#1e4d3b', weight: 2, dashArray: '6 4', fillColor: '#1e4d3b', fillOpacity: 0.08 };
}

function popupHtml(k, p) {
  const name = prop(p, 'Name') ?? k.label;
  const entry = prop(p, 'ListEntry', 'List_Entry', 'ListEntryNumber');
  const link = prop(p, 'hyperlink', 'URL');
  return `<div class="heritage-pop">
      <p class="hp-kind ${k.warn ? 'hp-warn' : ''}">${esc(k.label)}</p>
      <p class="hp-name">${esc(name)}</p>
      ${k.warn ? '<p class="hp-alert">Do not detect without consent.</p>' : ''}
      ${entry ? `<p class="hp-entry">List entry ${esc(entry)}</p>` : ''}
      ${link && /^https:\/\//.test(link) ? `<a href="${esc(link)}" target="_blank" rel="noopener">Official list entry</a>` : ''}
    </div>`;
}

function query(id, params, signal) {
  const qs = new URLSearchParams({ where: '1=1', inSR: '4326', outSR: '4326', f: 'geojson', ...params });
  return fetch(`${NHLE_URL}/${id}/query?${qs}`, { signal }).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });
}

async function refresh() {
  const map = getMap();
  const hint = $('#heritage-hint');
  loadAbort?.abort();
  const zoom = map.getZoom();
  const visible = enabled && document.body.dataset.screen !== 'spots';
  hint.hidden = !(visible && zoom < NHLE_MIN_ZOOM);
  if (!layers && !visible) return;
  const all = await resolveLayers();
  if (!visible || zoom < NHLE_MIN_ZOOM) {
    for (const l of all) l.group.clearLayers().remove();
    return;
  }
  // Scheduled Monuments added last so they sit on top.
  for (const l of [...all].reverse()) if (!map.hasLayer(l.group)) l.group.addTo(map);
  loadAbort = new AbortController();
  const b = map.getBounds();
  // Simplify polygons to about one screen pixel.
  const offset = (b.getEast() - b.getWest()) / map.getSize().x;
  const params = {
    geometry: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(','),
    geometryType: 'esriGeometryEnvelope',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'true',
    geometryPrecision: '6',
    maxAllowableOffset: String(offset),
    resultRecordCount: '1000',
  };
  const signal = loadAbort.signal;
  await Promise.all(
    all.map(async (l) => {
      if (l.points && zoom < NHLE_POINTS_MIN_ZOOM) return l.group.clearLayers();
      try {
        const data = await query(l.id, params, signal);
        l.group.clearLayers();
        l.group.addData(data);
      } catch (err) {
        if (err.name === 'AbortError') return;
        if (!warnedError) toast('Heritage data is unavailable right now.');
        warnedError = true;
      }
    }),
  );
}

function scheduleRefresh() {
  clearTimeout(moveTimer);
  moveTimer = setTimeout(refresh, 400);
}

// --- Spot card warning ----------------------------------------------------

let checkSeq = 0;
let check = { key: null, state: 'idle', names: [] };

async function checkPin(s) {
  if (!s) return;
  const key = `${s.lat},${s.lng}`;
  const seq = ++checkSeq;
  check = { key, state: 'loading', names: [] };
  renderCard();
  try {
    const all = await resolveLayers();
    const sm = all.find((l) => l.warn);
    const data = await query(sm.id, {
      geometry: `${s.lng},${s.lat}`,
      geometryType: 'esriGeometryPoint',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: '*',
      returnGeometry: 'false',
    });
    if (seq !== checkSeq) return;
    check = { key, state: 'done', names: (data.features ?? []).map((f) => prop(f.properties, 'Name') ?? 'Scheduled Monument') };
  } catch {
    if (seq !== checkSeq) return;
    check = { key, state: 'error', names: [] };
  }
  renderCard();
}

function cardSection(s) {
  if (check.key !== `${s.lat},${s.lng}`) return null;
  const el = document.createElement('div');
  if (check.state === 'done' && check.names.length) {
    el.className = 'card-warn';
    el.setAttribute('role', 'alert');
    el.innerHTML = `<strong>Inside a Scheduled Monument:</strong> ${esc(check.names.join(', '))}. Do not detect without consent.
      <span class="card-src">Source: Historic England NHLE</span>`;
  } else if (check.state === 'error') {
    el.className = 'card-note';
    el.textContent = 'Could not check for Scheduled Monuments. Check the Historic England list before you detect.';
  } else if (check.state === 'loading') {
    el.className = 'card-note';
    el.textContent = 'Checking for Scheduled Monuments…';
  } else {
    el.className = 'card-note';
    el.textContent = 'Not inside a Scheduled Monument.';
  }
  return el;
}

// --- Toggle ---------------------------------------------------------------

function setEnabled(on) {
  enabled = on;
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    /* preference is optional */
  }
  for (const b of document.querySelectorAll('[data-act="heritage"]')) b.setAttribute('aria-pressed', String(on));
  refresh();
}

export function initHeritage() {
  try {
    enabled = localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    enabled = true;
  }
  for (const b of document.querySelectorAll('[data-act="heritage"]')) {
    b.setAttribute('aria-pressed', String(enabled));
    b.addEventListener('click', () => setEnabled(!enabled));
  }
  $('#heritage-hint').addEventListener('click', () => getMap().setZoom(NHLE_MIN_ZOOM));
  addCardSection(cardSection);
  onSelect(checkPin);
  getMap().on('moveend', scheduleRefresh);
  onScreenChange(scheduleRefresh);
  scheduleRefresh();
}
