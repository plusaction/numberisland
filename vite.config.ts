import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
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
