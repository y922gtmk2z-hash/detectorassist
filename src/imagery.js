// Imagery viewer: layer switcher, blend slider, "Look for" tip, source line.
import { BLEND_LAYER_ID, DEFAULT_IMAGERY_LAYER_ID, LAYERS, MAP_LAYER_ID } from './config.js';
import { getBaseLayerId, getMap, getSelected, goTo, layerDef, onBaseLayerChange, setBaseLayer, setBlend } from './map.js';
import { onScreenChange, showScreen } from './router.js';
import { $, esc, toast } from './ui.js';

const switcher = $('#layer-switcher');
const blendRow = $('#blend-row');
const blendInput = $('#blend');
const blendValue = $('#blend-value');
const tip = $('#imagery-tip');
const source = $('#imagery-source');
const zoomHint = $('#zoom-hint');

let imageryLayerId = DEFAULT_IMAGERY_LAYER_ID;

function renderSwitcher() {
  switcher.innerHTML = LAYERS.map(
    (l) => `<button type="button" role="radio" class="seg" data-layer="${esc(l.id)}"
        aria-checked="${l.id === imageryLayerId}" ${l.disabled ? 'aria-disabled="true"' : ''}
        title="${esc(l.disabled ? l.disabledReason : l.label)}">${esc(l.label)}</button>`,
  ).join('');
}

function renderInfo(id) {
  const def = layerDef(id);
  for (const b of switcher.querySelectorAll('.seg')) b.setAttribute('aria-checked', String(b.dataset.layer === id));
  blendRow.hidden = id === BLEND_LAYER_ID;
  tip.innerHTML = `<strong>Look for:</strong> ${esc(def.tip)}`;
  source.textContent = `Source: ${def.source}`;
  updateZoomHint();
}

function updateZoomHint() {
  const def = layerDef(getBaseLayerId());
  const min = def?.options?.minZoom;
  zoomHint.hidden = !(document.body.dataset.screen === 'imagery' && min && getMap().getZoom() < min);
}

async function choose(id) {
  const def = layerDef(id);
  if (def.disabled) return toast(def.disabledReason);
  imageryLayerId = id;
  try {
    await setBaseLayer(id);
  } catch (err) {
    toast(err.message);
    imageryLayerId = getBaseLayerId();
    renderInfo(imageryLayerId);
  }
}

export function initImagery() {
  const blendLabel = layerDef(BLEND_LAYER_ID).label.toLowerCase();
  $('#blend-label').textContent = `Blend with ${blendLabel}`;
  renderSwitcher();

  switcher.addEventListener('click', (e) => {
    const b = e.target.closest('.seg');
    if (b) choose(b.dataset.layer);
  });
  blendInput.addEventListener('input', () => {
    blendValue.textContent = `${blendInput.value}%`;
    setBlend(Number(blendInput.value));
  });
  $('#imagery-back').addEventListener('click', () => showScreen('map'));
  $('#zoom-in').addEventListener('click', () => getMap().zoomIn());
  $('#zoom-out').addEventListener('click', () => getMap().zoomOut());
  zoomHint.addEventListener('click', () => getMap().setZoom(layerDef(getBaseLayerId()).options.minZoom));

  onBaseLayerChange((id) => {
    if (document.body.dataset.screen === 'imagery') renderInfo(id);
  });
  getMap().on('zoomend', updateZoomHint);

  onScreenChange((screen) => {
    if (screen === 'imagery') {
      const s = getSelected();
      if (s) goTo(s.lat, s.lng, 16);
      renderInfo(imageryLayerId);
      choose(imageryLayerId);
    } else if (screen === 'map') {
      setBaseLayer(MAP_LAYER_ID);
    }
    updateZoomHint();
  });
}
