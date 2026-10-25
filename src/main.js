import '@fontsource/instrument-sans/latin-400.css';
import '@fontsource/instrument-sans/latin-600.css';
import '@fontsource/instrument-sans/latin-700.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import './styles.css';

import { initImagery } from './imagery.js';
import { initMap, refreshSize } from './map.js';
import { initTabs, onScreenChange, showScreen } from './router.js';
import { initSearch } from './search.js';
import { initSpots } from './spots.js';
import { initLocate } from './spotcard.js';

initTabs();
initMap();
initLocate();
initSearch();
initImagery();
initSpots();
onScreenChange(refreshSize);
showScreen('map');
