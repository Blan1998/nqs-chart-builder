import { defineConfig } from 'vitest/config';

// Kiểm thử phần vẽ biểu đồ và xử lý dữ liệu (chạy bằng: npx vitest run, hoặc npm test)
export default defineConfig({
  test: {
    include: ['tests/*.test.js'],
    environment: 'node',
  },
});
