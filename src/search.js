// Search screen: one field for address, postcode, OS grid ref or lat/lng.
// Grid refs and coordinates are parsed locally as you type. Addresses and
// postcodes go to Nominatim only when submitted (its policy bans autocomplete).
import { geocode } from './geocode.js';
import { formatLatLng, latLngToGridRef, parseGridRef, parseLatLng } from './gridref.js';
import { goTo, selectPoint } from './map.js';
import { showScreen } from './router.js';
import { locate } from './location.js';
import { $, esc, toast } from './ui.js';

const input = $('#search-input');
const list = $('#search-results');
const status = $('#search-status');
let results = [];
let remote = { q: null, results: [] };

function localResults(q) {
  const grid = parseGridRef(q);
  if (grid) {
    const digits = 2 * (5 - Math.round(Math.log10(grid.size)));
    const label = latLngToGridRef(grid.lat, grid.lng, digits);
    return [{ kind: 'Grid ref', name: label, detail: `${grid.size} m square · ${formatLatLng(grid.lat, grid.lng)}`, lat: grid.lat, lng: grid.lng, zoom: grid.size >= 1000 ? 14 : 16 }];
  }
  const ll = parseLatLng(q);
  if (ll) {
    return [{ kind: 'Coordinates', name: formatLatLng(ll.lat, ll.lng), detail: latLngToGridRef(ll.lat, ll.lng) ?? 'Outside OS grid', ...ll }];
  }
  return [];
}

function render() {
  const q = input.value.trim();
  results = localResults(q);
  if (results.length || q.length < 3) {
    list.innerHTML = results.map(rowHtml).join('');
  } else if (remote.q === q) {
    results = remote.results;
    list.innerHTML = results.length
      ? results.map(rowHtml).join('')
      : '<li class="result-empty">No places found in England.</li>';
  } else {
    list.innerHTML = `<li><button type="button" class="result result-go" data-remote>
        <span class="result-kind">Address or postcode</span>
        <span class="result-name">Search for “${esc(q)}”</span>
        <span class="result-detail">Press Enter or tap to search</span></button></li>`;
  }
}

function rowHtml(r, i) {
  return `<li><button type="button" class="result" data-i="${i}">
      <span class="result-kind">${esc(r.kind)}</span>
      <span class="result-name">${esc(r.name)}</span>
      <span class="result-detail ${r.kind === 'Address' ? '' : 'mono'}">${esc(r.detail)}</span></button></li>`;
}

async function searchRemote() {
  const q = input.value.trim();
  if (q.length < 3 || localResults(q).length) return;
  status.textContent = 'Searching…';
  try {
    const found = await geocode(q);
    remote = { q, results: found.map((r) => ({ kind: 'Address', ...r })) };
    status.textContent = '';
    render();
  } catch (err) {
    if (err.name === 'AbortError') return;
    status.textContent = 'Search is unavailable right now. Grid refs and coordinates still work.';
  }
}

function choose(r) {
  selectPoint(r.lat, r.lng, r.kind === 'Coordinates' ? null : r.name);
  showScreen('map');
  goTo(r.lat, r.lng, r.zoom ?? 16);
}

export function openSearch() {
  showScreen('search');
  input.focus();
  input.select();
}

export function initSearch() {
  input.addEventListener('input', () => {
    status.textContent = '';
    render();
  });
  $('#search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (results.length) choose(results[0]);
    else searchRemote();
  });
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.result');
    if (!btn) return;
    if (btn.hasAttribute('data-remote')) searchRemote();
    else choose(results[Number(btn.dataset.i)]);
  });
  $('#search-back').addEventListener('click', () => showScreen('map'));
  $('#search-locate').addEventListener('click', () => {
    showScreen('map');
    locate();
  });
  $('#search-pick').addEventListener('click', () => {
    showScreen('map');
    toast('Tap the map to drop a pin.');
  });
  for (const el of document.querySelectorAll('[data-act="search"]')) {
    el.addEventListener('click', openSearch);
  }
}
