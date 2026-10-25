// Personal finds log, stored on this device only. Records live in
// localStorage; photos in IndexedDB (photos.js). Export to CSV/GPX.
import L from 'leaflet';
import { findsToCsv, findsToGpx } from './finds-export.js';
import { latLngToGridRef } from './gridref.js';
import { getMap, getSelected, goTo, selectPoint } from './map.js';
import { deletePhoto, getPhoto, putPhoto, requestPersistence, shrinkPhoto } from './photos.js';
import { onScreenChange, showScreen } from './router.js';
import { $, esc, toast } from './ui.js';

const KEY = 'detectorassist.finds.v1';

export const CATEGORIES = ['Coin', 'Token', 'Buckle', 'Button', 'Brooch', 'Jewellery', 'Weight or seal', 'Tool or blade', 'Pottery', 'Other'];
export const PERIODS = ['Unknown', 'Prehistoric', 'Roman', 'Early medieval', 'Medieval', 'Post-medieval', 'Modern'];

let filter = 'all';
let editing = null; // find being edited, or null for a new one
let pendingPhoto; // undefined = unchanged, Blob = new photo, null = removed
const objectUrls = [];

export function loadFinds() {
  try {
    const finds = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(finds) ? finds : [];
  } catch {
    return [];
  }
}

function storeFinds(finds) {
  try {
    localStorage.setItem(KEY, JSON.stringify(finds));
    renderMarkers();
    return true;
  } catch {
    toast('Could not save: storage on this device is full or blocked.');
    return false;
  }
}

function newId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function track(url) {
  objectUrls.push(url);
  return url;
}

function releaseUrls() {
  while (objectUrls.length) URL.revokeObjectURL(objectUrls.pop());
}

// --- Log / edit dialog ------------------------------------------------------

const dialog = $('#find-dialog');
const form = $('#find-form');
const preview = $('#find-photo-preview');

function fillSelect(select, options) {
  select.innerHTML = options.map((o) => `<option>${esc(o)}</option>`).join('');
}

function showPreview(blob) {
  preview.innerHTML = '';
  $('#find-photo-remove').hidden = !blob;
  if (!blob) return;
  const img = document.createElement('img');
  img.alt = 'Find photo';
  img.src = URL.createObjectURL(blob);
  img.onload = () => URL.revokeObjectURL(img.src);
  preview.append(img);
}

async function openFindDialog(find = null) {
  editing = find;
  pendingPhoto = undefined;
  form.reset();
  const where = find ?? getSelected();
  if (!where) return toast('Tap the map to drop a pin where you found it.');
  $('#find-title-heading').textContent = find ? 'Edit find' : 'Log find';
  $('#find-grid').textContent = find?.gridRef ?? latLngToGridRef(where.lat, where.lng) ?? '';
  $('#find-delete').hidden = !find;
  const f = form.elements;
  f.title.value = find?.title ?? '';
  f.date.value = find?.date ?? today();
  f.category.value = find?.category ?? CATEGORIES[0];
  f.period.value = find?.period ?? PERIODS[0];
  f.depthCm.value = find?.depthCm ?? '';
  f.notes.value = find?.notes ?? '';
  f.pasRecorded.checked = !!find?.pasRecorded;
  f.pasRef.value = find?.pasRef ?? '';
  showPreview(null);
  dialog.showModal();
  if (find?.hasPhoto) {
    try {
      showPreview(await getPhoto(find.id));
    } catch {
      /* photo store unavailable; the record still opens */
    }
  }
}

async function saveFind() {
  const f = form.elements;
  const where = editing ?? getSelected();
  if (!where) return;
  const finds = loadFinds();
  const id = editing?.id ?? newId();
  const hasPhoto = pendingPhoto === undefined ? !!editing?.hasPhoto : !!pendingPhoto;
  try {
    if (pendingPhoto) {
      await putPhoto(id, pendingPhoto);
      requestPersistence();
    } else if (pendingPhoto === null && editing?.hasPhoto) {
      await deletePhoto(id);
    }
  } catch {
    toast('Could not store the photo on this device. The find was saved without it.');
  }
  const record = {
    id,
    title: f.title.value.trim() || 'Untitled find',
    date: f.date.value,
    category: f.category.value,
    period: f.period.value,
    depthCm: f.depthCm.value === '' ? null : Number(f.depthCm.value),
    notes: f.notes.value.trim(),
    pasRecorded: f.pasRecorded.checked,
    pasRef: f.pasRef.value.trim(),
    lat: where.lat,
    lng: where.lng,
    gridRef: editing?.gridRef ?? latLngToGridRef(where.lat, where.lng),
    place: editing?.place ?? (where.name && where.name !== 'My location' ? where.name : ''),
    hasPhoto,
    createdAt: editing?.createdAt ?? new Date().toISOString(),
  };
  const next = editing ? finds.map((x) => (x.id === id ? record : x)) : [record, ...finds];
  if (storeFinds(next)) toast(editing ? 'Find updated.' : 'Find logged on this device.');
  renderList();
}

