import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // 全局替换模块加载期就建 TCP 连接的 lib/redis，见 src/test-setup.ts
    setupFiles: ['src/test-setup.ts'],
    // threads 比默认的 forks 略快（Windows 上进程 spawn 明显贵于线程），
    // 22 核实测 forks 108.7s / threads 101.5s，全部用例行为一致。
    pool: 'threads',
    // 每个 worker 都要独立执行整套 app（300+ 路由文件）的模块图，worker 越多重复越多，
    // 到某个点后收益反转：16 核实测默认档（核数-1=15）transform 累计 1432s、墙钟 307s，
    // 且 app.contract（装配 app + 1800 次进程内请求）撞破超时；
    // 限到 8 后 transform 231s、墙钟 121s 且全绿（12 已开始劣化并偶发超时）。
    // 这是上限而非目标值：CI 的 4 核 runner 本就只起 3 个 worker，不受影响。
    maxWorkers: 8,
    // 发布流程四路并行（lint / test / build / docs）抢满 CPU 时，秒级用例会被
    // 放大 10-40 倍：exceljs 渲染这类 ~0.5s 的用例实测撞破过 vitest 默认 5s
    // （并非卡死，独占跑毫秒级通过）。与 web 侧同一口径放宽到 15s；
    // 真死锁仍会在 15s 内快速失败。app.contract 的装配另有专属 480s 超时。
    testTimeout: 15_000,
    hookTimeout: 15_000,
    // 不要用 isolate: false 换速度：本套测试重度依赖 per-file vi.mock，关闭隔离会
    // 产生跨文件模块状态泄漏（单跑全绿、混跑必挂），且文件→worker 的分配随时序
    // 变化，泄漏组合不可复现、白名单不可维护。
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/db/seed.ts', 'src/db/migrate.ts'],
    },
  },
});
