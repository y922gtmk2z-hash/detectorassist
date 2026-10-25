// Keep the URL hash in step with the pin/view so the page can be
// bookmarked, and share a spot with the device's share sheet.
import { latLngToGridRef } from './gridref.js';
import { buildLink, parseLink } from './link.js';
import { getMap, getSelected, onSelect, selectPoint } from './map.js';
import { toast } from './ui.js';

let applying = false;

function currentHash() {
  const map = getMap();
  const s = getSelected();
  if (s) return buildLink({ pin: s, zoom: map.getZoom(), name: s.name !== 'My location' ? s.name : null });
  return buildLink({ at: map.getCenter(), zoom: map.getZoom() });
}

function writeHash() {
  if (applying) return;
  const hash = currentHash();
  if (location.hash !== hash) history.replaceState(null, '', hash);
}

function apply(hash) {
  const link = parseLink(hash);
  if (!link) return false;
  applying = true;
  if (link.pin) {
    selectPoint(link.pin.lat, link.pin.lng, link.name);
    getMap().setView([link.pin.lat, link.pin.lng], link.zoom);
  } else {
    getMap().setView([link.at.lat, link.at.lng], link.zoom);
  }
  applying = false;
  return true;
}

export async function shareSpot() {
  const s = getSelected();
  if (!s) return;
  const url = `${location.origin}${location.pathname}${currentHash()}`;
  const grid = latLngToGridRef(s.lat, s.lng) ?? '';
  const title = s.name && s.name !== 'My location' ? s.name : 'Spot';
  try {
    if (navigator.share) {
      await navigator.share({ title, text: `${title} · ${grid}`, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast('Link copied.');
  } catch (err) {
    if (err?.name !== 'AbortError') toast('Could not share. Copy the address bar instead.');
  }
}

export function initShare() {
  apply(location.hash);
  window.addEventListener('hashchange', () => apply(location.hash));
  onSelect(writeHash);
  let timer;
  getMap().on('moveend', () => {
    clearTimeout(timer);
    timer = setTimeout(writeHash, 300);
  });
  document.addEventListener('share-spot', shareSpot);
}
