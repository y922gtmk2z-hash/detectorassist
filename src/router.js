// Switches between screens. "map" and "imagery" share the map section;
// the body's data-screen attribute lets CSS swap the chrome around it.
const listeners = new Set();
let current = null;

export function onScreenChange(fn) {
  listeners.add(fn);
}

export function currentScreen() {
  return current;
}

export function showScreen(name) {
  current = name;
  for (const s of document.querySelectorAll('.screen')) {
    s.hidden = !s.dataset.screen.split(' ').includes(name);
  }
  for (const t of document.querySelectorAll('.tab')) {
    if (t.dataset.tab === name) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  }
  document.body.dataset.screen = name;
  for (const fn of listeners) fn(name);
}

export function initTabs() {
  for (const t of document.querySelectorAll('.tab')) {
    t.addEventListener('click', () => showScreen(t.dataset.tab));
  }
}
