# Demo 演示模式（MSW Mock）

Zenith Admin 支持无后端服务的纯前端演示模式，通过 [MSW（Mock Service Worker）](https://mswjs.io/) 拦截所有 API 请求，在浏览器中直接返回预设的 Mock 数据。Demo 站即使用此模式构建，托管在 GitHub Pages 上。

---

## 工作原理

```text
浏览器发出 fetch/XHR 请求
    ↓
Service Worker（mockServiceWorker.js）拦截请求
    ↓
MSW Handler 匹配路径和方法
    ↓
返回 Mock 数据（无实际网络请求）
    ↓
前端像收到真实接口响应一样正常渲染
```

整个过程对前端业务代码（`request.ts`）完全透明，无需修改任何业务逻辑。

---

## 开启 Demo 模式

本地开发直接使用根目录脚本：

```bash
npm run dev:demo
```

该命令以 `--mode demo` 启动 Vite dev server，自动读取 `packages/web/.env.demo`（其中 `VITE_DEMO_MODE=true`）。启动后，前端请求会由 `mockServiceWorker.js` 按已注册的 handlers 处理，无需后端。

> 判定开关是环境变量 `VITE_DEMO_MODE=true`：任何构建/启动方式只要注入了该变量，`mocks/index.ts` 的 `enableMocking()` 就会注册 Service Worker。

---

## 构建 Demo 站

```bash
npm run build:demo
```

此命令使用 `packages/web/.env.demo` 中的变量构建前端，并将产物输出到 `packages/web/dist/`。

实际构建产物会先输出到 `packages/web/dist/`，随后由 `.github/workflows/pages.yml` 在 CI 中复制到 `docs/.vitepress/dist/demo/`，再与文档站一起发布。

```ini
# packages/web/.env.demo 的关键变量
VITE_DEMO_MODE=true
VITE_APP_TITLE=Zenith Admin
VITE_API_BASE_URL=
VITE_WS_BASE_URL=
VITE_BASE_URL=
```

Demo 站与文档站通过 `.github/workflows/pages.yml` 一同部署到 GitHub Pages。

---

## 目录结构

Mock 代码全部位于 `packages/web/src/mocks/`，按「静态数据 / handler / 工具」分层：

```text
packages/web/src/mocks/
├── data/               # 静态 Mock 数据，每个业务模块一个文件（60+ 个）
│   ├── users.ts        #   与 shared/src/seed/ 及 db/seed.ts 的种子数据对齐
│   ├── positions.ts
│   ├── ...
│   └── index.ts        # 汇总导出
├── handlers/           # MSW Handler 定义，每个业务模块一个文件（120+ 个）
│   ├── auth.ts
│   ├── positions.ts
│   ├── ...
│   ├── fallback.ts     # 未匹配请求的兜底
│   └── index.ts        # 汇总注册所有 handlers
├── utils/
│   ├── handlers.ts     # 响应信封（ok/notFound/…）、分页、自增 ID
│   └── date.ts         # mockDateTime() / mockDate()
├── *.test.ts           # handler 回归测试（vitest）
├── browser.ts          # setupWorker（浏览器环境）
└── index.ts            # enableMocking() 入口，VITE_DEMO_MODE 控制是否激活
```

模块文件与业务域一一对应（如 `users.ts`、`payment.ts`、`workflow.ts`、`member-admin.ts`），新增模块时按同名约定添加，具体清单以目录为准。

---

## 维护规范

### 新增业务模块时

1. 若模块有初始种子数据，先在 `packages/shared/src/seed/{业务域}.ts` 中声明对应 `SEED_XXXS` 常量
2. 在 `packages/server/src/db/seed.ts` 中导入并写入数据库
3. 在 `data/` 下创建对应数据文件，导入共享种子数据并按 Demo 需要展开
4. 在 `handlers/` 下创建对应的 Handler 文件，实现接口模拟
5. 在 `handlers/index.ts` 中导入并注册新 Handler
6. 在 `data/index.ts` 中导出新数据

### 修改 API 接口格式时

如果后端接口的请求/响应格式发生变化，需要同步更新对应的 MSW Handler，确保 Demo 模式不出现格式不一致的问题。

---

## Handler 示例

响应信封、分页与自增 ID 统一走 `mocks/utils/handlers.ts`，不要在 handler 里内联 `HttpResponse.json`：

```typescript
// packages/web/src/mocks/handlers/positions.ts
import { http } from 'msw';
import { ok, notFound, paginate } from '@/mocks/utils/handlers';
import { mockPositions } from '@/mocks/data/positions';

export const positionsHandlers = [
  http.get('/api/positions', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') ?? '';
    const status = url.searchParams.get('status') ?? '';

    const filtered = mockPositions.filter((p) => {
      if (keyword && !p.name.includes(keyword) && !p.code.includes(keyword)) return false;
      if (status && p.status !== status) return false;
      return true;
    });
    return ok(paginate(filtered, url));
  }),

  http.get('/api/positions/:id', ({ params }) => {
    const position = mockPositions.find((p) => p.id === Number(params.id));
    if (!position) return notFound('岗位不存在');
    return ok(position);
  }),
];
```

可用的构造函数：

| 函数 | 说明 |
| --- | --- |
| `ok(data?, message?, init?)` | 成功响应，`message` 默认 `'ok'`；省略 `data` 时响应体不含该字段 |
| `badRequest` / `unauthorized` / `forbidden` / `notFound` / `conflict` / `locked` | 对应 400 / 401 / 403 / 404 / 409 / 423 |
| `fail(code, message, init?)` | 上述之外的业务 code |
| `pageParams(url, defaultPageSize?)` | 解析 `{ page, pageSize }` |
| `paginate(list, url, defaultPageSize?)` | 切片并返回 `{ list, total, page, pageSize }` |
| `pageResult(list, page, pageSize)` | 页码来自 query 之外时使用 |
| `nextIdFrom(list)` | 由现有列表推下一个自增 ID |

末位的 `init` 是原样透传给 `HttpResponse.json` 的 `ResponseInit`。现存各 handler 对失败响应的 HTTP 状态码处理并不统一（一部分只在响应体写 `code`，HTTP 仍为 200；另一部分同时带 `{ status: N }`），且二者对 `request.ts` 的表现不同——修改既有 handler 时保持其原有行为，不要擅自统一。

---

## 访问 Demo 站

线上 Demo 站地址：[https://iwangbowen.github.io/zenith-admin/demo/](https://iwangbowen.github.io/zenith-admin/demo/)

默认登录账号：

| 账号    | 密码     | 说明                     |
| ------- | -------- | ------------------------ |
| `admin` | `123456` | 超级管理员，拥有所有权限 |
