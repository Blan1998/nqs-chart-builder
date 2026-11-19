import { defineConfig } from 'vitest/config';

// Kiểm thử trên trình duyệt thật (Edge/Chrome): npm run test:browser
export default defineConfig({
  test: {
    include: ['tests/browser/**/*.test.js'],
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
