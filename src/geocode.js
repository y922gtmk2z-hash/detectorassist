// Nominatim (OpenStreetMap) address/postcode search.
// Usage policy: max 1 request/second, identify the app (browsers send the
// Referer header for us; a page cannot set User-Agent), and no
// autocomplete: we only query when the user submits.
import { ENGLAND_BOUNDS, NOMINATIM_URL } from './config.js';

const MIN_INTERVAL_MS = 1100;
const cache = new Map();
let lastRequest = 0;
let inflight = null;

const [[south, west], [north, east]] = ENGLAND_BOUNDS;

export async function geocode(query) {
  const key = query.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);

  const wait = lastRequest + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));

  inflight?.abort();
  inflight = new AbortController();
  lastRequest = Date.now();

  const params = new URLSearchParams({
    q: query.trim(),
    format: 'jsonv2',
    addressdetails: '1',
    countrycodes: 'gb',
    viewbox: `${west},${north},${east},${south}`,
    bounded: '1',
    limit: '8',
    'accept-language': 'en-GB',
  });
  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    signal: inflight.signal,
    referrerPolicy: 'strict-origin-when-cross-origin',
  });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const rows = await res.json();

  // England only: drop results in Wales/Scotland that fall inside the box.
  const results = rows
    .filter((r) => !r.address?.state || r.address.state === 'England')
    .map((r) => ({
      name: r.name || r.display_name.split(',')[0],
      detail: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
    }));
  cache.set(key, results);
  return results;
}
