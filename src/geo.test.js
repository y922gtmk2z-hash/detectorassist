import { describe, expect, it } from 'vitest';
import { enToLatLng } from './gridref.js';
import { areaHa, distanceM, formatArea, formatDistance, pathLengthM, pointInPolygon } from './geo.js';

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
