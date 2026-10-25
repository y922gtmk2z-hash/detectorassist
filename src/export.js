// CSV and GPX export of finds and search tracks. Pure functions, no DOM.

const CSV_COLUMNS = [
  ['date', 'Date'],
  ['title', 'Find'],
  ['category', 'Category'],
  ['period', 'Period'],
  ['depthCm', 'Depth (cm)'],
  ['gridRef', 'OS grid ref'],
  ['lat', 'Latitude'],
  ['lng', 'Longitude'],
  ['place', 'Place'],
  ['pasRecorded', 'Recorded with PAS'],
  ['pasRef', 'PAS ref'],
  ['notes', 'Notes'],
];

function csvCell(value) {
  let s = value == null ? '' : String(value);
  if (typeof value === 'boolean') s = value ? 'Yes' : 'No';
  // Stop spreadsheets treating text as a formula.
  if (/^[=+\-@\t\r]/.test(s) && typeof value === 'string') s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function findsToCsv(finds) {
  const rows = [CSV_COLUMNS.map(([, h]) => h)];
  for (const f of finds) rows.push(CSV_COLUMNS.map(([k]) => f[k]));
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

function xml(s) {
  return String(s ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
}

export function findsToGpx(finds) {
  const wpts = finds.map((f) => {
    const desc = [f.category, f.period, f.depthCm ? `${f.depthCm} cm deep` : '', f.gridRef, f.notes]
      .filter(Boolean)
      .join(' · ');
    const time = f.date ? `\n    <time>${xml(f.date)}T12:00:00Z</time>` : '';
    return `  <wpt lat="${f.lat.toFixed(6)}" lon="${f.lng.toFixed(6)}">${time}
    <name>${xml(f.title)}</name>
    <desc>${xml(desc)}</desc>
  </wpt>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Detectorist Map" xmlns="http://www.topografix.com/GPX/1/1">
${wpts.join('\n')}
</gpx>
`;
}

/** One search track as a GPX <trk>. Points are [lat, lng, unixSeconds]. */
export function trackToGpx(track) {
  const pts = track.points
    .map(
      ([lat, lng, t]) =>
        `      <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}"><time>${new Date(t * 1000).toISOString()}</time></trkpt>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Detectorist Map" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${xml(track.name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}
