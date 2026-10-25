// OS National Grid (EPSG:27700) <-> WGS84, done locally with proj4.
// The 7-parameter Helmert transform below is accurate to roughly 5 m,
// which is why grid refs are shown to 8 figures (10 m squares).
import proj4 from 'proj4';

proj4.defs(
  'EPSG:27700',
  '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 ' +
    '+ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs',
);

const toBng = proj4('EPSG:4326', 'EPSG:27700');

export function latLngToEN(lat, lng) {
  const [e, n] = toBng.forward([lng, lat]);
  return { e, n };
}

export function enToLatLng(e, n) {
  const [lng, lat] = toBng.inverse([e, n]);
  return { lat, lng };
}

// Letters skip "I". Index 0..24 maps to A..Z without I.
function letterIndex(ch) {
  const i = ch.charCodeAt(0) - 65;
  return i > 7 ? i - 1 : i;
}
function indexLetter(i) {
  return String.fromCharCode((i > 7 ? i + 1 : i) + 65);
}

function inGrid(e, n) {
  return e >= 0 && e < 700000 && n >= 0 && n < 1300000;
}

/** Easting/northing -> "SU 1234 5678" (digits = total figures, 2..10, even). */
export function enToGridRef(e, n, digits = 8) {
  if (!inGrid(e, n)) return null;
  const e100k = Math.floor(e / 100000);
  const n100k = Math.floor(n / 100000);
  const l1 = 19 - n100k - ((19 - n100k) % 5) + Math.floor((e100k + 10) / 5);
  const l2 = (((19 - n100k) * 5) % 25) + (e100k % 5);
  const half = digits / 2;
  const scale = 10 ** (5 - half);
  const fe = String(Math.floor((e % 100000) / scale)).padStart(half, '0');
  const fn = String(Math.floor((n % 100000) / scale)).padStart(half, '0');
  return `${indexLetter(l1)}${indexLetter(l2)} ${fe} ${fn}`;
}

export function latLngToGridRef(lat, lng, digits = 8) {
  const { e, n } = latLngToEN(lat, lng);
  return enToGridRef(e, n, digits);
}

const GRID_RE = /^([HNOST][A-HJ-Z])\s*(\d+)(?:\s+(\d+))?$/i;

/**
 * Parse an OS grid ref such as "SU 123 456", "su123456" or "TQ 30047 80071".
 * Returns the centre of the referenced square plus its size in metres,
 * or null when the text is not a grid ref.
 */
export function parseGridRef(text) {
  const m = GRID_RE.exec(text.trim().replace(/\s+/g, ' '));
  if (!m) return null;
  const letters = m[1].toUpperCase();
  let de;
  let dn;
  if (m[3] !== undefined) {
    if (m[2].length !== m[3].length) return null;
    de = m[2];
    dn = m[3];
  } else {
    if (m[2].length % 2) return null;
    de = m[2].slice(0, m[2].length / 2);
    dn = m[2].slice(m[2].length / 2);
  }
  if (de.length < 1 || de.length > 5) return null;

  const l1 = letterIndex(letters[0]);
  const l2 = letterIndex(letters[1]);
  const e100k = ((l1 - 2) % 5) * 5 + (l2 % 5);
  const n100k = 19 - Math.floor(l1 / 5) * 5 - Math.floor(l2 / 5);
  const size = 10 ** (5 - de.length);
  const e = e100k * 100000 + Number(de) * size + size / 2;
  const n = n100k * 100000 + Number(dn) * size + size / 2;
  if (!inGrid(e, n)) return null;
  return { e, n, size, ...enToLatLng(e, n) };
}

const LATLNG_RE = /^(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/;

/** Parse "51.5, -0.12" style decimal coordinates. */
export function parseLatLng(text) {
  const m = LATLNG_RE.exec(text.trim());
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function formatLatLng(lat, lng) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
