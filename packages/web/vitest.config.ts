import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    css: true,
    // jsdom 里渲染 Semi Design 组件（尤其 SideSheet / Modal 这类带动画的浮层）
    // 叠加 userEvent 的逐事件派发，单个交互用例普遍要 2-3s；机器负载高时轻易翻倍。
    // vitest 默认 5s 会让这些用例随机报超时（并非真的卡死），故整体放宽。
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
