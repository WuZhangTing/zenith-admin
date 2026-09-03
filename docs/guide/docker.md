# Docker 部署

Docker Compose 会启动 PostgreSQL、Redis、API 与 Nginx，适合生产试运行与中小规模部署。配置文件位于仓库根目录：`Dockerfile`、`docker-compose.yml`、`docker-compose.dev.yml`、`.env.docker`。

## 前置依赖

- Docker 24+
- Docker Compose v2

## 快速开始

```bash
git clone https://github.com/iwangbowen/zenith-admin.git
cd zenith-admin

cp .env.docker .env
# 生成两把密钥并填入 .env（JWT_SECRET / FIELD_ENCRYPTION_KEY 无默认值，留空无法启动）
npm run secret:generate

docker compose up -d

docker compose exec api node dist/db/seed.js

docker compose ps
```

::: tip 宿主机端口冲突
Compose 默认映射 `80`（Web）、`3300`（API）、`5432`（PostgreSQL）、`6379`（Redis）。
如宿主机已有服务占用，在 `.env` 中通过 `WEB_PORT` / `API_PORT` / `POSTGRES_PORT` / `REDIS_PORT` 改为空闲端口即可，容器间内部通信不受影响。
:::

访问地址：

| 服务 | 默认地址 |
| --- | --- |
| 前端 / Nginx | `http://localhost` |
| API | `http://localhost:3300` |
| Mastra Studio | `http://localhost/studio/` |

默认管理员：`admin` / `123456`。

::: tip
后端容器入口 `docker/entrypoint.sh` 会在启动时执行 `node dist/db/migrate.js`，因此迁移自动应用；种子数据需手动执行一次，可重复执行。
:::

## 服务拓扑

```text
postgres ─┐
redis    ─┤──→ api (Node.js :3300) ──→ web (Nginx :80)
```

| 服务 | 镜像 / 阶段 | 说明 |
| --- | --- | --- |
| `postgres` | `postgres:16-alpine` | 数据库，库名 `zenith_admin` |
| `redis` | `redis:7-alpine` | 会话、限流、幂等与黑名单状态；可开启密码与 AOF |
| `api` | Dockerfile `server` stage | Hono 后端，端口 3300，启动时迁移 |
| `web` | Dockerfile `web` stage | Nginx 静态站点，代理 `/api` 与 `/api/ws` |

## Dockerfile 构建流程

| 阶段 | 基础镜像 | 行为 |
| --- | --- | --- |
| `builder` | `node:24-alpine` | 安装全量依赖，构建 shared、analytics-sdk、server、web，执行 `docker/build-studio.mjs`，最后用 `docker/patch-shared-exports.mjs` 把 `@zenith/shared` 的 exports 指向编译产物 |
| `server` | `node:24-alpine` | 安装生产依赖，复制 server dist、Drizzle 迁移与 shared dist，写入 entrypoint |
| `web` | `nginx:1.27-alpine` | 复制 `packages/web/dist` 与 `docker/nginx.conf` |

`node-pty` 在 Linux 下需要编译，构建阶段安装 `python3 make g++`；server 阶段保留 `libstdc++` 并移除编译工具链。

