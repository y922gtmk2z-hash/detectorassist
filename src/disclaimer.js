// First-run disclaimer. Shown once per device; reopenable from Spots.
import { $ } from './ui.js';

const KEY = 'detectorassist.disclaimer.v1';
const dialog = $('#disclaimer');

function seen() {
  try {
    return localStorage.getItem(KEY) === 'yes';
  } catch {
    return false;
  }
}

export function initDisclaimer() {
  // Must be acknowledged with the button, not dismissed with Escape.
  dialog.addEventListener('cancel', (e) => e.preventDefault());
  dialog.addEventListener('close', () => {
    try {
      localStorage.setItem(KEY, 'yes');
    } catch {
      /* shown again next time; harmless */
    }
  });
  for (const b of document.querySelectorAll('[data-act="disclaimer"]')) b.addEventListener('click', () => dialog.showModal());
  if (!seen()) dialog.showModal();
}
