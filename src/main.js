import '@fontsource/instrument-sans/latin-400.css';
import '@fontsource/instrument-sans/latin-600.css';
import '@fontsource/instrument-sans/latin-700.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import './styles.css';

import { initDisclaimer } from './disclaimer.js';
import { initFinds } from './finds.js';
import { initHeritage } from './heritage.js';
import { initImagery } from './imagery.js';
import { initLocation } from './location.js';
import { initMap, refreshSize } from './map.js';
import { initTabs, onScreenChange, showScreen } from './router.js';
import { initSearch } from './search.js';
import { initSpots } from './spots.js';

initTabs();
initMap();
onScreenChange(refreshSize);
initLocation();
initSearch();
initImagery();
initSpots();
initFinds();
initHeritage();
showScreen('map');
initDisclaimer();
