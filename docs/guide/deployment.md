# 部署说明

本页说明如何将 Zenith Admin 部署到生产服务器，面向需要独立运行此系统的团队或个人。

有两种部署方式：

| 方式 | 适用场景 |
| --- | --- |
| **[Docker 部署](./docker)**（推荐） | 无需手动安装运行时环境，一键启动所有服务 |
| **手动部署**（本页） | 对运行时有精细控制需求，或已有独立的 DB/Redis |

---

## 手动部署

### 环境要求

在目标服务器上准备以下环境：

| 依赖          | 版本要求 | 说明                         |
| ------------- | -------- | ---------------------------- |
| Node.js       | 24.x     | 运行后端服务                 |
| Git           | 任意     | 拉取源码                     |
| PostgreSQL    | >= 14    | 持久化业务数据               |
| Redis         | >= 6     | 持久化在线会话与黑名单状态   |
| Nginx（可选） | 任意     | 托管前端静态文件 + 反向代理  |

::: warning 后端以源码方式部署
后端依赖工作区内的 `@zenith/shared` 共享包（未发布到 npm registry），因此**手动部署采用源码方式**：在服务器上 checkout 仓库、安装工作区依赖后运行。GitHub Releases 中的 `server` 压缩包仅包含构建产物，无法独立 `npm install` 后运行，见下文[发布产物说明](#github-releases-产物说明)。
:::

---

## 部署后端

### 1. 获取代码并安装依赖

```bash
git clone https://github.com/iwangbowen/zenith-admin.git
cd zenith-admin
git checkout vX.Y.Z    # 检出目标版本 tag

# 安装全部工作区依赖
npm ci
```

### 2. 配置环境变量

在 `packages/server/` 目录下创建 `.env` 文件（`packages/server/.env.example` 列出了全部可用变量，可复制后修改）：

```dotenv
PORT=3300
JWT_SECRET=your-strong-secret-key
# 字段加密密钥（报表凭据等敏感字段加密用，建议随机 32 字节十六进制）
# FIELD_ENCRYPTION_KEY=

# PostgreSQL
DATABASE_URL=postgresql://user:pass@localhost:5432/zenith_admin

# Redis（URL 格式，支持带密码）
REDIS_URL=redis://127.0.0.1:6379
# REDIS_URL=redis://:your_password@127.0.0.1:6379/0

# 日志（可选）
LOG_LEVEL=info
LOG_DIR=./logs

# 请求防护（可选，默认均不启用）
# 请求体大小上限（字节），0 = 不限制。建议生产环境至少开启一个合理值
# REQUEST_BODY_LIMIT=10485760
# 请求超时（毫秒），0 = 不启用。启用后自动排除长耗时接口
# REQUEST_TIMEOUT_MS=30000

# Prometheus 指标默认暴露在 GET /metrics
# OpenTelemetry tracing（可选）
# OTEL_ENABLED=true
# OTEL_SERVICE_NAME=zenith-admin-server
# OTEL_SERVICE_VERSION=    # 未设置时自动取当前服务版本号
# OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://127.0.0.1:4318/v1/traces
# OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer xxx

# CSRF 防护（生产环境强烈建议配置，防止跨站请求伪造）
# 逗号分隔的允许来源，留空则不限制（开发模式）
ALLOWED_ORIGINS=https://your-domain.com

# CORS（仅在前后端跨域部署时需要；同域反向代理无需设置）
# CORS_ORIGIN=https://admin.example.com
```

::: warning 安全提示
生产环境务必使用强随机字符串作为 `JWT_SECRET`。若前端通过浏览器跨域访问后端，请同时配置 `ALLOWED_ORIGINS`（CSRF 白名单）和 `CORS_ORIGIN`（CORS 允许来源）；若通过 Nginx 同域反向代理 `/api/`，则通常无需单独配置 CORS。
:::

### 3. 初始化数据库

在仓库根目录执行：

```bash
# 执行数据库迁移
npm run db:migrate

# 填充初始种子数据（创建默认管理员 admin / 123456、菜单、字典等，可安全重复执行）
npm run db:seed
```

### 4. 启动服务

后端通过 [tsx](https://tsx.is/) 直接运行 TypeScript 源码（与开发链路一致，tsx 已包含在工作区依赖中）。

前台试运行：

```bash
cd packages/server
npx tsx src/index.ts
```

生产环境推荐使用 PM2 管理进程（在仓库根目录执行）：

```bash
npm install -g pm2
pm2 start node_modules/tsx/dist/cli.mjs --name zenith-server --cwd packages/server -- src/index.ts
pm2 save
pm2 startup
```

后端服务默认监听 `http://localhost:3300`。

::: tip 多实例横向扩展
Zenith Admin 的定时任务与后台 worker 全部基于 pg-boss（PostgreSQL 队列），通过 `SKIP LOCKED` 天然实现多进程安全——需要更高吞吐时可直接以不同端口启动多个实例（Nginx 负载均衡），任务不会被重复执行。
:::

---

## 部署前端

前端为纯静态文件。**推荐同域部署**：直接托管静态文件，并通过 Nginx 将 `/api/` 反向代理到后端。

### 1. 获取静态文件

同域部署时，两种来源任选其一：

```bash
# 方式一：从 GitHub Releases 下载现成产物（默认使用相对路径 /api/*，适合同域部署）
unzip zenith-admin-web-vX.Y.Z.zip -d zenith-web
# 静态文件位于 zenith-web/web/dist/

# 方式二：在服务器上从源码构建（后端已按源码方式部署时顺手可得）
npm run build
# 静态文件位于 packages/web/dist/
```

### 2. Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    root /path/to/zenith-web/web/dist;
    index index.html;

    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 反向代理
    location /api/ {
        proxy_pass http://localhost:3300;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Prometheus 指标（建议仅对内网或采集器开放）
    location = /metrics {
        proxy_pass http://localhost:3300;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket 支持（路径必须为 /api/ws，与服务端路由一致）
    location /api/ws {
        proxy_pass http://localhost:3300;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

::: tip
将 `your-domain.com` 替换为实际域名，`root` 指向实际的静态文件目录（如 `packages/web/dist`）。
生产环境建议同时配置 HTTPS（可使用 Let's Encrypt）。
:::

### 3. 前端 API 地址策略

GitHub Releases 中的 web 产物与默认构建均使用相对路径 `/api/*`，**同域部署时无需修改任何前端环境变量**：

- 浏览器访问 `https://admin.example.com`
- Nginx 将 `https://admin.example.com/api/*` 反向代理到 `http://localhost:3300`

这种模式下，前端静态文件与 API 共用同一域名，部署简单，也不需要额外处理浏览器跨域。

如果你必须将前端部署在独立域名，并直接请求另一个域名下的 API（例如前端 `https://admin.example.com`，后端 `https://api.example.com`），则**不能使用现成的 web 产物**，需创建 `packages/web/.env.production` 后从源码重新构建：

```ini
# packages/web/.env.production
VITE_API_BASE_URL=https://api.example.com
VITE_WS_BASE_URL=wss://api.example.com
VITE_APP_TITLE=Zenith Admin
```

```bash
npm run build -w @zenith/web
```

使用重新生成的 `packages/web/dist/` 作为静态文件目录。此场景下，后端还应配置：

```dotenv
CORS_ORIGIN=https://admin.example.com
```

## 健康检查

服务启动后，可通过以下接口确认后端运行正常：

```bash
curl http://localhost:3300/api/health
```

返回 `200 OK` 表示服务正常。

## Prometheus 指标抓取

若已完成部署，可通过以下接口确认指标端点可用：

```bash
curl http://localhost:3300/metrics
```

若服务位于 Nginx 后面并通过同域名暴露，请确保已按上文示例代理 `/metrics`，否则 Prometheus 会抓到前端静态站点而不是后端指标。

::: warning
`/metrics` 默认无需鉴权，生产环境建议仅对内网、VPN 或 Prometheus 所在网段开放，避免把内部运行指标暴露到公网。
:::

## OpenTelemetry Tracing

如需将 Trace 导出到 OTLP Collector、Tempo、Jaeger、Honeycomb 等系统，可在后端 `.env` 中加入：

```dotenv
OTEL_ENABLED=true
OTEL_SERVICE_NAME=zenith-admin-server
# OTEL_SERVICE_VERSION 未设置时自动取当前服务版本号
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://otel-collector:4318/v1/traces
```

说明：

- 若未设置 `OTEL_ENABLED`，但已配置 `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` 或 `OTEL_EXPORTER_OTLP_ENDPOINT`，服务也会自动启用 tracing
- 当前 Trace 基于 `@hono/otel`，覆盖整个 Hono 请求生命周期；若后续需要 PostgreSQL / Redis 更细粒度 spans，可继续叠加 OpenTelemetry Node auto instrumentation

---

## GitHub Releases 产物说明

每个版本的 [GitHub Releases](https://github.com/iwangbowen/zenith-admin/releases) 附带两个压缩包：

| 产物 | 内容 | 用途 |
| --- | --- | --- |
| `zenith-admin-web-vX.Y.Z.zip` | 前端静态文件（`web/dist/`） | 可直接托管，适合同域部署 |
| `zenith-admin-server-vX.Y.Z.zip` | 后端构建产物（`dist/` + `drizzle/` + `package.json`） | 仅作产物归档 |

后端压缩包依赖工作区内的 `@zenith/shared` 共享包（未发布到 npm registry），解压后无法通过 `npm install` 安装依赖并独立运行，**请按本页源码方式部署后端**。

---

## 升级版本

1. 停止当前后端进程（`pm2 stop zenith-server`）
2. 在服务器上检出目标版本并更新依赖：

   ```bash
   git fetch --tags
   git checkout vX.Y.Z
   npm ci
   ```

3. 执行数据库迁移（目标版本包含 schema 变更时会应用对应迁移）：

   ```bash
   npm run db:migrate
   ```

4. 重启后端进程（`pm2 restart zenith-server`）
5. 重新构建并替换前端静态文件（或下载对应版本的 web 产物），Nginx 无需重启
