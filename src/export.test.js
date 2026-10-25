import { describe, expect, it } from 'vitest';
import { findsToCsv, findsToGpx, trackToGpx } from './export.js';

const find = {
  date: '2026-10-25',
  title: 'Hammered penny, "Edward I"',
  category: 'Coin',
  period: 'Medieval',
  depthCm: 12,
  gridRef: 'SU 1234 5678',
  lat: 51.123456789,
  lng: -1.5,
  place: 'Top field',
  pasRecorded: false,
  pasRef: '',
  notes: 'Near gate,\nwest side',
};

describe('findsToCsv', () => {
  it('writes a header and quotes awkward cells', () => {
    const [header, row] = findsToCsv([find]).split('\r\n');
    expect(header).toBe('Date,Find,Category,Period,Depth (cm),OS grid ref,Latitude,Longitude,Place,Recorded with PAS,PAS ref,Notes');
    expect(row).toContain('"Hammered penny, ""Edward I"""');
    expect(row).toContain(',No,');
    expect(findsToCsv([find])).toContain('"Near gate,\nwest side"');
  });

  it('neutralises formula injection but keeps negative numbers', () => {
    const csv = findsToCsv([{ ...find, title: '=HYPERLINK("x")', notes: '' }]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain(',-1.5,');
  });
});

describe('findsToGpx', () => {
  it('writes escaped waypoints', () => {
    const gpx = findsToGpx([{ ...find, title: 'Buckle <&>' }]);
    expect(gpx).toContain('<wpt lat="51.123457" lon="-1.500000">');
    expect(gpx).toContain('<name>Buckle &lt;&amp;&gt;</name>');
    expect(gpx).toContain('<time>2026-10-25T12:00:00Z</time>');
    expect(gpx).toContain('Coin · Medieval · 12 cm deep · SU 1234 5678');
  });
});

describe('trackToGpx', () => {
  it('writes a timed track segment', () => {
    const gpx = trackToGpx({ name: 'Top field & lane', points: [[51.1, -1.2, 1761400000], [51.10001, -1.20002, 1761400005]] });
    expect(gpx).toContain('<name>Top field &amp; lane</name>');
    expect(gpx).toContain('<trkpt lat="51.100000" lon="-1.200000"><time>2025-10-25T13:46:40.000Z</time></trkpt>');
    expect(gpx.match(/<trkpt /g)).toHaveLength(2);
  });
});
