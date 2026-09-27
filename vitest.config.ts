import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/test/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['server/test/global-setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 120_000,
  },
});
