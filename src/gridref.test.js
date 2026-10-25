import { describe, expect, it } from 'vitest';
import {
  enToGridRef,
  latLngToEN,
  latLngToGridRef,
  parseGridRef,
  parseLatLng,
} from './gridref.js';

describe('enToGridRef', () => {
  it('picks the right 100 km square letters', () => {
    expect(enToGridRef(530000, 180000)).toBe('TQ 3000 8000');
    expect(enToGridRef(412345, 145678)).toBe('SU 1234 4567');
    expect(enToGridRef(651409, 313177)).toBe('TG 5140 1317');
    expect(enToGridRef(325000, 673000)).toBe('NT 2500 7300');
    expect(enToGridRef(160000, 30000)).toBe('SW 6000 3000');
  });

  it('formats different precisions', () => {
    expect(enToGridRef(412345, 145678, 6)).toBe('SU 123 456');
    expect(enToGridRef(412345, 145678, 10)).toBe('SU 12345 45678');
  });

  it('rejects points off the grid', () => {
    expect(enToGridRef(-5, 100)).toBeNull();
    expect(enToGridRef(800000, 100)).toBeNull();
  });
});

describe('parseGridRef', () => {
  it('parses spaced and unspaced refs to the square centre', () => {
    const a = parseGridRef('SU 123 456');
    expect(a.e).toBe(412350);
    expect(a.n).toBe(145650);
    expect(a.size).toBe(100);
    expect(parseGridRef('su123456')).toEqual(a);
    expect(parseGridRef('  SU 123   456 ')).toEqual(a);
  });

  it('round-trips with enToGridRef', () => {
    const p = parseGridRef('TQ 30047 80071');
    expect(p.e).toBe(530047.5);
    expect(enToGridRef(p.e, p.n, 10)).toBe('TQ 30047 80071');
  });

  it('rejects things that are not grid refs', () => {
    expect(parseGridRef('SW1A 1AA')).toBeNull();
    expect(parseGridRef('SU 12 456')).toBeNull();
    expect(parseGridRef('SU12345')).toBeNull();
    expect(parseGridRef('SI 123 456')).toBeNull();
    expect(parseGridRef('London')).toBeNull();
  });
});

describe('WGS84 conversion', () => {
  // Nelson's Column, roughly TQ 3001 8048 (OS Explorer).
  it('places central London in TQ', () => {
    expect(latLngToGridRef(51.50775, -0.12802)).toMatch(/^TQ 300\d 804\d$/);
  });

  it('round-trips through proj4 within a metre', () => {
    const p = parseGridRef('SU 12345 45678');
    const { e, n } = latLngToEN(p.lat, p.lng);
    expect(Math.abs(e - p.e)).toBeLessThan(1);
    expect(Math.abs(n - p.n)).toBeLessThan(1);
  });
});

describe('parseLatLng', () => {
  it('parses decimal pairs', () => {
    expect(parseLatLng('51.5, -0.12')).toEqual({ lat: 51.5, lng: -0.12 });
    expect(parseLatLng('51.5 -0.12')).toEqual({ lat: 51.5, lng: -0.12 });
    expect(parseLatLng('SU 123 456')).toBeNull();
    expect(parseLatLng('95, 0')).toBeNull();
  });
});
