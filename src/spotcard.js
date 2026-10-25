// The selected-spot card shown under the map on the Map screen.
import { LAYERS } from './config.js';
import { formatLatLng, latLngToGridRef } from './gridref.js';
import { clearSelection, getSelected, goTo, onSelect, refreshSize, selectPoint } from './map.js';
import { showScreen } from './router.js';
import { $, esc, toast } from './ui.js';

const card = $('#spot-card');
const extras = [];

/** Other modules (heritage, spots) can add a section to the card. */
export function addCardSection(render) {
  extras.push(render);
}

export function renderCard() {
  const s = getSelected();
  card.hidden = !s;
  refreshSize();
  if (!s) return;
  const grid = latLngToGridRef(s.lat, s.lng) ?? 'Outside OS grid';
  const layers = LAYERS.filter((l) => !l.disabled).map((l) => `<li>${esc(l.label)}</li>`).join('');
  card.innerHTML = `
    <div class="card-head">
      <div>
        <h2 class="card-title">${esc(s.name || 'Dropped pin')}</h2>
        <p class="card-grid mono">${esc(grid)}</p>
        <p class="card-ll mono">${esc(formatLatLng(s.lat, s.lng))}</p>
      </div>
      <button type="button" class="icon-btn flat" data-act="close" aria-label="Clear pin">
        <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
    </div>
    <div class="card-extras"></div>
    <div class="card-layers"><span>Layers</span><ul class="chips">${layers}</ul></div>
    <div class="card-actions">
      <button type="button" class="btn" data-act="save">Save spot</button>
      <button type="button" class="btn btn-primary" data-act="imagery">View imagery</button>
    </div>`;
  const slot = card.querySelector('.card-extras');
  for (const render of extras) {
    const node = render(s);
    if (node) slot.append(node);
  }
}

card.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'close') clearSelection();
  if (act === 'imagery') showScreen('imagery');
  if (act === 'save') card.dispatchEvent(new CustomEvent('save-spot', { bubbles: true }));
});

onSelect(renderCard);

export function initLocate() {
  for (const btn of document.querySelectorAll('[data-act="locate"]')) {
    btn.addEventListener('click', locate);
  }
}

export function locate() {
  if (!navigator.geolocation) return toast('Location is not available on this device.');
  toast('Finding your location…');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      selectPoint(lat, lng, 'My location');
      goTo(lat, lng, 16);
    },
    () => toast('Could not get your location. Check location permission.'),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
  );
}
