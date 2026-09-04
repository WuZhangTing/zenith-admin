import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // 类型断言（expectTypeOf）与运行时断言同文件，随 tsc 一并检查
    typecheck: { enabled: true, include: ['src/**/*.test.ts'] },
  },
});
