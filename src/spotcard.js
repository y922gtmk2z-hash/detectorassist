// The selected-spot card shown under the map on the Map screen.
import { LAYERS } from './config.js';
import { formatLatLng, latLngToGridRef } from './gridref.js';
import { clearSelection, getSelected, onSelect, refreshSize } from './map.js';
import { showScreen } from './router.js';
import { $, esc } from './ui.js';

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
  const layers = LAYERS.filter((l) => !l.disabled && !l.variantOf).map((l) => `<li>${esc(l.label)}</li>`).join('');
  card.innerHTML = `
    <div class="card-head">
      <div>
        <h2 class="card-title">${esc(s.name || 'Dropped pin')}</h2>
        <p class="card-grid mono">${esc(grid)}</p>
        <p class="card-ll mono">${esc(formatLatLng(s.lat, s.lng))}</p>
      </div>
      <div class="card-head-btns">
        <button type="button" class="icon-btn flat" data-act="share" aria-label="Share this spot">
          <svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/></svg>
        </button>
        <button type="button" class="icon-btn flat" data-act="close" aria-label="Clear pin">
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </div>
    </div>
    <div class="card-extras"></div>
    <div class="card-layers"><span>Layers</span><ul class="chips">${layers}</ul></div>
    <div class="card-actions">
      <button type="button" class="btn" data-act="save">Save spot</button>
      <button type="button" class="btn" data-act="log-find">Log find</button>
      <button type="button" class="btn btn-primary" data-act="imagery">Imagery</button>
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
  if (act === 'share') card.dispatchEvent(new CustomEvent('share-spot', { bubbles: true }));
  if (act === 'log-find') card.dispatchEvent(new CustomEvent('log-find', { bubbles: true }));
});

onSelect(renderCard);
