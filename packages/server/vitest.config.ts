import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // 每个 worker 都要独立转译整套 app（267 个路由文件），worker 越多重复转译越多，
    // 到某个点后收益反转：16 核实测默认档（核数-1=15）transform 累计 1432s、墙钟 307s，
    // 且 app.contract（装配 app + 1800 次进程内请求）与 app.routes 双双撞破超时；
    // 限到 8 后 transform 231s、墙钟 121s 且全绿（12 已开始劣化并偶发超时）。
    // 这是上限而非目标值：CI 的 4 核 runner 本就只起 3 个 worker，不受影响。
    maxWorkers: 8,
    // 不要用 isolate: false 换速度：本套测试重度依赖 per-file vi.mock，关闭隔离会
    // 产生跨文件模块状态泄漏（单跑全绿、混跑必挂），且 forks 池的文件→worker 分配
    // 随时序变化，泄漏组合不可复现、白名单不可维护。
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/db/seed.ts', 'src/db/migrate.ts'],
    },
  },
});
