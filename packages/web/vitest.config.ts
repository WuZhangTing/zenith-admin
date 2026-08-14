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
    // jsdom 声明在 workspace 根 package.json：vitest 被提升到根 node_modules，
    // 它是从自身目录发起 import('jsdom') 的，向上查找进不到 packages/web/node_modules。
    // 若在本包重复声明，两处版本一旦不一致就无法去重，web 那份会被嵌套且永远加载不到。
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    css: true,
    // jsdom 里渲染 Semi Design 组件（尤其 SideSheet / Modal 这类带动画的浮层）
    // 叠加 userEvent 的逐事件派发，单个交互用例普遍要 2-3s；机器负载高时轻易翻倍。
    // vitest 默认 5s 会让这些用例随机报超时（并非真的卡死），故整体放宽。
    testTimeout: 15_000,
    hookTimeout: 15_000,
    // 与 server 同理压住 worker 数：不设上限时 16 核默认起满 jsdom fork，与 build
    // （rolldown 全量转译）并行时会把 CPU 打满，导致 worker 启动超时。
    // CI 的 4 核 runner 本就只起 3 个 worker，不受影响。
    maxWorkers: 8,
  },
});
