import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@shared': path.resolve(__dirname, 'shared') },
  },
  test: {
    // jsdom so the React tests have a real DOM, and node APIs stay available.
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // The ingest tests read real OCR output; give them room.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',
  },
});
