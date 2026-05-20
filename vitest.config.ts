import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // `server-only` is a Next.js build-time guard with no runtime module;
      // stub it so server modules can be unit-tested under vitest.
      'server-only': path.resolve(__dirname, './tests/stubs/server-only.ts'),
    },
  },
});
