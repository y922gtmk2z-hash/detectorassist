// Shareable/bookmarkable map state in the URL hash, e.g.
//   #pin=51.41588,-1.85687&z=17&n=Top%20field   (a pin)
//   #at=52.6,-1.5&z=7                           (just a view)
const num = (v) => (v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

function pair(v) {
  const [a, b] = (v ?? '').split(',').map(num);
  return a != null && b != null && Math.abs(a) <= 90 && Math.abs(b) <= 180 ? { lat: a, lng: b } : null;
}

export function parseLink(hash) {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const pin = pair(q.get('pin'));
  const at = pair(q.get('at'));
  const z = num(q.get('z') ?? '');
  const zoom = z != null ? Math.min(19, Math.max(6, Math.round(z))) : null;
  if (pin) return { pin, zoom: zoom ?? 16, name: (q.get('n') ?? '').slice(0, 100) || null };
  if (at) return { at, zoom: zoom ?? 13 };
  return null;
}

export function buildLink({ pin, at, zoom, name }) {
  const q = new URLSearchParams();
  if (pin) q.set('pin', `${pin.lat.toFixed(5)},${pin.lng.toFixed(5)}`);
  else if (at) q.set('at', `${at.lat.toFixed(5)},${at.lng.toFixed(5)}`);
  if (zoom != null) q.set('z', String(Math.round(zoom)));
  if (pin && name) q.set('n', name);
  return `#${q.toString()}`;
}