async function removeFind(find) {
  if (!confirm(`Delete “${find.title}” from this device?`)) return;
  storeFinds(loadFinds().filter((x) => x.id !== find.id));
  if (find.hasPhoto) deletePhoto(find.id).catch(() => {});
  dialog.close();
  renderList();
}

// --- List screen ------------------------------------------------------------

const list = $('#finds-list');

async function renderList() {
  releaseUrls();
  const all = loadFinds();
  const finds = all.filter((f) => filter === 'all' || !f.pasRecorded);
  for (const b of document.querySelectorAll('.finds-filter')) b.setAttribute('aria-pressed', String(b.dataset.filter === filter));
  $('#finds-count').textContent = all.length ? `${all.length} find${all.length === 1 ? '' : 's'}` : '';
  $('#finds-export').hidden = !all.length;
  if (!finds.length) {
    list.innerHTML = `<li class="spots-empty">${
      filter === 'all' ? 'No finds logged yet. Drop a pin where you found it and tap “Log find”.' : 'Every find is marked as recorded with the PAS.'
    }</li>`;
    return;
  }
  list.innerHTML = finds
    .map(
      (f) => `<li class="spot find" data-id="${esc(f.id)}">
        <button type="button" class="spot-main" data-act="edit">
          <span class="thumb find-thumb" data-photo="${f.hasPhoto ? esc(f.id) : ''}" aria-hidden="true">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/></svg>
          </span>
          <span class="spot-text">
            <span class="spot-name">${esc(f.title)}</span>
            <span class="spot-layer">${esc([formatDate(f.date), f.category, f.period !== 'Unknown' ? f.period : ''].filter(Boolean).join(' · '))}</span>
            <span class="spot-grid mono">${esc(f.gridRef ?? '')}</span>
          </span>
        </button>
        <div class="spot-actions">
          <span class="tag ${f.pasRecorded ? 'tag-granted' : 'tag-ask'}">${f.pasRecorded ? 'Recorded with PAS' : 'Not yet recorded'}</span>
          <button type="button" class="icon-btn flat" data-act="show" aria-label="Show ${esc(f.title)} on the map">
            <svg viewBox="0 0 24 24"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14"/></svg>
          </button>
        </div>
      </li>`,
    )
    .join('');
  // Fill in photo thumbnails after the list is on screen.
  for (const el of list.querySelectorAll('[data-photo]:not([data-photo=""])')) {
    try {
      const blob = await getPhoto(el.dataset.photo);
      if (!blob || !el.isConnected) continue;
      el.innerHTML = `<img src="${track(URL.createObjectURL(blob))}" alt="" />`;
    } catch {
      /* keep the icon */
    }
  }
}

function download(text, type, filename) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- Map markers --------------------------------------------------------------

let markers;

function renderMarkers() {
  markers.clearLayers();
  for (const f of loadFinds()) {
    L.circleMarker([f.lat, f.lng], {
      radius: 7,
      color: '#12211A',
      weight: 2,
      fillColor: '#F2B632',
      fillOpacity: 1,
      bubblingMouseEvents: false, // tapping a find should not move the pin
    })
      .bindTooltip(esc(f.title), { direction: 'top', offset: [0, -6] })
      .on('click', () => openFindDialog(f))
      .addTo(markers);
  }
}

// --- Wiring -------------------------------------------------------------------

export function initFinds() {
  fillSelect(form.elements.category, CATEGORIES);
  fillSelect(form.elements.period, PERIODS);

  markers = L.layerGroup().addTo(getMap());
  renderMarkers();

  document.addEventListener('log-find', () => openFindDialog());

  form.addEventListener('submit', (e) => {
    if (e.submitter?.value !== 'save') return;
    saveFind();
  });
  $('#find-delete').addEventListener('click', () => editing && removeFind(editing));
  $('#find-photo').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      pendingPhoto = await shrinkPhoto(file);
      showPreview(pendingPhoto);
    } catch {
      toast('Could not read that photo.');
    }
    e.target.value = '';
  });
  $('#find-photo-remove').addEventListener('click', () => {
    pendingPhoto = null;
    showPreview(null);
  });

  list.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    const id = e.target.closest('.find')?.dataset.id;
    const find = loadFinds().find((f) => f.id === id);
    if (!find) return;
    if (act === 'edit') openFindDialog(find);
    if (act === 'show') {
      selectPoint(find.lat, find.lng, find.title);
      showScreen('map');
      goTo(find.lat, find.lng, 17);
    }
  });
  for (const b of document.querySelectorAll('.finds-filter')) {
    b.addEventListener('click', () => {
      filter = b.dataset.filter;
      renderList();
    });
  }
  $('#export-csv').addEventListener('click', () => download(findsToCsv(loadFinds()), 'text/csv', `finds-${today()}.csv`));
  $('#export-gpx').addEventListener('click', () => download(findsToGpx(loadFinds()), 'application/gpx+xml', `finds-${today()}.gpx`));

  onScreenChange((screen) => {
    if (screen === 'finds') renderList();
    else releaseUrls();
  });
}
