// Small geometry helpers. Points are { lat, lng } or [lat, lng].
import { latLngToEN } from './gridref.js';

const R = 6371008.8; // mean Earth radius, metres
const rad = (d) => (d * Math.PI) / 180;
const pt = (p) => (Array.isArray(p) ? { lat: p[0], lng: p[1] } : p);

/** Great-circle distance in metres. */
export function distanceM(a, b) {
  a = pt(a);
  b = pt(b);
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function pathLengthM(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distanceM(points[i - 1], points[i]);
  return total;
}

/** Ray-casting point-in-polygon. `polygon` is a ring of [lat, lng]. */
export function pointInPolygon(p, polygon) {
  const { lat: y, lng: x } = pt(p);
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Area in hectares, measured on the OS National Grid (accurate for England). */
export function areaHa(polygon) {
  const en = polygon.map(([lat, lng]) => latLngToEN(lat, lng));
  let twice = 0;
  for (let i = 0, j = en.length - 1; i < en.length; j = i++) twice += en[j].e * en[i].n - en[i].e * en[j].n;
  return Math.abs(twice) / 2 / 10000;
}

export function formatArea(ha) {
  return `${ha.toFixed(ha < 10 ? 1 : 0)} ha (${(ha * 2.47105).toFixed(ha < 4 ? 1 : 0)} acres)`;
}

export function formatDistance(m) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`;
}

/** Ground metres per screen pixel for Web Mercator at this latitude and zoom. */
export function metresPerPixel(lat, zoom) {
  return (40075016.686 * Math.cos(rad(lat))) / 2 ** (zoom + 8);
}

/**
 * Douglas-Peucker simplification of a [lat, lng] path, tolerance in metres
 * (measured on the OS grid). Keeps the first and last points.
 */
export function simplifyPath(points, toleranceM) {
  if (points.length < 3) return points.slice();
  const en = points.map(([lat, lng]) => latLngToEN(lat, lng));
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const { e: x1, n: y1 } = en[a];
    const { e: x2, n: y2 } = en[b];
    const len = Math.hypot(x2 - x1, y2 - y1);
    let worst = -1;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const { e: x, n: y } = en[i];
      const d = len ? Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) / len : Math.hypot(x - x1, y - y1);
      if (d > worst) {
        worst = d;
        idx = i;
      }
    }
    if (worst > toleranceM) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function segmentsCross([a, b], [c, d]) {
  const orient = (p, q, r) => Math.sign((q[1] - p[1]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[1] - p[1]));
  return orient(a, b, c) !== orient(a, b, d) && orient(c, d, a) !== orient(c, d, b) && orient(a, b, c) && orient(c, d, a);
}

/** True if any two non-neighbouring edges of the closed ring cross. */
export function selfIntersects(ring) {
  const n = ring.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const s1 = [ring[i], ring[(i + 1) % n]];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // shares the closing vertex
      if (segmentsCross(s1, [ring[j], ring[(j + 1) % n]])) return true;
    }
  }
  return false;
}
