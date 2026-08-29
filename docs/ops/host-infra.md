# 主机与中间件

本页描述系统运维目录下的运维概览、主机运行态、中间件、网络、日志、Web 服务配置、证书和维护模式。

---

## 运维概览

「运维概览」（`/system/ops-overview`）是系统运维目录首页，权限码 `system:ops:overview`。
`GET /api/ops-overview` 一次请求并行聚合各能力面的健康快照：主机 CPU / 内存 / 磁盘与 PG / Redis 连通性（复用服务监控采集）、Docker 容器运行状态、systemd 失败单元数、SSL 证书到期风险、防火墙与 Nginx 状态、活动终端会话数、监听端口数。每个分区独立容错（`available` / `reason`），单项探测失败或超时（8 秒，主机快照 20 秒）不影响整体响应。

前端以健康卡片矩阵展示（异常标红、点击直达对应页面），附组件状态列表与全部运维页面快捷入口。

## 进程管理

「进程管理」（`/system/processes`）使用权限码：

| 权限码 | 说明 |
| --- | --- |
| `system:process:view` | 查看进程列表、详情和导出 |
| `system:process:kill` | 结束进程 |
| `system:process:priority` | 调整进程优先级 |

后端 `/api/processes` 根据运行平台采集进程：Linux / macOS 使用 `ps`，Linux 详情补充 `/proc/:pid/environ` 与 `/proc/:pid/cwd`；Windows 使用 PowerShell `Get-Process` 和 `Win32_Process`。监听端口按 PID 缓存 15 秒并合并到进程列表。

实时列表通过 `GET /api/processes/stream` 以 SSE 推送，首帧返回完整列表，之后每 3 秒刷新一次，并每 30 秒发送心跳。页面支持关键字与状态筛选、详情弹窗、结束进程和优先级调整。

结束进程时 Windows 使用 `Stop-Process -Id <pid> -Force`；Linux / macOS 支持 `SIGTERM`、`SIGKILL`、`SIGINT`、`SIGHUP`。优先级调整在 Linux / macOS 使用 `renice`，Windows 使用 `PriorityClass`。

## 端口监听

「端口监听」（`/system/ports`）调用 `/api/ports` 获取监听端口列表，查看权限为 `system:port:view`，结束占用进程使用 `system:process:kill`。操作列提供「查看进程」深链（跳转进程管理页并按 PID 定位）。

端口采集方式：Linux / macOS 优先使用 `ss -tlnp`，回退到 `netstat -tlnp`；Windows 使用 `netstat -ano`。返回协议、本地地址、本地端口、状态、PID、进程名和服务名。服务名由内置常见端口映射识别，例如 `22 → SSH`、`80 → HTTP`、`443 → HTTPS`、`5432 → PostgreSQL`、`6379 → Redis`、`5173 → Vite`、`3300 → Zenith-API`。

## Docker 管理

「Docker」（`/system/docker`）接口前缀为 `/api/docker`，主要复用 `system:process:view` 权限，并在启停、删除、创建、拉取、清理等操作中写入审计日志。服务端通过 Dockerode 连接 Docker Engine。

### 容器

- `GET /api/docker`：容器列表，包含 ID、名称、镜像、命令、创建时间、状态、端口、Compose 项目信息；
- `POST /api/docker/:id/start`、`/stop`、`/restart`：启动、停止、重启；
- `GET /api/docker/:id/logs?tail=500`：读取容器日志；
- `GET /api/docker/:id/stats`：读取 CPU 与内存占用；
- `GET /api/docker/:id/inspect`：返回 `docker inspect` 详情；
- `GET /api/docker/:id/files`、`GET /api/docker/:id/files/content`：浏览与读取容器内文件；
- Web 终端可通过 `docker-exec:<containerId>` 进入容器 shell。

### 镜像、网络、卷与清理

| 对象 | 能力 |
| --- | --- |
| 镜像 | 列表、删除、按 `repoTag` 拉取 |
| 网络 | 列表、创建、删除 |
| 卷 | 列表、创建、删除 |
| 清理 | `POST /api/docker/prune/containers` / `images` / `networks` / `volumes` / `system` |

`POST /api/docker/prune/images?all=true` 清理所有未被容器使用的镜像；不带 `all=true` 时清理悬空镜像。

## 网络诊断

「网络诊断」（`/system/network-diag`）接口前缀为 `/api/network-diag`，全部接口使用权限码 `system:network:diag`。

