import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Match live site's import map: three/addons/* → examples/jsm/*
      'three/addons': path.resolve(__dirname, 'node_modules/three/examples/jsm'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8080',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Keep absolute CDN URL dynamic imports as-is (Chart.js)
    target: 'es2022',
  },
});
