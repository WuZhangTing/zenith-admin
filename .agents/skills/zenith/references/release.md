# 发布新版本流程

## 触发时机

用户说「发布 vX.Y.Z」「准备 X.Y.Z 版本」「release X.Y.Z」时，按此流程执行。

---

## Step 1：确认版本号

- 格式必须为 `x.y.z`（语义化版本），向用户确认版本号
- 运行 `git log <上一版本tag>..HEAD --oneline` 查看本次变更提交，用于撰写 Changelog

---

## Step 2：更新 package.json 版本号

同步更新**根 `package.json` 及 `packages/` 下所有包**的 `"version"` 字段：

- 根 `package.json`
- `packages/server/package.json`
- `packages/web/package.json`
- `packages/shared/package.json`
- `packages/analytics-sdk/package.json`
- `packages/electron/package.json`

> 若 `packages/` 下新增了包，一并同步，并将其补充到上述列表中。

---

## Step 3：同步 package-lock.json

版本号写入后，在项目根目录执行以下命令，使 `package-lock.json` 与 `package.json` 保持一致：

```bash
npm install --package-lock-only
```

> `--package-lock-only` 仅更新 lock 文件，不安装/变更 node_modules，速度快且安全。

---

## Step 4：并行验证（Lint + 测试 + 构建 + 文档站）

Lint、测试、构建、文档站四类验证**互相独立**（只读源码、产物互不干扰），统一并行执行（项目已内置 `concurrently`）：

```bash
npx concurrently --group --timings --kill-others-on-fail -n lint,test,build,docs \
  "npm run lint" \
  "npm test" \
  "npm run build && npm run build:demo" \
  "npm run docs:build"
```

四路全部 `exit code 0` 方可继续。并行墙钟取决于最长的一路（通常是 build），通常 3-8 分钟。
任一路失败会立即终止其余任务，修复后可只重跑失败的那条命令。

### 读懂 `--kill-others-on-fail` 的输出

任一路失败时 `concurrently` 会**主动杀掉**其余三路，被杀的那几路同样打印非 0 退出码。
必须看结尾 Timings 表的 `killed` 列区分，**不要**看到多路飘红就以为崩了多处：

| `killed` 列 | 含义 | 处置 |
| --- | --- | --- |
| `false` + 非 0 退出码 | 真失败，问题就在这一路 | 定位并修复 |
| `true` | 被连带终止、根本没跑完 | 无需处理，重跑即可 |

### 并发度：两个已配置好的旋钮

vitest 的转译成本决定了 server 测试的耗时，由两处配置共同压住，**本步骤无需额外传参**：

| 旋钮 | 位置 | 作用 |
| --- | --- | --- |
| `maxWorkers: 8` | `packages/server/vitest.config.ts` | vitest 默认 worker 数 = 核数−1，每个 worker 独立转译整套 app（267 个路由文件），核多时重复转译反超并行收益 |
| `480_000` 超时 | `src/app.routes.test.ts`、`src/app.contract.test.ts` | 两个用例耗时几乎全在 `await import('./app')` / `buildContractApp()`，与 lint / build / docs 三路争抢同一种（转译）资源 |

再遇测试超时时：先确认是超时（而非断言失败）且单独跑能过，再按
[troubleshooting.md → 测试超时](./troubleshooting.md)调这两个旋钮。**不要**删掉这里的外层并行——
单独跑 `npm test`（零外层并发）同样会超时，外层并行不是根因。

各路的通过标准：

- **lint**：`npm run lint` 依次跑 shared / server / analytics-sdk / web 四包 eslint，**0 error**（warning 不阻塞）
- **test**：`npm test` 依次跑 server 与 web 全部 vitest，全部通过
- **build**：`npm run build`（shared → analytics-sdk → server → web，依赖链**必须**串行）成功后接 `npm run build:demo`。
  ⚠️ `build` 与 `build:demo` 都写 `packages/web/dist` 与 tsbuildinfo，**两者之间禁止并行**，只能如上串联在同一路里
- **docs**：`npm run docs:build` 输出 `build complete`

> Step 5 写入 changelog 后**无需**重跑整套验证：changelog 只影响文档站，单独重跑 `npm run docs:build` 确认即可。

### DB 集成测试（按需，独立于上面四路）

核心资金链路 DB 集成测试（积分 / 钱包 / 优惠券的「事务 + 乐观锁」并发正确性，默认跳过，需本地 PostgreSQL 可用）：

```powershell
# PowerShell（在 packages/server 目录执行）
$env:MEMBER_FUNDS_DB_IT='1'; npx vitest run src/services/member/member-funds.it.test.ts
```

```bash
# Bash（在 packages/server 目录执行）
MEMBER_FUNDS_DB_IT=1 npx vitest run src/services/member/member-funds.it.test.ts
```

> 本次发布涉及积分 / 钱包 / 优惠券 / 支付相关改动时，该集成测试**必须**运行并通过；其余改动 PG 不可用时可跳过。

以及任务中心幂等作用域 DB 集成测试（跨租户 / 跨用户 / 跨任务类型的隔离由两个部分唯一索引保证，mock 验证不到）：

```powershell
# PowerShell（在 packages/server 目录执行）
$env:TASK_IDEM_DB_IT='1'; npx vitest run src/lib/task-center/task-idempotency.it.test.ts
```

```bash
# Bash（在 packages/server 目录执行）
TASK_IDEM_DB_IT=1 npx vitest run src/lib/task-center/task-idempotency.it.test.ts
```

> 本次发布涉及任务中心 / 幂等 / 多租户相关改动时，该集成测试**必须**运行并通过。
> 两个集成测试连接同一本地 PG，可与四路并行验证同时进行，也可一条命令合跑：
> `$env:MEMBER_FUNDS_DB_IT='1'; $env:TASK_IDEM_DB_IT='1'; npx vitest run src/services/member/member-funds.it.test.ts src/lib/task-center/task-idempotency.it.test.ts`

---

## Step 5：更新 `docs/changelog/index.md`

在文件顶部（第一个 `---` 分隔符之后，上一版本记录之前）**追加**当前版本的变更记录：

```markdown
## vX.Y.Z - YYYY-MM-DD

### Added

#### 功能分类
- 具体变更描述

### Changed

- 变更内容

### Fixed

- 修复内容
```

> 仅记录本次版本的实际变更，不伪造内容。根据 git log 整理，与用户确认关键变更点后再写入。

---

## Step 6：提交并推送 tag

```bash
# 将变更提交到 master
git add .
git commit -m "chore: release vX.Y.Z"
git push origin master

# 打 tag 并推送（触发 release.yml 自动构建）
git tag vX.Y.Z
git push origin vX.Y.Z
```

---

## Step 7：等待 GitHub Actions 完成

- `release.yml` 触发后会自动：构建产物 → 打包 zip → 提取 Changelog → 发布 GitHub Release
- 发布产物包含：`zenith-admin-server-vX.Y.Z.zip`（后端）和 `zenith-admin-web-vX.Y.Z.zip`（前端静态文件）

---

## 注意事项

- 版本含 `-beta`、`-rc`、`-alpha` 时，GitHub Release 自动标记为 Pre-release
- Release Notes 自动从 `docs/changelog/index.md` 中提取对应版本段落