| 能力 | 接口 | 实现 |
| --- | --- | --- |
| ping | `GET /api/network-diag/stream?type=ping&host=...` | Windows 使用 `ping -n 4`，其他平台使用 `ping -c 4 -W 3` |
| traceroute | `GET /api/network-diag/stream?type=traceroute&host=...` | Windows 使用 `tracert -h 30`，其他平台使用 `traceroute -m 30 -w 3` |
| nslookup | `GET /api/network-diag/nslookup?host=...` | 执行 `nslookup` 并返回文本输出 |
| DNS 记录 | `GET /api/network-diag/dns?host=...&type=A` | 支持 `A` / `AAAA` / `MX` / `TXT` / `NS` / `CNAME` / `SOA` |
| 反向 DNS | `GET /api/network-diag/reverse?ip=...` | 使用 PTR 反查主机名 |
| HTTP(S) 探测 | `POST /api/network-diag/http-probe` | 返回状态码、耗时、Server、Content-Type、Content-Length、Location 和错误信息 |
| TCP 端口检测 | `POST /api/network-diag/port-check` | 5 秒超时，返回是否连通与延迟 |
| 本机网卡 | `GET /api/network-diag/interfaces` | 返回网卡名、地址、掩码、IP 版本、MAC、是否内网和 CIDR |

主机名参数通过正则限制为字母、数字、点、下划线和连字符，避免命令注入。

## systemd 服务管理

「服务管理」（`/system/services`）面向 Linux systemd 环境，接口前缀为 `/api/systemd`，查看（列表 / 详情 / 日志）用 `system:service:view`，服务启停等控制操作用 `system:service:manage`。页面先调用 `GET /api/systemd/check` 检查 `systemctl --version` 是否可用；不可用时展示提示。

服务列表来自 `systemctl list-units --type=service --all --no-pager --plain --no-legend`，返回服务名、描述、加载状态、活动状态和子状态。后端列表会移除 `.service` 后缀，控制接口调用时再拼接 `.service`。

| 操作 | 接口 |
| --- | --- |
| 启动 / 停止 / 重启 / reload | `POST /api/systemd/:name/start`、`/stop`、`/restart`、`/reload` |
| 开机自启 | `POST /api/systemd/:name/enable` |
| 取消自启 | `POST /api/systemd/:name/disable` |
| 屏蔽服务 | `POST /api/systemd/:name/mask` |
| 取消屏蔽 | `POST /api/systemd/:name/unmask` |
| 服务详情 | `GET /api/systemd/:name/detail` |
| 近期日志 | `GET /api/systemd/:name/logs` |
| 实时日志 | `GET /api/systemd/:name/logs/stream` |

服务详情使用 `systemctl show` 读取 `Id`、`Description`、`LoadState`、`ActiveState`、`SubState`、`UnitFileState`、`MainPID`、`ExecMainStartTimestamp`、`MemoryCurrent`、`CPUUsageNSec`、`Restart`、`FragmentPath`、`TriggeredBy`、`Requires`、`WantedBy` 等字段。

## 日志查看

系统提供两类日志能力。

### 日志查看器

「日志查看器」（`/system/log-viewer`）面向任意绝对路径日志文件，接口前缀为 `/api/log-viewer`，权限码 `system:log:view`。支持 `?path=` 深链直接加载指定文件（Nginx 站点页的「访问日志 / 错误日志」由此跳入）：

| 接口 | 说明 |
| --- | --- |
| `GET /api/log-viewer/content?path=...&lines=500` | 读取日志末尾内容，最多 5000 行 |
| `GET /api/log-viewer/stream?path=...` | 通过 `tail -f -n 0` 流式追踪 |
| `GET /api/log-viewer/download?path=...` | 下载日志文件，默认最大 100 MB |

前端使用 ANSI 渲染日志行，支持关键词高亮、仅显示匹配行、`ERROR` / `WARN` / `INFO` / `DEBUG` 级别识别、颜色高亮、级别筛选与下载。

### 日志文件

「日志文件」（`/system/log-files`）面向服务端配置的日志目录 `config.log.dir`，接口前缀为 `/api/log-files`。该模块只允许访问目录内的 `.log` 与 `.log.gz` 文件，并通过文件名校验防止路径穿越。

