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
const variantRow = $('#variant-row');

// Top-level id for a layer (a variant's parent).
const groupOf = (id) => layerDef(id)?.variantOf ?? id;
const variantsOf = (group) => LAYERS.filter((l) => l.id === group || l.variantOf === group);

let imageryLayerId = DEFAULT_IMAGERY_LAYER_ID;

function renderSwitcher() {
  switcher.innerHTML = LAYERS.filter((l) => !l.variantOf).map(
    (l) => `<button type="button" role="radio" class="seg" data-layer="${esc(l.id)}"
        aria-checked="${l.id === groupOf(imageryLayerId)}" ${l.disabled ? 'aria-disabled="true"' : ''}
        title="${esc(l.disabled ? l.disabledReason : l.label)}">${esc(l.label)}</button>`,
  ).join('');
}

function renderInfo(id) {
  const def = layerDef(id);
  for (const b of switcher.querySelectorAll('.seg')) b.setAttribute('aria-checked', String(b.dataset.layer === groupOf(id)));
  const variants = variantsOf(groupOf(id));
  variantRow.hidden = variants.length < 2;
  variantRow.innerHTML = variants
    .map((v) => `<button type="button" role="radio" class="seg" data-variant="${esc(v.id)}" aria-checked="${v.id === id}">${esc(v.variantLabel ?? v.label)}</button>`)
    .join('');
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
    if (!b) return;
    // Re-selecting a group keeps its current variant.
    const keep = groupOf(imageryLayerId) === b.dataset.layer ? imageryLayerId : b.dataset.layer;
    choose(keep);
  });
  variantRow.addEventListener('click', (e) => {
    const b = e.target.closest('[data-variant]');
    if (b) choose(b.dataset.variant);
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
