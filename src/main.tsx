import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './styles/fonts.css';
import './styles/index.css';

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
  addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // no offline cache (private mode, blocked): the game still works online
    });
  });
}
