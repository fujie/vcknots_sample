import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/src/**/*.{test,prop.test}.{ts,tsx}', 'packages/*/server/**/*.{test,prop.test}.{ts,tsx}', 'packages/*/client/src/**/*.{test,prop.test}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.{ts,tsx}', 'packages/*/server/**/*.{ts,tsx}', 'packages/*/client/src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.prop.test.{ts,tsx}', '**/index.ts'],
    },
  },
});
