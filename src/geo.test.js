import { describe, expect, it } from 'vitest';
import { enToLatLng } from './gridref.js';
import { areaHa, distanceM, formatArea, formatDistance, pathLengthM, pointInPolygon, selfIntersects, simplifyPath } from './geo.js';

// A 200 m x 100 m rectangle on the National Grid near Avebury: 2 ha.
const corners = [
  [410000, 169000],
  [410200, 169000],
  [410200, 169100],
  [410000, 169100],
].map(([e, n]) => {
  const p = enToLatLng(e, n);
  return [p.lat, p.lng];
});

describe('geo', () => {
  it('measures distances', () => {
    expect(distanceM([51.5, -0.1], [51.5, -0.1])).toBe(0);
    // One degree of latitude is about 111.2 km.
    expect(distanceM([51, 0], [52, 0])).toBeGreaterThan(111000);
    expect(distanceM([51, 0], [52, 0])).toBeLessThan(111400);
    expect(pathLengthM([corners[0], corners[1], corners[2]])).toBeCloseTo(300, -1);
  });

  it('computes area on the National Grid', () => {
    expect(areaHa(corners)).toBeCloseTo(2, 2);
    expect(areaHa([...corners].reverse())).toBeCloseTo(2, 2);
  });

  it('tests point in polygon', () => {
    const mid = enToLatLng(410100, 169050);
    const out = enToLatLng(410300, 169050);
    expect(pointInPolygon(mid, corners)).toBe(true);
    expect(pointInPolygon(out, corners)).toBe(false);
  });

  it('formats for display', () => {
    expect(formatArea(2)).toBe('2.0 ha (4.9 acres)');
    expect(formatArea(12.3)).toBe('12 ha (30 acres)');
    expect(formatDistance(420)).toBe('420 m');
    expect(formatDistance(1234)).toBe('1.23 km');
  });
});

describe('simplifyPath', () => {
  it('drops points within tolerance and keeps real corners', () => {
    const ll = (e, n) => {
      const p = enToLatLng(e, n);
      return [p.lat, p.lng];
    };
    // A straight 100 m line with 0.3 m wobble, then a right-angle turn.
    const path = [];
    for (let i = 0; i <= 100; i += 5) path.push(ll(410000 + i, 169000 + (i % 10 ? 0.3 : 0)));
    path.push(ll(410100, 169100));
    const out = simplifyPath(path, 1);
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual(path[0]);
    expect(out.at(-1)).toEqual(path.at(-1));
  });
});

describe('selfIntersects', () => {
  it('spots a bow-tie but not a plain or concave shape', () => {
    expect(selfIntersects(corners)).toBe(false);
    expect(selfIntersects([corners[0], corners[2], corners[1], corners[3]])).toBe(true);
    // L-shaped (concave) field
    const L = [[0, 0], [0, 2], [1, 2], [1, 1], [2, 1], [2, 0]];
    expect(selfIntersects(L)).toBe(false);
  });
});