::: details 为什么产物可以用纯 Node 运行？
源码中的相对导入不带扩展名（依赖 tsx / Vite 解析），而 Node.js 原生 ESM 要求显式 `.js` 扩展名。
shared 与 server 的 `build` 脚本在 `tsc` 之后运行 `tsc-alias --resolve-full-paths`，把 dist 中的相对导入改写为完整路径；
`docker/patch-shared-exports.mjs` 再把 `@zenith/shared` 的 `exports` 从 `./src/*.ts` 机械改写为 `./dist/*.js`。
两步之后 `node dist/db/migrate.js`、`node dist/index.js` 与 `node dist/db/seed.js` 均可脱离 tsx 直接运行。
:::

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `JWT_SECRET` | 无（必填） | JWT 签名密钥，≥ 32 字符随机值，按服务实例独立；`npm run secret:generate` 生成 |
| `FIELD_ENCRYPTION_KEY` | 无（必填） | 字段级 AES-256-GCM 密钥（64 位 hex），按数据库共享——连同一个库的实例必须一致，轮换会使已入库密文不可读 |
| `POSTGRES_PASSWORD` | `postgres` | PostgreSQL 密码 |
| `POSTGRES_PORT` | `5432` | PostgreSQL 宿主机映射端口 |
| `REDIS_PASSWORD` | 空 | Redis 密码；设置后 Redis 启用 `requirepass`，healthcheck 自动带上认证 |
| `REDIS_URL` | `redis://redis:6379` | API 使用的 Redis URL，可覆盖为外部 Redis |
| `REDIS_PORT` | `6379` | Redis 宿主机映射端口 |
| `WEB_PORT` | `80` | Nginx 对外端口 |
| `API_PORT` | `3300` | API 对外端口 |
| `ALLOWED_ORIGINS` | 空 | CSRF 允许来源 |
| `CORS_ORIGIN` | `*` | CORS 允许来源 |
| `LOG_LEVEL` | `info` | 后端日志级别 |
| `OAUTH_GITHUB_CLIENT_ID` / `OAUTH_GITHUB_CLIENT_SECRET` | 空 | GitHub OAuth 登录凭据 |
| `OAUTH_CALLBACK_BASE_URL` | `http://localhost` | OAuth 回调基础地址 |
| `TAG` | `latest` | 本地构建镜像标签 |

`JWT_SECRET` 与 `FIELD_ENCRYPTION_KEY` 留空或仍是占位值时，`docker compose up` 与 API 启动都会直接失败。生产环境请按实际域名设置 `ALLOWED_ORIGINS`。如果 Redis 设置密码，请同步把 `REDIS_URL` 配成带密码的连接串，例如 `redis://:your_password@redis:6379/0`。

## Nginx 行为

`docker/nginx.conf` 的当前行为：

- `/api` 代理到 `api:3300`，包含 WebSocket upgrade，覆盖 `/api/ws`。
- `/studio/` 托管 Mastra Studio 静态资源，数据面走同源 `/api/mastra`。
- `/studio/refresh-events` 返回 204，减少静态部署下的 EventSource 重试日志。
- `/index` / `/index.html` 跳转到 `/`。
- `/` fallback 到 `/index.html` 支持 SPA 路由。
- JS/CSS/字体/图片等静态资源使用一年 immutable 缓存。

## 常用操作

```bash
# 查看日志
docker compose logs -f
docker compose logs -f api
docker compose logs -f web

# 停止服务（保留数据卷）
docker compose down

# 停止并删除数据卷
docker compose down -v

# 进入容器
docker compose exec api sh

# 连接数据库
docker compose exec postgres psql -U postgres -d zenith_admin
```

## 升级版本

```bash
git pull
docker compose build --no-cache
docker compose up -d
```

API 容器重启时会自动迁移数据库。前端静态资源由 `web` 镜像提供，重建镜像后随容器替换生效。

## 本地开发基础设施

```bash
docker compose -f docker-compose.dev.yml up -d
npm run dev
```

`docker-compose.dev.yml` 只启动 `postgres:16-alpine` 与 `redis:7-alpine`，端口固定映射为 `5432` / `6379`，用于配合本地 Node / Vite 开发。

## 数据持久化

| 卷名 | 内容 |
| --- | --- |
| `postgres_data` | PostgreSQL 数据 |
| `redis_data` | Redis AOF 数据 |
| `api_storage` | 本地上传文件 |
| `api_logs` | 后端日志 |

```bash
# 备份 PostgreSQL
docker compose exec postgres pg_dump -U postgres zenith_admin > backup.sql

# 恢复 PostgreSQL
docker compose exec -T postgres psql -U postgres zenith_admin < backup.sql
```
