// Small DOM helpers.
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function $(sel, root = document) {
  return root.querySelector(sel);
}

let toastTimer;
export function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3000);
}

/** Save text as a file via a temporary link. */
export function download(text, type, filename) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
