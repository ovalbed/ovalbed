import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:8787';

/**
 * Where the built site is served from.
 *
 * Left as '/' by default so `npm run dev` and the local backend (which serves
 * dist from the filesystem root) behave exactly as before. The GitHub Pages
 * workflow builds with DEPLOY_BASE=/Project/, because that project is served
 * from a sub-path and every asset URL has to include it.
 */
const DEPLOY_BASE = process.env.DEPLOY_BASE ?? '/';

export default defineConfig({
  root: 'frontend',
  base: DEPLOY_BASE,
  // Output the deployable static site at the repo root, outside the PDFs and
  // the extracted data, so nothing large or private can leak into the build.
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    sourcemap: false,
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  server: {
    port: 5173,
    fs: { allow: [path.resolve(__dirname)] },
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
  preview: {
    port: 4173,
    proxy: { '/api': { target: API_TARGET, changeOrigin: true } },
  },
});