日志中的 ERROR / WARN 频率同时作为监控指标接入告警中心，见[监控与告警](./observability.md#日志级别频率指标)。

| 接口 | 权限 | 说明 |
| --- | --- | --- |
| `GET /api/log-files` | `system:log:files` | 日志文件列表 |
| `GET /api/log-files/:filename/content` | `system:log:files` | 读取最后 N 行，支持关键词过滤与 `context` 上下文行（0-10） |
| `GET /api/log-files/:filename/tail` | `system:log:files` | SSE 实时追踪，`.gz` 文件不支持实时追踪 |
| `GET /api/log-files/:filename/download` | `system:log:files:download` | 下载日志文件 |
| `DELETE /api/log-files/:filename` | `system:log:files:delete` | 删除日志文件 |

读取采用 readline 流式逐行 + 固定容量环形缓冲，普通日志与 `.gz` 归档走同一条路径，峰值内存为 O(N 行)。`context` 参数在关键词命中行前后各保留 N 行。实时追踪通过轮询文件追加内容实现，周期为 1 秒。

前端查看器支持虚拟滚动、正则搜索、大小写切换、上一个 / 下一个匹配导航、仅匹配行模式、服务端全文过滤、级别筛选、暂停 / 继续实时追踪、断线自动重连、复制当前视图 / 复制全部 / 导出当前视图、跳到指定行号，以及按 URL 参数 `?file=` / `?level=` 深链定位。

## 防火墙管理

「防火墙管理」（`/system/firewall`）接口前缀为 `/api/firewall`，查看用 `system:firewall:view`，规则管理与启停用 `system:firewall:manage`。

- 服务端按 `ufw → firewalld → iptables` 顺序自动探测防火墙后端，返回类型与版本；Windows 等无受支持后端的平台返回 `type: 'unknown'`，前端按不可用降级展示。
- `GET /api/firewall` 返回防火墙状态，`GET /api/firewall/rules` 返回规则列表。
- `POST /api/firewall/rules` 添加规则、`DELETE /api/firewall/rules/{id}` 删除规则，入参端口、来源、目标与备注先清洗再拼接命令。
- `POST /api/firewall/enable`、`POST /api/firewall/disable` 启停防火墙。

## Nginx 站点管理

「Nginx 站点」（`/system/nginx-sites`）接口前缀为 `/api/nginx-sites`。权限码：`system:nginx:view`（查看）、`system:nginx:manage`（建站 / 编辑 / 删除 / 启停）、`system:nginx:reload`（重载）。

- `GET /api/nginx-sites/info` 返回 Nginx 安装状态、版本、配置目录与 `systemctl is-active` 运行状态；Windows 平台不支持（`installed: false`，站点列表为空、写操作返回 400）。
- 自动适配 `sites-available` + `sites-enabled` 软链模式，或 `conf.d` / `servers` 单目录模式。
- 站点列表解析每个配置的 `server_name`、监听端口、根目录、是否启用 SSL 以及 `access_log` / `error_log` 路径（供日志查看器深链）；详情返回完整配置内容。
- `POST /api/nginx-sites` 按模板生成 server 块；`PUT /api/nginx-sites/:name` 直接保存配置文件内容。
- `POST /api/nginx-sites/test` 执行 `nginx -t`；`POST /api/nginx-sites/reload` 重载 Nginx。
- 站点增删改与启停记录审计，包含前后配置快照。

## SSL 证书管理

「SSL 证书」（`/system/ssl-certificates`）接口前缀为 `/api/ssl-certificates`，证书元数据存储在 `ssl_certificates` 表。权限码：`system:ssl:view`（查看 / 下载）、`system:ssl:create`（生成 / 上传）、`system:ssl:delete`（删除）。

- `POST /generate` 用 openssl 生成自签名证书，`POST /upload` 上传自定义 PEM 证书与私钥。
- 证书通过 `openssl x509` 解析签发者、主题、有效期、指纹与序列号；解析失败返回 400。
- 状态按剩余有效期自动计算并回写：`valid` / `expiring`（≤ 30 天）/ `expired` / `invalid`，列表返回 `daysRemaining`。
- 列表支持按名称 / 域名关键字与类型（`self_signed` / `uploaded` / `letsencrypt`）筛选。
- `GET /:id/download?kind=cert|key` 下载证书或私钥文件；删除证书时连同证书目录一并删除。
- 生成与上传接口开启审计但 `recordBody:false`，避免私钥进入审计日志。
- 定时任务 `sslCertificateInspection` 每天 9 点巡检：存在已过期或 30 天内到期的证书时，经通知中心事件 `ops.ssl.cert_expiring` 汇总通知平台管理员（按天幂等，任务重跑不重复打扰）。

## 维护模式

`/api/maintenance` 提供全站维护模式开关（权限 `system:maintenance:manage`，页面 `/system/maintenance`）：`GET /api/maintenance/status` 为公开接口供前端探测；`PUT /api/maintenance` 开启 / 关闭并可设置公告文案与预计结束时间；`GET /api/maintenance/logs` 分页查询维护记录。维护记录落 `maintenance_logs`，由数据保留策略统一清理。详见[维护模式](../backend/maintenance-mode.md)。
