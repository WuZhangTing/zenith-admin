# MSW Mock 实现参考（可选 Demo 演示模式）

本文档适用于需要支持 `VITE_DEMO_MODE=true` 的 Demo 演示场景。当后端不可用时，MSW（Mock Service Worker）拦截所有 API 请求，返回内存中的静态数据。

> **占位符约定**：`xxx` = 小写（表名、API 路径、文件名）；`Xxx` = 大驼峰（TypeScript 类型、组件名）。
>
> **仅在用户确认需要 Demo 演示模式时才实现这部分。**

---

## 文件清单

```text
packages/web/src/mocks/
├── utils/
│   ├── array.ts             # 内存数组的共享原地变更工具
│   ├── handlers.ts          # 共享响应构造与分页（现有文件，直接用，勿另起炉灶）
│   └── date.ts              # mockDateTime() 等时间工具
├── data/
│   └── xxxs.ts              # 静态初始数据 + nextId 工具函数
├── handlers/
│   └── xxxs.ts              # HTTP handler 定义
└── handlers/index.ts        # 注册 xxxsHandlers（现有文件，追加即可）
```

---

## 响应构造：一律用 `mocks/utils/handlers`

**禁止在 handler 里内联 `HttpResponse.json({ code, message, data })`，也禁止在文件内自建同名 helper。**
自建 helper 的典型后果是默认 `message` 各文件不一致（`'ok'` vs `'success'`），
调用点看不出差异，改一次响应结构又要逐文件追。

| 构造函数 | 用途 |
| --- | --- |
| `ok(data?, message?, init?)` | 成功响应，`message` 默认 `'ok'`；**省略 `data` 时响应体不含 `data` 字段**，需要 `data: null` 就显式传 `null` |
| `badRequest` / `unauthorized` / `forbidden` / `notFound` / `conflict` / `locked` | 400 / 401 / 403 / 404 / 409 / 423，`data` 固定 `null` |
| `fail(code, message, init?)` | 上述之外的业务 code |
| `pageParams(url, defaultPageSize?)` | 解析 `{ page, pageSize }` |
| `paginate(list, url, defaultPageSize?)` | 切片并返回 `{ list, total, page, pageSize }` |
| `pageResult(list, page, pageSize)` | 页码来自 query 之外时用这个 |
| `nextIdFrom(list)` | 由现有列表推下一个自增 ID，空列表返回 1 |

批量删除或级联清理内存数组时，用 `mocks/utils/array.ts` 的
`removeWhere(list, predicate)`；它保持原数组引用并返回实际移除数量。

**关于 HTTP 状态码**：所有构造函数的末位参数是原样透传的 `ResponseInit`。
默认只在响应体里写 `code`（HTTP 仍是 200）；需要同时设置 HTTP 状态码时显式写
`notFound('XXX 不存在', { status: 404 })`。真实后端失败时会返回非 2xx，
**新写的 handler 一律带上 `{ status: N }`**，与后端保持一致。

---

## Step 10a：`packages/web/src/mocks/data/xxxs.ts`

```ts
import { SEED_XXXS } from '@zenith/shared/seed';  // 从共享种子数据导入，与 DB seed 保持一致
import type { Xxx } from '@zenith/shared/{业务域}';
import { mockDateTime } from '@/mocks/utils/date';
import { nextIdFrom } from '@/mocks/utils/handlers';

// 如 Xxx 类型有 mock 专属字段（如运行时计数），在此扩展
export interface MockXxx extends Xxx {
  // extraField?: number;  // 仅 demo 模式使用的额外字段
}

// 从共享常量派生初始数据（禁止重复定义！）
const now = mockDateTime();
export const mockXxxs: MockXxx[] = SEED_XXXS.map((x) => ({
  ...x,
  // 如有 mock 专属字段，在此覆盖：
  // extraField: 0,
  createdAt: now,
  updatedAt: now,
}));

// 自增 ID（内存）。禁止手写 `Math.max(...list.map((x) => x.id)) + 1`——
// 该写法在空列表时会得到 `-Infinity`
let nextXxxId = nextIdFrom(mockXxxs);
export function getNextXxxId(): number {
  return nextXxxId++;
}
```

