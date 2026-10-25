// Live GPS position: a dot with an accuracy circle. Several features can
// hold the GPS on at once (the locate button, track recording); it stops
// when the last one lets go.
import L from 'leaflet';
import { getMap, goTo, selectPoint } from './map.js';
import { toast } from './ui.js';

let watchId = null;
let last = null;
let dot = null;
let ring = null;
let follow = false;
let pinNextFix = false;
const holders = new Set();
const listeners = new Set();

export function onPosition(fn) {
  listeners.add(fn);
}

export function getPosition() {
  return last;
}

function syncButtons() {
  for (const b of document.querySelectorAll('[data-act="locate"]')) {
    b.setAttribute('aria-pressed', String(holders.has('user')));
  }
}

function onFix(pos) {
  const { latitude: lat, longitude: lng, accuracy } = pos.coords;
  last = { lat, lng, accuracy, time: pos.timestamp };
  const map = getMap();
  if (!dot) {
    ring = L.circle([lat, lng], { radius: accuracy, color: '#1a73e8', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(map);
    dot = L.circleMarker([lat, lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1, interactive: false }).addTo(map);
  } else {
    dot.setLatLng([lat, lng]);
    ring.setLatLng([lat, lng]).setRadius(accuracy);
  }
  if (pinNextFix) {
    pinNextFix = false;
    selectPoint(lat, lng, 'My location');
    goTo(lat, lng, 17);
  } else if (follow) {
    map.panTo([lat, lng], { animate: true });
  }
  for (const fn of listeners) fn(last);
}

function onError(err) {
  if (err.code === err.PERMISSION_DENIED) {
    toast('Location permission is off. Turn it on for this site to use GPS.');
    for (const h of [...holders]) release(h);
  } else if (!last) {
    toast('Waiting for a GPS fix…');
  }
}

export function hold(who) {
  if (!navigator.geolocation) {
    toast('Location is not available on this device.');
    return false;
  }
  holders.add(who);
  if (watchId === null) {
    watchId = navigator.geolocation.watchPosition(onFix, onError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 30000,
    });
  }
  syncButtons();
  return true;
}

export function release(who) {
  holders.delete(who);
  syncButtons();
  if (holders.size || watchId === null) return;
  navigator.geolocation.clearWatch(watchId);
  watchId = null;
  follow = false;
  dot?.remove();
  ring?.remove();
  dot = ring = null;
  last = null;
}

/** Locate button / "Use my location": start live GPS, drop a pin at the first fix, follow. */
export function locate() {
  if (!hold('user')) return;
  follow = true;
  if (last) {
    selectPoint(last.lat, last.lng, 'My location');
    goTo(last.lat, last.lng, 17);
  } else {
    pinNextFix = true;
    toast('Finding your location…');
  }
}

export function initLocation() {
  for (const b of document.querySelectorAll('[data-act="locate"]')) {
    b.addEventListener('click', () => (holders.has('user') ? release('user') : locate()));
  }
  // Stop following once the user pans the map themselves.
  getMap().on('dragstart', () => (follow = false));
}
