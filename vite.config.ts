import { createHash } from 'node:crypto';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Offline cache (PWA, D52): after the build, write `sw.js` with the exact list of files this version needs.
 * The service worker keeps them on the device, so a second visit starts without the network; a new deploy
 * is fetched in the background and takes over on the next visit (never in the middle of a round).
 */
function offlineCache(): Plugin {
  return {
    name: 'numberisland-offline-cache',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle)
        .filter((f) => !f.endsWith('.map') && !f.endsWith('.woff') && f !== 'sw.js')
        .sort();
      const precache = ['./', ...files.map((f) => `./${f}`)];
      const version = createHash('sha256').update(precache.join('|')).digest('hex').slice(0, 12);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: swSource(version, precache),
      });
    },
  };
}

function swSource(version: string, precache: string[]): string {
  return `/* numberisland offline cache — generated at build time (vite.config.ts) */
const CACHE = 'numberisland-${version}';
const PRECACHE = ${JSON.stringify(precache)};
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('numberisland-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // the page itself: this version's copy (it matches the files below); the network only if it is missing
  const key = req.mode === 'navigate' ? new URL('./', self.registration.scope).href : req;
  event.respondWith(
    caches.match(key, { ignoreSearch: req.mode === 'navigate' }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
`;
}

export default defineConfig({
  base: './',
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss(), offlineCache()],
  resolve: {
    // One three.js instance: addons import 'three', we use the WebGPU build (which re-exports core).
    alias: [{ find: /^three$/, replacement: 'three/webgpu' }],
  },
  build: {
    target: 'es2023',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5173 },
});
