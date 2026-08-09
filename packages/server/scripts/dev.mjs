// 开发启动脚本：剥离 VS Code Auto Attach 注入的调试器(inspector)环境变量后再启动。
//
// 原因：Windows 下 node-pty（Web 终端 /api/ws/terminal）在 Node Inspector 附加时，
// pty.spawn() 会同步死锁、冻结整个后端事件循环（见 microsoft/node-pty#640）。
// VS Code Auto Attach（smart 模式）会给 `npm run dev` 启动的项目脚本注入 inspector，
// 从而触发该死锁，并导致启动期每个 tsx 进程退出都有数秒 "Waiting for the debugger
// to disconnect" 延迟。
//
// `npm run dev` 是运行模式，本不应被调试器附加；需要调试后端时请使用 VS Code 的
// "Debug: Server" 启动配置（此时 Web 终端会被 ws-terminal.ts 的兜底检测自动禁用并提示）。
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const env = { ...process.env };
// 持久化 V8 编译缓存（Node ≥22.1；旧版本静默忽略）。migrate/seed/server 三个 tsx 进程
// 及 tsx watch 的每次重启共享此缓存，显著缓解启动期模块图加载（ESM 解析 + 编译）耗时。
// Node 按源码内容哈希校验，代码变更后条目自动失效，不会吃到过期缓存。
env.NODE_COMPILE_CACHE ??= path.join(serverRoot, '.cache', 'node-compile-cache');
// node-pty 与 Node Inspector 的死锁是 Windows ConPTY 特有问题（microsoft/node-pty#640）；
// 仅在 Windows 剥离 auto-attach 注入的调试器变量（NODE_OPTIONS 含 --require .../bootloader.js）。
// Linux/macOS 使用 forkpty，不受该死锁影响，保留 `npm run dev` 的可调试性。
if (process.platform === 'win32') {
  delete env.NODE_OPTIONS;
  delete env.VSCODE_INSPECTOR_OPTIONS;
}

/** 顺序执行（相当于原来的 `&&` 链中的一步），失败则退出。 */
function runSync(command) {
  const result = spawnSync(command, { stdio: 'inherit', env, shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// 1) 数据库迁移  2) 种子数据
runSync('tsx src/db/migrate.ts');
runSync('tsx src/db/seed.ts');

// 3) 启动并监听文件变化（长驻进程）
const child = spawn('tsx watch src/index.ts', { stdio: 'inherit', env, shell: true });
child.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
