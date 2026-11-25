import { execSync } from 'node:child_process';
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
    // after Vite has emitted index.html, so the page's own content is part of the version
    enforce: 'post',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle)
        .filter((f) => !f.endsWith('.map') && !f.endsWith('.woff') && f !== 'sw.js')
        .sort();
      const precache = ['./', ...files.map((f) => `./${f}`)];
      // version = the files' contents, not just their names (index.html keeps its name across deploys)
      const h = createHash('sha256').update(precache.join('|'));
      for (const f of files) {
        const item = bundle[f];
        if (item) h.update(item.type === 'chunk' ? item.code : item.source);
      }
      const version = h.digest('hex').slice(0, 12);
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
  // take over as soon as this version is cached: the next reload shows it (no "close every tab first")
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    // keep the version just before this one too: a page still open on it can finish loading its pieces
    caches.keys()
      .then((keys) => keys.filter((k) => k.startsWith('numberisland-') && k !== CACHE))
      .then((old) => Promise.all(old.slice(0, -1).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // the page itself: this version's copy (it matches the files below); the network only if it is missing
  const nav = req.mode === 'navigate';
  const key = nav ? new URL('./', self.registration.scope).href : req;
  // the page comes from THIS version's cache (an older cache still kept would hold the old page);
  // hashed files are unique per version, so any cache may answer them
  const look = nav ? caches.open(CACHE).then((c) => c.match(key, { ignoreSearch: true })) : caches.match(key);
  event.respondWith(
    look.then(
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

/** Which build a device is running (settings sheet): commit + build date. Vercel gives the commit. */
function buildId(): string {
  let sha = process.env.VERCEL_GIT_COMMIT_SHA ?? '';
  if (!sha) {
    try {
      sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
    } catch {
      sha = 'dev';
    }
  }
  return `${sha.slice(0, 7)} · ${new Date().toISOString().slice(0, 10)}`;
}

export default defineConfig({
  define: { __APP_BUILD__: JSON.stringify(buildId()) },
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
