# 本地开发

这一页聚焦开发过程中的常用命令、协作约定和容易踩坑的点。

## 常用命令

### 项目开发

```bash
npm run dev            # 同时启动后端 + 前端开发服务器
npm run dev:server     # 仅后端（启动前自动执行迁移与种子脚本）
npm run dev:web        # 仅前端
npm run dev:demo       # 前端 Demo 模式（MSW Mock，无需后端）
npm run dev:electron   # 前端 dev server + Electron 窗口（后端需另行启动）
```

### 构建与校验

```bash
npm run build                  # 顺序构建：shared → analytics-sdk → server → web
npm run build:demo             # 构建 Demo 站（使用 packages/web/.env.demo）
npm run build:electron         # 构建当前平台桌面安装包
npm run build:electron:win     # Windows（.exe）
npm run build:electron:mac     # macOS（.dmg）
npm run build:electron:linux   # Linux（.AppImage）
npm run test                   # server + web 全量 vitest
npm run test:server            # 仅后端测试
npm run test:web               # 仅前端测试
npm run lint                   # shared + server + analytics-sdk + web 四包检查
npm run lint:fix               # 自动修复
```

> 前端 `lint` 除 eslint 外还包含 stylelint（CSS）。

### 数据库相关

```bash
npm run db:generate    # 生成 Drizzle 迁移文件
npm run db:migrate     # 执行数据库迁移
npm run db:seed        # 填充种子数据（可安全重复执行）
```

### 文档站

```bash
npm run docs:dev       # 本地预览（http://localhost:4177）
npm run docs:build     # 构建
npm run docs:preview   # 预览构建产物（http://localhost:4178）
```

## 推荐开发顺序

1. 修改共享类型或校验规则时，优先更新 `packages/shared/src/`。
2. 修改数据库 schema 后，先执行 `npm run db:generate`，再执行 `npm run db:migrate`。
3. 页面开发时，优先复用现有请求封装与页面布局规范，避免“一个页面一个风格”。
4. 文档有新增内容时，同步补充到 `docs/`，让站点成为可浏览的项目入口。

## monorepo 协作方式

- `packages/server`：后端服务与数据库操作
- `packages/web`：管理后台前端（含会员前台与移动审批入口）
- `packages/shared`：共享类型、常量、Zod schema（按业务域拆分）
- `packages/analytics-sdk`：埋点采集 SDK
- `packages/electron`：Electron 桌面客户端

共享层直接引用 TypeScript 源文件，无需额外编译流程；导入必须走域子路径（如 `@zenith/shared/identity`），根入口被 ESLint 禁用。

## 常见注意事项

### 数据库迁移不要手改 SQL

修改 `packages/server/src/db/schema/` 下的表定义后，应该通过 Drizzle 生成迁移，而不是直接改已有 SQL 文件。

### 时间显示统一格式

系统内对外日期时间字符串统一使用 `YYYY-MM-DD HH:mm:ss`。前端展示使用 `packages/web/src/utils/date.ts` 中的 `formatDateTime`，提交 API 参数使用 `formatDateTimeForApi` / `formatDateForApi`；后端 DTO 映射、导出与入参解析统一使用 `packages/server/src/lib/datetime.ts`。

### 图标统一使用 `lucide-react`

前端页面与操作入口统一使用 `lucide-react`，不要引入 `@douyinfe/semi-icons`。

## 版本发布

发布流程详见 [贡献指南 → 版本发布](./contributing#版本发布)。
