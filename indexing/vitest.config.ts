import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 120000, // 2 minutes for integration tests
    hookTimeout: 60000,  // 1 minute for setup/teardown
  },
});