import { describe, expect, it } from 'vitest';
import { buildLink, parseLink } from './link.js';

describe('share links', () => {
  it('round-trips a named pin', () => {
    const hash = buildLink({ pin: { lat: 51.415881, lng: -1.856872 }, zoom: 17, name: 'Top field & lane' });
    expect(hash).toBe('#pin=51.41588%2C-1.85687&z=17&n=Top+field+%26+lane');
    expect(parseLink(hash)).toEqual({ pin: { lat: 51.41588, lng: -1.85687 }, zoom: 17, name: 'Top field & lane' });
  });

  it('parses a view and clamps zoom', () => {
    expect(parseLink('#at=52.6,-1.5&z=40')).toEqual({ at: { lat: 52.6, lng: -1.5 }, zoom: 19 });
    expect(parseLink('#pin=51.4,-1.8')).toEqual({ pin: { lat: 51.4, lng: -1.8 }, zoom: 16, name: null });
  });

  it('ignores junk', () => {
    expect(parseLink('')).toBeNull();
    expect(parseLink('#pin=abc,1')).toBeNull();
    expect(parseLink('#pin=95,1')).toBeNull();
    expect(parseLink('#pin=,')).toBeNull();
  });
});
