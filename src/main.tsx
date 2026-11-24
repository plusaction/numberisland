import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { installPressFeel } from './ui/press';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './styles/fonts.css';
import './styles/index.css';

// every key goes down the instant it is touched (sound + buzz), springs back on release
installPressFeel();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// offline cache (production builds only; `?nosw` turns it off for debugging)
if (
  import.meta.env.PROD &&
  'serviceWorker' in navigator &&
  !new URLSearchParams(location.search).has('nosw')
) {
  // a new version took over (deployed while this page was open): reload into it — at once on the menus,
  // or as soon as the child is back on the island (never in the middle of a round)
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // first install: this page is already the newest
    type St = { getState(): { screen: string }; subscribe(f: (s: { screen: string }) => void): () => void };
    const store = (globalThis as { __store?: St }).__store;
    const busy = (screen: string) => screen === 'stage' || screen === 'result';
    if (!store || !busy(store.getState().screen)) {
      location.reload();
      return;
    }
    const stop = store.subscribe((st) => {
      if (busy(st.screen)) return;
      stop();
      location.reload();
    });
  });
  addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // no offline cache (private mode, blocked): the game still works online
    });
  });
}