> **规则**：若种子数据已在 `packages/shared/src/seed/{业务域}.ts` 定义为 `SEED_XXXS`，
> 则直接导入，**禁止**在 mock data 文件中重复写静态数组。
> 若 demo 模式需要额外字段（如运行时计数 `memberCount`），用 `.map()` 展开后追加，不要整体复制。
> 新增模块时，**先**在 `packages/shared/src/seed/{业务域}.ts` 添加 `SEED_XXXS`，**再**在 mock data 中导入。

---

## Step 10b：`packages/web/src/mocks/handlers/xxxs.ts`

```ts
import { http } from 'msw';
import { ok, badRequest, notFound, paginate } from '@/mocks/utils/handlers';
import type { Xxx } from '@zenith/shared/{业务域}';
import { mockXxxs, getNextXxxId } from '../data/xxxs';
import { mockDateTime } from '../utils/date';

export const xxxsHandlers = [
  // ─── GET / — 分页列表 + 关键词搜索 + 状态筛选 ───────────────────────
  http.get('/api/xxxs', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const status  = url.searchParams.get('status')  || '';

    let list = [...mockXxxs];

    if (keyword) {
      list = list.filter(
        (x) =>
          x.name.includes(keyword) ||
          (x.description ?? '').includes(keyword),
      );
    }
    if (status) {
      list = list.filter((x) => x.status === status);
    }

    // paginate 内部读 query 的 page/pageSize 并返回 { list, total, page, pageSize }
    // 页大小默认 10，与接口约定不同时传第三个参数：paginate(list, url, 20)
    return ok(paginate(list, url));
  }),

  // ─── GET /:id — 详情 ─────────────────────────────────────────────────
  http.get('/api/xxxs/:id', ({ params }) => {
    const xxx = mockXxxs.find((x) => x.id === Number(params.id));
    if (!xxx) return notFound('XXX 不存在', { status: 404 });
    return ok(xxx);
  }),

  // ─── POST / — 创建 ────────────────────────────────────────────────────
  http.post('/api/xxxs', async ({ request }) => {
    const body = (await request.json()) as Partial<Xxx>;
    if (mockXxxs.some((x) => x.name === body.name)) {
      return badRequest('名称已存在', { status: 400 });
    }
    const now = mockDateTime();
    const newXxx = {
      id: getNextXxxId(),
      name: body.name ?? '',
      description: body.description ?? '',
      status: body.status ?? 'enabled',
      createdAt: now,
      updatedAt: now,
    };
    mockXxxs.push(newXxx);
    return ok(newXxx, '创建成功');
  }),

  // ─── PUT /:id — 更新 ─────────────────────────────────────────────────
  http.put('/api/xxxs/:id', async ({ params, request }) => {
    const idx = mockXxxs.findIndex((x) => x.id === Number(params.id));
    if (idx === -1) return notFound('XXX 不存在', { status: 404 });
    const body = (await request.json()) as Partial<Xxx>;
    Object.assign(mockXxxs[idx], { ...body, updatedAt: mockDateTime() });
    return ok(mockXxxs[idx], '更新成功');
  }),

  // ─── DELETE /:id — 删除 ──────────────────────────────────────────────
  http.delete('/api/xxxs/:id', ({ params }) => {
    const idx = mockXxxs.findIndex((x) => x.id === Number(params.id));
    if (idx === -1) return notFound('XXX 不存在', { status: 404 });
    mockXxxs.splice(idx, 1);
    // 删除接口无返回体：显式传 null 保留 `data: null`，省略则响应体不含 data 字段
    return ok(null, '删除成功');
  }),
];
```

---

## Step 10c：`packages/web/src/mocks/handlers/index.ts`

在现有文件中追加注册（不要替换，只追加）：

```ts
// 在顶部 import 区域追加：
import { xxxsHandlers } from './xxxs';

// 在 handlers 数组中追加（与其他 handlers 同级）：
export const handlers = [
  ...authHandlers,
  ...usersHandlers,
  // ... 其他已有 handlers ...
  ...xxxsHandlers,   // ← 新增这行
];
```

---

## 注意事项

- **数据放内存**：mock 数据在页面刷新后会重置，这是预期行为
- **与 seed 数据对齐**：`mockXxxs` 的初始数据应与 `seed.ts` 的初始数据一致
- **mockXxxs 共享引用**：push/splice 操作直接修改数组，所有 handler 共享同一份数据，无需额外状态管理
- **时间字段**：创建/更新时用 `mockDateTime()`，初始数据用 `SEED_DATE`（如 `'2024-01-01 00:00:00'`），保持与 API 的 `YYYY-MM-DD HH:mm:ss` 契约一致
