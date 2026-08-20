# 系统运维

Zenith Admin 提供一站式服务器运维能力，无需额外运维工具即可在页面内管理工作机。运维区覆盖 Web SSH 终端、终端录屏、文件管理、进程与端口、Docker、网络诊断、systemd 服务、日志查看、数据库管理与备份、防火墙、Nginx 站点、SSL 证书和维护模式等场景，统一接入后台登录态、权限码与审计能力。

---

## 能力总览

| 模块 | 能力 |
|------|------|
| Web 终端 | 基于 WebSocket + xterm.js 的本机 / SSH / Docker exec 终端，支持多 Tab、多分屏、尺寸同步、断线重连、输出缓冲回放 |
| SSH 配置 | 按用户隔离 SSH 配置档案，支持密码、服务端私钥路径、私钥内容、ssh-agent、环境变量、分组和标签 |
| 终端会话 | 活动终端会话监控，支持按关键字与类型筛选、旁观、接管输入、强制终止 |
| 终端录屏 | 终端输入输出事件录制、列表查询、回放、命令提取、删除和按系统配置自动清理 |
| SFTP / 文件管理 | 远程 SFTP 文件浏览与传输；本机文件管理器支持上传 / 下载、新建、编辑、移动、复制、删除、chmod、ZIP 压缩、解压、搜索和校验和 |
| 进程管理 | 进程列表实时推送、资源占用、详情、网络连接、结束进程、优先级调整 |
| 端口监听 | 监听端口列表、协议筛选、常见端口服务名识别、进程关联、自动刷新、结束占用进程 |
| Docker 管理 | 容器、镜像、网络、卷管理，支持启停、重启、删除、拉取、创建、实时日志、资源占用、inspect 与 prune 清理 |
| 网络诊断 | ping、traceroute、nslookup、DNS 记录、反向 DNS、HTTP(S) 探测、TCP 端口检测、本机网卡信息 |
| systemd 服务 | systemd 可用性检查、服务列表、启停、重启、reload、enable / disable、mask / unmask、详情与 journalctl 日志 |
| 日志查看 | 指定路径 tail -f、ANSI 渲染、级别高亮、关键词过滤、下载；服务端日志文件列表、查看、实时追踪（可暂停）、正则与 grep 搜索、复制导出、下载、删除 |
| 数据库管理 | 页面内数据库工作台：表浏览与行级增删改、只读 SQL 查询与取消、EXPLAIN、查询历史与收藏、导入导出、ER 图、索引健康、Schema 漂移对照、活动连接管理、表维护 |
| 数据库备份 | pg_dump / Drizzle 数据导出两种备份方式，异步执行，产物自动上传默认文件存储 |
| 防火墙 | 自动探测 ufw / firewalld / iptables，状态查看、规则增删、防火墙启停 |
| Nginx 站点 | 站点列表与详情、模板化建站、配置在线编辑、启用 / 禁用、`nginx -t` 测试与 reload |
| SSL 证书 | 自签名证书生成、自定义证书上传、openssl 解析、到期状态跟踪、下载与删除 |
| 维护模式 | 一键开启 / 关闭全站维护，公开状态查询与维护记录（详见[维护模式](../backend/maintenance-mode.md)） |
| 告警中心 | 顶级「告警中心」统一管理告警规则与告警事件，覆盖基础设施（含日志级别频率）、流程引擎、支付与开放平台四类指标，详见下文[告警中心](#告警中心) |

---

## Web SSH 终端

Web 终端入口为「系统运维 → Web 终端」（`/system/terminal`），后端 WebSocket 挂载在：

- `GET /api/ws/terminal?token=<accessToken>&shell=<shell>&cwd=<cwd>[&sessionId=<id>]`
- `GET /api/ws/terminal-monitor?token=<accessToken>&sessionId=<id>&takeover=1`

会话标识由服务端生成（UUIDv7），客户端无法自选：

- 不带 `sessionId` 连接表示新建会话，服务端通过 `terminal:session` 消息下发权威标识；
- 带 `sessionId` 连接表示重连，仅当该会话存在且归属本人时接入，否则一律拒绝（关闭码 `4004`），绝不按客户端给定的标识创建会话；
- 单用户活动会话数上限为 20，超限时以关闭码 `4008` 拒绝。

活动会话的运行态由 `terminal-session-registry.ts` 维护为进程内注册表，元数据落库在 `terminal_sessions` 表（见下文[会话记录](#会话记录)）。会话类型包括：

| 类型 | 说明 |
|------|------|
| `local` | 本机 PTY，shell 来源于 `/api/terminal-files/shells` 探测结果 |
| `ssh` | 使用 `ssh_profiles` 中的连接配置建立 SSH shell |
| `docker` | 通过 `docker exec -it` 进入容器内 `/bin/sh` |

### 终端交互

- 前端使用 xterm.js、FitAddon、WebLinksAddon、SearchAddon。
- 终端输入通过 `terminal:input` 消息写入后端进程，输出通过 `terminal:output` 回写前端。
- 窗口尺寸变化通过 `terminal:resize` 同步列数与行数。
- 客户端发送 `terminal:close` 时立即销毁会话。
- WebSocket 意外断开后，服务端保留进程 5 分钟，使用相同 `sessionId` 重连时回放输出缓冲区；超时未重连则回收进程并把记录标记为结束。
- 输出缓冲上限为 50 KB，用于断线重连和监控接入时回放。

### 会话记录

`terminal_sessions` 表是活动与历史会话的权威元数据，用于事后追溯「谁、何时、连到哪、怎么结束的」：

| 字段 | 说明 |
|------|------|
| `id` | 服务端生成的 UUIDv7 会话标识 |
| `user_id` / `tenant_id` | 归属用户与租户，监控 / 接管 / 终止均按此隔离 |
| `kind` / `target` / `label` | 会话类型、连接目标与展示标签 |
| `client_ip` | 发起连接的客户端 IP |
| `node_id` | 承载该会话进程的服务实例（`hostname:port`） |
| `state` | `active` / `detached` / `terminated` / `failed` |
| `cols` / `rows` | 终端字符网格 |
| `started_at` / `last_activity_at` / `ended_at` | 开始、最近活跃与结束时间 |
| `end_reason` | 结束原因，如 `client_closed`、`process_exited`、`idle_timeout`、`terminated_by_admin`、`server_shutdown`、`start_failed` |

会话进程只存活在创建它的 Node 实例内存中：

- 服务启动时会结算本实例上一轮遗留的 `active` / `detached` 记录（标记为 `failed` + `server_shutdown`），避免出现永远「连接中」的幽灵会话；
- 运行期每 30 秒回写一次活跃时间与终端尺寸；
- 优雅停机时结束全部会话，连带回收进程组，防止 shell 子进程残留。

### 多分屏与工作区

前端 `TerminalPage` 使用 pane tree 管理布局，支持：

- 多 Tab 会话；
- 水平 / 垂直分屏；
- 分屏尺寸调整；
- 面板关闭与焦点切换；
- 本机文件树、SSH 配置、SFTP 浏览、Docker 容器浏览侧栏；
- 终端内 Ctrl / Command + F 搜索，支持大小写切换、上一条 / 下一条。

### SSH 配置档案

SSH 配置接口挂载在 `/api/ssh-profiles`，权限码为 `system:terminal:execute`。配置存储在 `ssh_profiles` 表，关键字段包括：

| 字段 | 说明 |
|------|------|
| `user_id` | 配置归属用户，列表与连接均按用户隔离 |
| `name` / `host` / `port` / `username` | 连接名称、主机、端口、用户名 |
| `auth_type` | `password` / `key_path` / `key_content` / `agent` |
| `password_encrypted` | 加密存储的 SSH 密码 |
| `key_path` | 服务端私钥路径，如 `~/.ssh/id_rsa` |
| `key_content_encrypted` | 加密存储的私钥内容 |
| `key_passphrase_encrypted` | 加密存储的私钥口令 |
| `env_vars` | 连接后写入 SSH shell 的环境变量 |
| `group_name` / `tags` / `order_num` | 分组、标签与排序 |

SSH 敏感字段由服务端加密存储，接口返回 `hasPassword`、`hasKeyContent`、`hasKeyPassphrase` 等布尔标识，不返回明文。

### 会话监控与接管

「终端会话」（`/system/terminal/sessions`）使用权限码 `system:terminal:monitor`。管理员可查看活动会话的用户、类型、标签 / 主机、客户端 IP、尺寸、开始时间、空闲时长、连接状态、旁观人数与接管状态。

监控端通过 `/api/ws/terminal-monitor` 附加为 observer，接入时回放输出缓冲；携带 `takeover=1` 时可向目标会话注入输入，注册表会将会话标记为接管中。强制终止通过 `POST /api/terminal-sessions/:sessionId/terminate` 执行。

---

## 终端录屏

终端录屏由系统配置控制：

| 配置 Key | 默认值 | 说明 |
|----------|--------|------|
| `terminal_recording_enabled` | `false` | 是否启用 Web 终端录屏 |
| `terminal_recording_retain_days` | `30` | 按保留天数自动清理，`0` 表示不按天数清理 |
| `terminal_recording_max_size_mb` | `500` | 录屏总容量上限，`0` 表示不限制容量 |

前端创建终端 session 时读取 `GET /api/system-configs/public/terminal_recording_enabled`。启用后，前端记录终端输入输出事件，并在 WebSocket 关闭时提交到 `POST /api/terminal-recordings`。

录屏数据存储在 `terminal_recordings` 表：

| 字段 | 说明 |
|------|------|
| `title` | 录屏标题 |
| `user_id` / `tenant_id` | 操作人和租户 |
| `shell` | 终端类型或 shell 标识 |
| `cols` / `rows` | 录制时终端尺寸 |
| `duration` | 录制时长，单位秒 |
| `events` | JSONB 事件数组，元素为 `[timeOffset, 'o' \| 'i', data]` |
| `created_at` / `updated_at` | 创建与更新时间 |

「终端录屏」（`/system/terminal/recordings`）支持：

- 按标题关键字查询；
- 分页展示 Shell、终端尺寸、时长、命令数、操作人、录制时间；
- xterm.js 本地回放录屏事件；
- 提取输入事件中的命令并支持复制全部命令；
- 导出 asciinema `.cast` 文件（`GET /api/terminal-recordings/:id/asciinema`），可在 asciinema 生态中回放或分享；
- 删除单条录屏；
- 按 1 / 3 / 6 / 12 个月或全部范围批量清理。

定时任务 `cleanupTerminalRecordings` 每天凌晨 4 点执行，根据 `terminal_recording_retain_days` 和 `terminal_recording_max_size_mb` 从旧到新清理录屏。

---

## SFTP 文件管理器

SFTP 功能复用 SSH 配置档案，接口前缀为 `/api/ssh-sftp/:profileId`，权限码为 `system:terminal:execute`。服务端通过 `ssh2-sftp-client` 建立远程连接，并按 `${userId}:${profileId}` 缓存连接；空闲 2 分钟后自动断开，同一连接上的操作通过队列串行执行。

远程 SFTP 支持：

- 获取远程 home 目录：`GET /api/ssh-sftp/:profileId/home`
- 浏览目录：`GET /api/ssh-sftp/:profileId/list`
- 读取 / 保存文本文件：`GET` / `PUT /api/ssh-sftp/:profileId/content`
- 新建文件或目录：`POST /api/ssh-sftp/:profileId/create`
- 重命名 / 移动：`POST /api/ssh-sftp/:profileId/rename`
- 删除文件或目录：`DELETE /api/ssh-sftp/:profileId/entry`
- chmod 修改权限：`POST /api/ssh-sftp/:profileId/chmod`
- 下载 / 上传：`GET /api/ssh-sftp/:profileId/download`、`POST /api/ssh-sftp/:profileId/upload`

远程文本编辑有 5 MB 上限，并会拒绝二进制文件。目录列表返回名称、路径、类型、大小、修改时间和权限字符串。

同一运维区还提供本机「文件管理器」（`/system/file-manager`），接口前缀为 `/api/terminal-files`，同样使用 `system:terminal:execute` 权限。它面向服务器本机文件系统，能力包括：

| 能力 | 接口 |
|------|------|
| 根信息与盘符 | `GET /api/terminal-files/root-info` |
| 目录浏览 | `GET /api/terminal-files/list` |
| 上传 / 下载 | `POST /api/terminal-files/upload`、`GET /api/terminal-files/download` |
| 文本读取 / 保存 | `GET` / `PUT /api/terminal-files/content` |
| 新建 / 重命名 / 删除 | `POST /create`、`POST /rename`、`DELETE /entry` |
| 移动 / 复制 | `POST /move`、`POST /copy` |
| ZIP 压缩 | `POST /compress`，提交异步任务 |
| 解压 | `POST /extract`，提交异步任务，支持 `zip`、`tar`、`tar.gz`、`tgz`、`tar.bz2`、`tar.xz`、单文件 `gz` |
| chmod | `POST /chmod` |
| 校验和 | `GET /checksum`，算法为 `md5` / `sha1` / `sha256` |
| 递归搜索 | `GET /search`，广度优先搜索文件名，最多返回 200 条，触顶返回 `truncated` |
| 目录大小 | `GET /dir-size`，递归统计目录占用，触顶返回 `truncated` |

本机文件编辑同样限制 5 MB，并拒绝二进制文件；删除操作禁止删除系统根目录和当前用户主目录本身。

### 文件写入与并发编辑

本机与 SFTP 的文本保存共用 `lib/fs-text.ts` 的约束与写入策略：

- **原子写**：先写同目录临时文件、还原权限位，再 `rename` 覆盖。直接覆盖写在中途崩溃或磁盘写满时会留下被截断的文件——对正在线上编辑的 `nginx.conf` 之类配置足以直接造成故障。SFTP 侧优先使用 OpenSSH 的 `posix-rename` 扩展，不支持时回退为先删后改。
- **冲突检测**：读取接口返回 `etag`（mtime + 大小），保存时回传 `baseEtag`；服务端发现版本已变化即返回 **409**，前端提示重新加载，而不是静默覆盖他人的修改。不传 `baseEtag` 表示强制覆盖。

### 上传大小上限

`terminal_upload_max_size_mb`（默认 200，0 表示不限制）同时约束文件管理器与 SFTP 上传。路由层先按 `Content-Length` 预检，服务层再以实际文件大小为准。该链路当前仍会把上传体读入内存，因此该上限即内存占用的封顶值。

### 长耗时操作

压缩与解压在 GB 级归档上可运行数分钟，已接入任务中心（任务类型 `terminal-file-compress` / `terminal-file-extract`）：可查看进度、随时取消、事后追溯。目录统计与文件名搜索仍是同步接口——它们是详情面板与搜索框里的即时查询，改为「提交任务再回来看结果」反而更难用；其无界延迟由节点数与时间预算（10 秒）约束，触顶时通过 `truncated` 明确告知结果不完整。

---

## 进程管理

「进程管理」（`/system/processes`）使用权限码：

| 权限码 | 说明 |
|--------|------|
| `system:process:view` | 查看进程列表、详情和导出 |
| `system:process:kill` | 结束进程 |
| `system:process:priority` | 调整进程优先级 |

后端 `/api/processes` 根据运行平台采集进程：

- Linux / macOS 使用 `ps`，Linux 详情补充 `/proc/:pid/environ` 与 `/proc/:pid/cwd`；
- Windows 使用 PowerShell `Get-Process` 和 `Win32_Process`；
- 监听端口按 PID 缓存 15 秒并合并到进程列表；
- 进程详情包含 PID、父 PID、用户、状态、CPU、内存、线程数、nice / priorityClass、启动时间、命令行、端口、网络连接、工作目录与环境变量。

实时列表通过 `GET /api/processes/stream` 以 SSE 推送，首帧返回完整列表，之后每 3 秒刷新一次，并每 30 秒发送心跳。页面支持关键字与状态筛选、详情弹窗、结束进程和优先级调整。

结束进程时：

- Windows 使用 `Stop-Process -Id <pid> -Force`；
- Linux / macOS 支持 `SIGTERM`、`SIGKILL`、`SIGINT`、`SIGHUP`；
- Linux / macOS 优先级调整使用 `renice`，Windows 使用 `PriorityClass`。

---

## 端口监听

「端口监听」（`/system/ports`）调用 `/api/ports` 获取监听端口列表，查看权限复用 `system:process:view`，结束占用进程使用 `system:process:kill`。

端口采集方式：

- Linux / macOS 优先使用 `ss -tlnp`，回退到 `netstat -tlnp`；
- Windows 使用 `netstat -ano`；
- 返回协议、本地地址、本地端口、状态、PID、进程名和服务名。

服务名由内置常见端口映射识别，例如 `22 → SSH`、`80 → HTTP`、`443 → HTTPS`、`5432 → PostgreSQL`、`6379 → Redis`、`5173 → Vite`、`3300 → Zenith-API`。

前端支持：

- 按 TCP / UDP 协议筛选；
- 按端口、进程、服务、地址关键字过滤；
- 手动刷新或 5 / 10 / 30 秒自动刷新；
- 对存在 PID 的监听项执行「结束进程」。

---

## Docker 管理

「Docker」（`/system/docker`）接口前缀为 `/api/docker`，主要复用 `system:process:view` 权限，并在启停、删除、创建、拉取、清理等操作中写入审计日志。服务端通过 Dockerode 连接 Docker Engine。

### 容器

容器能力包括：

- `GET /api/docker`：容器列表，包含 ID、名称、镜像、命令、创建时间、状态、端口、Compose 项目信息；
- `POST /api/docker/:id/start`、`/stop`、`/restart`：启动、停止、重启；
- `GET /api/docker/:id/logs?tail=500`：读取容器日志；
- `GET /api/docker/:id/stats`：读取 CPU 与内存占用；
- `GET /api/docker/:id/inspect`：返回 `docker inspect` 详情；
- `GET /api/docker/:id/files`、`GET /api/docker/:id/files/content`：浏览与读取容器内文件；
- Web 终端可通过 `docker-exec:<containerId>` 进入容器 shell。

### 镜像、网络、卷

| 对象 | 能力 |
|------|------|
| 镜像 | 列表、删除、按 `repoTag` 拉取 |
| 网络 | 列表、创建、删除 |
| 卷 | 列表、创建、删除 |

### 清理

Docker 清理接口包括：

- `POST /api/docker/prune/containers`：清理已停止容器；
- `POST /api/docker/prune/images`：清理悬空镜像；
- `POST /api/docker/prune/images?all=true`：清理所有未被容器使用的镜像；
- `POST /api/docker/prune/networks`：清理未使用网络；
- `POST /api/docker/prune/volumes`：清理未使用存储卷；
- `POST /api/docker/prune/system`：系统清理，包含已停止容器、悬空镜像和未使用网络。

---

## 网络诊断

「网络诊断」（`/system/network-diag`）接口前缀为 `/api/network-diag`，所有接口需要登录态。

| 能力 | 接口 | 实现 |
|------|------|------|
| ping | `GET /api/network-diag/stream?type=ping&host=...` | Windows 使用 `ping -n 4`，其他平台使用 `ping -c 4 -W 3` |
| traceroute | `GET /api/network-diag/stream?type=traceroute&host=...` | Windows 使用 `tracert -h 30`，其他平台使用 `traceroute -m 30 -w 3` |
| nslookup | `GET /api/network-diag/nslookup?host=...` | 执行 `nslookup` 并返回文本输出 |
| DNS 记录 | `GET /api/network-diag/dns?host=...&type=A` | 支持 `A` / `AAAA` / `MX` / `TXT` / `NS` / `CNAME` / `SOA` |
| 反向 DNS | `GET /api/network-diag/reverse?ip=...` | 使用 PTR 反查主机名 |
| HTTP(S) 探测 | `POST /api/network-diag/http-probe` | 返回状态码、耗时、Server、Content-Type、Content-Length、Location 和错误信息 |
| TCP 端口检测 | `POST /api/network-diag/port-check` | 5 秒超时，返回是否连通与延迟 |
| 本机网卡 | `GET /api/network-diag/interfaces` | 返回网卡名、地址、掩码、IP 版本、MAC、是否内网和 CIDR |

主机名参数会通过正则限制为字母、数字、点、下划线和连字符，避免命令注入。

---

## systemd 服务管理

「服务管理」（`/system/services`）面向 Linux systemd 环境，接口前缀为 `/api/systemd`，所有接口需要登录态。页面先调用 `GET /api/systemd/check` 检查 `systemctl --version` 是否可用；不可用时展示提示。

服务列表来自：

```bash
systemctl list-units --type=service --all --no-pager --plain --no-legend
```

返回字段包括服务名、描述、加载状态、活动状态和子状态。后端列表会移除 `.service` 后缀，控制接口调用时再拼接 `.service`。

支持的操作：

| 操作 | 接口 |
|------|------|
| 启动 / 停止 / 重启 / reload | `POST /api/systemd/:name/start`、`/stop`、`/restart`、`/reload` |
| 开机自启 | `POST /api/systemd/:name/enable` |
| 取消自启 | `POST /api/systemd/:name/disable` |
| 屏蔽服务 | `POST /api/systemd/:name/mask` |
| 取消屏蔽 | `POST /api/systemd/:name/unmask` |
| 服务详情 | `GET /api/systemd/:name/detail` |
| 近期日志 | `GET /api/systemd/:name/logs` |
| 实时日志 | `GET /api/systemd/:name/logs/stream` |

服务详情使用 `systemctl show` 读取 `Id`、`Description`、`LoadState`、`ActiveState`、`SubState`、`UnitFileState`、`MainPID`、`ExecMainStartTimestamp`、`MemoryCurrent`、`CPUUsageNSec`、`Restart`、`FragmentPath`、`TriggeredBy`、`Requires`、`WantedBy` 等字段。

日志读取使用 `journalctl -u <name>.service --output=short-iso`，实时日志使用 `journalctl -f`。前端支持运行中、已停止、失败状态筛选，并在存在失败服务时提供「失败服务」快捷筛选。

---

## 日志查看

系统提供两类日志能力。

### 日志查看器

「日志查看器」（`/system/log-viewer`）面向任意绝对路径日志文件，接口前缀为 `/api/log-viewer`：

| 接口 | 说明 |
|------|------|
| `GET /api/log-viewer/content?path=...&lines=500` | 读取日志末尾内容，最多 5000 行 |
| `GET /api/log-viewer/stream?path=...` | 通过 `tail -f -n 0` 流式追踪 |
| `GET /api/log-viewer/download?path=...` | 下载日志文件，默认最大 100 MB |

前端使用 ANSI 渲染日志行，支持：

- 关键词高亮；
- 仅显示匹配行；
- `ERROR` / `WARN` / `INFO` / `DEBUG` 级别识别、颜色高亮与级别筛选；
- 下载当前日志文件。

### 日志文件

「日志文件」（`/system/log-files`）面向服务端配置的日志目录 `config.log.dir`，接口前缀为 `/api/log-files`。该模块只允许访问目录内的 `.log` 与 `.log.gz` 文件，并通过文件名校验防止路径穿越。

日志中的 ERROR / WARN 频率同时作为监控指标接入告警中心，详见[日志级别频率指标](#日志级别频率指标)。

| 接口 | 权限 | 说明 |
|------|------|------|
| `GET /api/log-files` | `system:log:files` | 日志文件列表 |
| `GET /api/log-files/:filename/content` | `system:log:files` | 读取最后 N 行，支持关键词过滤与 `context` 上下文行（0-10） |
| `GET /api/log-files/:filename/tail` | `system:log:files` | SSE 实时追踪，`.gz` 文件不支持实时追踪 |
| `GET /api/log-files/:filename/download` | `system:log:files:download` | 下载日志文件 |
| `DELETE /api/log-files/:filename` | `system:log:files:delete` | 删除日志文件 |

读取采用 **readline 流式逐行 + 固定容量环形缓冲**，普通日志与 `.gz`（管道 gunzip）走同一条路径，峰值内存为 O(N 行) 而非文件大小——早期实现把整个文件（gz 为解压后全文）读进内存再切行，解压后数百 MB 的归档会有 OOM 风险。`context` 参数在关键词命中行前后各保留 N 行，用于在服务端过滤时保留必要上下文。实时追踪通过轮询文件追加内容实现，周期为 1 秒。

前端查看器特性：

- 虚拟滚动渲染，仅绘制可视区行，最多加载 5000 行（500 / 1000 / 2000 / 5000 可选）；
- 搜索支持**正则表达式**与**区分大小写**切换，无效正则以红框提示并安全降级为无匹配，不会中断渲染；
- 关键词即时高亮（防抖）与上一个 / 下一个匹配导航（Enter / Shift+Enter）；**仅匹配行**（grep 模式）只保留命中行，与级别筛选叠加生效；「全文」模式通过服务端 `keyword` 参数过滤整个文件后返回匹配行，可附带上下文行数；
- `ERROR` / `WARN` / `INFO` / `DEBUG` 级别着色与筛选，级别下拉直接显示各级别行数，无级别标记的堆栈续行继承上一行级别；
- 实时追踪智能跟随：仅当已滚动到底部时自动跟随新日志，向上翻阅不被打断，可一键「回到底部」；支持**暂停 / 继续**——暂停期间新行进积压缓冲（显示积压行数）、可正常搜索定位，恢复后一次性合并，避免边滚边追无法阅读；断线自动重连（连续 3 次失败后停止），重连期间显示状态标签；
- **复制 / 导出**：虚拟滚动下 `Ctrl+A` 只能选到可视区行，因此提供「复制当前视图 / 复制全部 / 导出当前视图为 txt」，复制在无剪贴板权限的环境下回退 `execCommand`；
- 跳到指定行号、回到顶部 / 底部浮动按钮；
- 文件列表支持一键清理全部 `.gz` 归档；
- 选中文件同步到 URL `?file=`，刷新、分享链接与从告警事件跳转均可直达；`?level=` 可预置级别筛选；
- 行号、自动换行、加载行数、上下文行数等偏好本地持久化。

---

## 数据库管理

「数据库管理」（`/system/db-admin`）是页面内的 PostgreSQL 工作台，接口前缀为 `/api/db-admin`。权限码按操作分级：

| 权限码 | 说明 |
|--------|------|
| `system:db-admin:view` | 表结构 / 数据浏览、总览、ER 图、索引健康、对象、查询历史与收藏 |
| `system:db-admin:query` | 执行只读 SQL、取消查询、EXPLAIN |
| `system:db-admin:export` | 表数据与查询结果导出 |
| `system:db-admin:write` | 行级插入 / 更新 / 删除、批量变更、导入、TRUNCATE |
| `system:db-admin:maintain` | 活动连接取消 / 终止、表维护、物化视图刷新 |

### 安全边界

- 用户提交的 SQL 全部在 `BEGIN; SET LOCAL TRANSACTION READ ONLY; ... ROLLBACK;` 只读事务中执行，任何写语句直接被数据库拒绝；
- 每次查询设置 `statement_timeout`（60 秒），防止长查询拖垮数据库；
- 单次查询最多返回 5000 行，超出自动截断；
- 表数据浏览接口对 schema / 表 / 列名做白名单校验，原生 WHERE 片段经额外语句拼接与注释绕过拦截；
- 写入接口拒绝系统 schema（`pg_catalog`、`information_schema` 等）与内置敏感表。

### 能力

- **总览与对象**：数据库版本、大小、连接数等总览（`GET /overview`）；序列 / 函数 / 触发器 / 枚举 / 扩展清单（`GET /objects`）。
- **表浏览与行编辑**：表列表、表结构、分页行数据（支持原生 WHERE 过滤与排序）；插入 / 更新 / 删除行；`POST /batch-mutate` 在单事务中批量插入、更新、删除；`POST /truncate` 截断表。
- **SQL 查询台**：执行只读 SQL（分页返回）、`POST /query/cancel` 取消执行中的查询、`POST /explain` 查看执行计划（EXPLAIN ANALYZE 亦在只读事务中执行）；查询历史（列表 / 删除单条 / 清空）与 SQL 收藏夹 CRUD。
- **导入导出**：`POST /tables/{schema}/{name}/import` 批量导入 CSV / JSON（写权限）；`GET .../export.csv`、`GET .../export.sql` 导出表数据；`POST /query/export.csv`、`POST /query/export.json` 导出查询结果——导出经底层游标分批读取，同样在只读事务内。
- **ER 图**：`GET /er-diagram` 返回所有外键关系，`GET /er-schema` 返回表 + 列 + 外键完整模式，前端渲染交互式 ER 图。
- **健康与维护**：`GET /index-health` 索引健康（无效 / 冗余 / 低使用率索引）；`GET /maintenance/tables` 表维护统计（死元组等）；`POST .../maintenance` 执行 VACUUM / ANALYZE / REINDEX；`POST .../refresh` 刷新物化视图。
- **活动连接**：`GET /activity` 查看 `pg_stat_activity` 活动连接，`POST /activity/{pid}/cancel` 取消查询、`POST /activity/{pid}/terminate` 终止连接。
- **Schema 漂移**：`GET /schema-drift` 将数据库实际结构与 Drizzle schema 对照，发现未迁移的漂移。

---

## 数据库备份

「数据库备份」（`/system/db-backups`）接口前缀为 `/api/db-backups`，记录存储在 `db_backups` 表。

| 权限码 | 说明 |
|--------|------|
| `system:db-backup:list` | 备份列表 |
| `system:db-backup:create` | 创建备份 |
| `system:db-backup:delete` | 删除备份记录 |

- 备份类型两种：`pg_dump`（调用 pg_dump 生成 SQL 转储）与 `drizzle_export`（应用层数据导出）。
- 创建后立即返回 `pending`，备份任务异步执行：置 `running` → 生成备份文件（服务端 `storage/backups/` 目录）→ 上传到默认文件存储并登记 `managed_files`（无默认存储时仅保留本地文件）→ 置 `success` / `failed` 并记录文件大小与耗时。
- 列表支持按状态（`pending / running / success / failed`）与类型筛选，展示发起人、开始 / 完成时间、耗时、文件大小。

---

## 防火墙管理

「防火墙管理」（`/system/firewall`）接口前缀为 `/api/firewall`，查看用 `system:firewall:view`，规则管理与启停用 `system:firewall:manage`（全部写操作记录审计）。

- 服务端按 `ufw → firewalld → iptables` 顺序自动探测防火墙后端，返回类型与版本；Windows 平台返回模拟数据、写操作为空操作。
- `GET /api/firewall` 返回防火墙状态（类型、版本、是否启用），`GET /api/firewall/rules` 返回规则列表（方向、协议、端口、来源 / 目标、备注）。
- `POST /api/firewall/rules` 添加规则、`DELETE /api/firewall/rules/:id` 删除规则，入参端口 / 来源 / 目标经清洗与备注消毒后才拼接命令。
- `POST /api/firewall/enable`、`POST /api/firewall/disable` 启停防火墙。

---

## Nginx 站点管理

「Nginx 站点」（`/system/nginx-sites`）接口前缀为 `/api/nginx-sites`。权限码：`system:nginx:view`（查看）、`system:nginx:manage`（建站 / 编辑 / 删除 / 启停）、`system:nginx:reload`（重载）。

- `GET /api/nginx-sites/info` 返回 Nginx 安装状态、版本、配置目录与 `systemctl is-active` 运行状态；Windows 返回模拟数据。
- 自动适配两种目录布局：`sites-available` + `sites-enabled` 软链模式（Debian 系），或 `conf.d` / `servers` 单目录模式（启用 / 禁用通过 `.conf` ↔ `.conf.disabled` 重命名实现）。
- 站点列表解析每个配置的 `server_name`、监听端口、根目录与是否启用 SSL；详情返回完整配置内容。
- `POST /api/nginx-sites` 按模板生成 server 块创建站点（监听端口、server_name、SSL 证书路径、反向代理 `proxy_pass` 或静态 `root`）；`PUT /api/nginx-sites/:name` 直接保存配置文件内容。
- `POST /api/nginx-sites/test` 执行 `nginx -t` 返回校验结果；`POST /api/nginx-sites/reload` 重载 Nginx。
- 站点增删改与启停全部记录审计（前后配置快照）。

---

## SSL 证书管理

「SSL 证书」（`/system/ssl-certificates`）接口前缀为 `/api/ssl-certificates`，证书元数据存储在 `ssl_certificates` 表。权限码：`system:ssl:view`（查看 / 下载）、`system:ssl:create`（生成 / 上传）、`system:ssl:delete`（删除）。

- `POST /generate` 用 openssl 生成自签名证书（`cert.pem` / `key.pem` 落盘到证书目录，可指定输出目录）；`POST /upload` 上传自定义 PEM 证书与私钥。
- 证书通过 `openssl x509` 解析签发者、主题、有效期、指纹与序列号；解析失败返回 400（Windows 无 openssl 时优雅降级）。
- 状态按剩余有效期自动计算并回写：`valid` / `expiring`（≤ 30 天）/ `expired` / `invalid`，列表返回 `daysRemaining`。
- 列表支持按名称 / 域名关键字与类型（`self_signed` / `uploaded` / `letsencrypt`）筛选。
- `GET /:id/download?kind=cert|key` 下载证书或私钥文件；删除证书时连同证书目录一并删除。
- 生成与上传接口开启审计但 `recordBody:false`，避免私钥进入审计日志。

---

## 维护模式

`/api/maintenance` 提供全站维护模式开关（权限 `system:maintenance:manage`，页面 `/system/maintenance`）：`GET /api/maintenance/status` 为公开接口供前端探测；`PUT /api/maintenance` 开启 / 关闭并可设置公告文案与预计结束时间；`GET /api/maintenance/logs` 分页查询维护记录。详见[维护模式](../backend/maintenance-mode.md)。

---

## 告警中心

告警中心是独立顶级菜单，不归属于系统运维。告警引擎（`monitor-alert.service.ts`）由定时任务每 30 秒评估一次启用规则：达阈触发、指标恢复后自动解除，支持「持续 N 分钟超阈才触发」抑制毛刺、静默期抑制重复通知，并按邮件 / Webhook / 站内信三渠道派发。

规则的“告警状态”表示当前是否已触发：`ok` 在页面显示“未触发”，`firing` 显示“告警中”；“启用状态”独立控制规则是否参与定时评估。停用规则会关闭该规则尚未恢复的告警事件，并清除触发态与持续超阈计时；再次启用后从新的评估周期开始。

指标全集是 `@zenith/shared/platform` 的 `MONITOR_METRICS`（枚举 SSOT）——pgEnum、Zod 校验、告警消息格式化与前端下拉全部由它派生，新增指标只需在此登记一项并在快照采集处补一个取数：

| 分组 | 指标 | 口径 | 单位 |
| --- | --- | --- | --- |
| 基础设施 | CPU / 内存 / 磁盘 / Swap / 负载 / 进程 CPU / 堆内存 / 事件循环延迟 / QPS / HTTP 错误率 / 网络上下行 / 磁盘读写 | 宿主机与进程采样器即时值 | % · 字节/秒 · ms |
| 基础设施 | 日志 ERROR 频率 / 日志 WARN 频率 | 近 5 分钟应用日志对应级别平均每分钟条数，见下文[日志级别频率指标](#日志级别频率指标) | 条/分钟 |
| 流程引擎 | 健康分 / 队列积压 / 死信数 / 失败率 / 卡死数 | 见[工作流监控与运维](../workflow/monitoring-operations.md) | 分 · 项 · % |
| 支付 | 支付失败率 | 近 60 分钟到达终态订单中失败占比（分母为成功 + 失败，不含用户放弃的关单） | % |
| 支付 | 支付卡单数 | 进入「支付中」超过 30 分钟仍无终态的订单数，通常意味着渠道回调链路异常 | 项 |
| 支付 | 对账差异待处理 | 对账明细中 `handle_status = pending` 的差异条目数 | 项 |
| 支付 | 支付事件积压 | 待派发超过 5 分钟 + 重试耗尽已置失败的支付事件数 | 项 |
| 支付 | 支付回调失败率 | 近 60 分钟商户 Webhook 投递失败占比 | % |
| 开放平台 | 开放 API 错误率 | 近 60 分钟全部开放 API 调用失败占比 | % |
| 开放平台 | 单应用最高错误率 | 近 60 分钟按应用统计的最高错误率，仅统计调用量 ≥ 20 次的应用 | % |
| 开放平台 | 应用 Webhook 失败率 | 近 60 分钟应用事件 Webhook 投递失败占比 | % |
| 开放平台 | 自动停用订阅数 | 因连续投递失败被自动停用的订阅数 | 项 |

指标取值统一由 `monitor-history.service.ts` 的 `getCurrentMetricSnapshot(tenantId)` 汇总，各业务域只提供自己的「告警指标源」函数（如 `payment-alert-metrics.service.ts`）。

### 日志级别频率指标

`logErrorPerMin` / `logWarnPerMin` 统计**近 5 分钟应用日志对应级别的平均每分钟条数**，用于把日志异常纳入统一告警闭环。

它补足的是 `errorRate` 的盲区：后者只统计 HTTP 5xx，而后台任务、事件订阅者、worker 与启动期的错误根本不经过 HTTP，只会出现在日志里——这类故障过去只能靠人工翻日志发现。

实现上计数发生在 **winston Transport 写入点**（`lib/log-metrics.ts`），不扫描日志文件：

- 零文件 I/O 与解析开销，不受日志轮转、gzip 归档影响；
- 按 epoch 分钟分桶的滚动窗口，读写时惰性淘汰过期桶，内存恒定为 5 个桶；
- 与 `metricsSampler` 的 qps / errorRate 同属**进程内口径**：多实例部署时各实例只统计自身，与其他基础设施指标一致；
- 计数失败不影响日志写入，日志链路永远优先。

因为是「频率」而非「总数」，阈值与业务量无关，可直接沿用内置默认值。两条内置规则：ERROR ≥ 10 条/分持续 3 分钟（严重）、WARN ≥ 30 条/分持续 5 分钟（警告）。

**与日志文件页联动**：这两个指标触发的告警事件，操作列提供「查看日志」（需 `system:log:files` 权限），按事件触发日期跳转到 `/system/log-files?file=app-YYYY-MM-DD.log&level=error`，直达当天日志并预置级别过滤；当天文件已轮转归档时自动回退到对应的 `.gz`。从「收到告警」到「看到出错日志」不再需要手动找文件。

**租户口径**：`MONITOR_METRIC_META` 的 `scope` 声明每个指标是 `global`（宿主机 / 平台级，所有规则同值）还是 `tenant`（业务指标，按规则所属租户过滤）。评估器按规则涉及的租户集合分组取快照，因此租户级规则不会拿到全平台的业务数据；`tenantId` 为空的平台级规则统计全平台汇总。

**通知渠道**：接收目标拆为 `recipientUserIds` 与 `recipientEmails`。系统用户通过专用下拉选择并持久化稳定的用户 ID：站内信直接按 ID 投递，邮件渠道在每次派发时读取用户账号的当前邮箱，因此用户改邮箱后无需修改规则；未配置邮箱的用户仍可接收站内信。`recipientEmails` 只保存群组邮箱、外部联系人等不绑定系统账号的额外地址，派发时与用户邮箱去重。接收用户接口只返回姓名、账号、部门和“是否有邮箱”，不向告警页面暴露邮箱原文。

**通知投递结果**：`dispatchAlertChannels` 返回本次派发的真实结果，评估器回写到事件行的 `notify_status` / `notify_channels` / `notify_error` / `notified_at`，告警事件页以「通知状态」列展示，失败原因在 tooltip 中给出。四种状态：

| 状态 | 含义 |
| --- | --- |
| `skipped` | 规则没有配置任何可派发的渠道，本次未尝试通知 |
| `success` | 所有已配置渠道均投递成功 |
| `partial` | 部分渠道失败 |
| `failed` | 全部渠道失败 |

`skipped` 与失败是两回事，混为一谈会让「配了渠道却没人收到」无法从列表上被发现。同理，「邮件接收目标没有可用邮箱」与「站内信未匹配到启用用户」计为该渠道失败而非跳过——这正是用户配置看起来正确却收不到通知的典型成因。重复通知与恢复通知不新建事件，其投递结果回写到该规则当前未恢复的事件上。

**筛选与批量操作**：规则列表支持按名称关键词、指标、级别、启用状态与告警状态筛选，事件列表支持关键词（规则名 / 描述）、指标、级别、告警状态、通知状态、处理状态与触发时间范围筛选，条件全部下推服务端，与分页总数口径一致。规则支持批量删除与批量启停；批量启用会逐条校验投递配置，任一条不合格即整批拒绝，不做部分成功。告警规则的「查看事件」跳转到 `/alerts/events?ruleId=N` 做规则联查。事件列表可经导出中心导出（实体 `alert.monitor-alert-events`，权限 `alert:event:export`），导出条件与当前筛选一致。

**人工处理闭环**：事件的 `handle_status`（`pending` / `acknowledged` / `closed`）与系统判定的 `status`（`firing` / `resolved`）**正交**。指标自己掉回阈值下方只说明系统恢复了，不代表有人看过、查过原因；把两者合成一个状态会让「没人管的告警」被自动恢复悄悄掩盖。

| 动作 | 效果 |
| --- | --- |
| 认领 | `handle_status` 置 `acknowledged`，记录处理人与时间 |
| 标记已处理 | 置 `closed`；系统仍按指标独立判断是否恢复 |
| 撤销认领 | 置回 `pending`，清空处理人、备注与确认时间，事件重新回到待处理池 |

`acknowledged_at` 只在**首次**响应时写入并保持不变——它是 MTTA 的分子，被后续的「关闭」覆盖会让确认耗时统计失真；直接关闭同样算一次响应。支持单条与批量处理，批量逐条走租户校验。

**试发通知**：`POST /api/monitor-alerts/{id}/test`（权限 `alert:rule:test`）用规则当前的渠道与接收人发一条测试消息，直接返回派发结果，前端按「已送达 / 部分失败 / 全部失败 / 未配置渠道」分级提示并列出失败原因。该操作**不写事件表、不改规则运行态与 `last_triggered_at`**：一次配置验证不应出现在告警历史里，更不能顶掉静默期让真实告警被抑制。

**告警概览**：`/alerts/overview`（权限 `alert:overview:list`）汇总当前告警中数量（按级别）、待处理数与最久未认领时长、时间范围内的触发 / 恢复 / 通知失败数、MTTA、MTTR、按天趋势与触发最频繁的 TOP 5 规则；统计卡点击直达告警事件页的对应筛选。工作台在有该权限时展示同一份数据的紧凑版。

`SEED_MONITOR_ALERT_RULES` 预置了 16 条开箱规则，覆盖基础设施容量兜底、日志异常频率与支付、开放平台、流程引擎的关键失效信号，默认全部走站内信发给管理员用户 ID 1，部署方按需在页面上调整阈值与渠道。

---

## 接口一览

| 模块 | 方法与路径 | 说明 |
|------|------------|------|
| Web 终端 | `GET /api/ws/terminal` | 本机 / SSH / Docker 终端 WebSocket |
| 会话监控 | `GET /api/ws/terminal-monitor` | 旁观与接管终端会话 |
| SSH 配置 | `GET /api/ssh-profiles` | 我的 SSH 配置列表 |
| SSH 配置 | `GET /api/ssh-profiles/:id` | SSH 配置详情 |
| SSH 配置 | `POST /api/ssh-profiles` | 创建 SSH 配置 |
| SSH 配置 | `PUT /api/ssh-profiles/:id` | 更新 SSH 配置 |
| SSH 配置 | `DELETE /api/ssh-profiles/:id` | 删除 SSH 配置 |
| SFTP | `GET /api/ssh-sftp/:profileId/home` | 获取远程 home |
| SFTP | `GET /api/ssh-sftp/:profileId/list` | 远程目录列表 |
| SFTP | `GET /api/ssh-sftp/:profileId/content` | 读取远程文本文件 |
| SFTP | `PUT /api/ssh-sftp/:profileId/content` | 保存远程文本文件 |
| SFTP | `POST /api/ssh-sftp/:profileId/create` | 新建远程文件或目录 |
| SFTP | `POST /api/ssh-sftp/:profileId/rename` | 重命名 / 移动远程文件或目录 |
| SFTP | `DELETE /api/ssh-sftp/:profileId/entry` | 删除远程文件或目录 |
| SFTP | `POST /api/ssh-sftp/:profileId/chmod` | 修改远程权限 |
| SFTP | `GET /api/ssh-sftp/:profileId/download` | 下载远程文件 |
| SFTP | `POST /api/ssh-sftp/:profileId/upload` | 上传远程文件 |
| 终端文件 | `GET /api/terminal-files/root-info` | 文件系统根信息 |
| 终端文件 | `GET /api/terminal-files/list` | 目录列表 |
| 终端文件 | `GET /api/terminal-files/download` | 下载文件 |
| 终端文件 | `POST /api/terminal-files/upload` | 上传文件 |
| 终端文件 | `GET /api/terminal-files/shells` | 可用 shell 列表 |
| 终端文件 | `GET /api/terminal-files/content` | 读取文本文件 |
| 终端文件 | `PUT /api/terminal-files/content` | 保存文本文件 |
| 终端文件 | `POST /api/terminal-files/create` | 新建文件或目录 |
| 终端文件 | `POST /api/terminal-files/rename` | 重命名 / 移动 |
| 终端文件 | `DELETE /api/terminal-files/entry` | 删除文件或目录 |
| 终端文件 | `POST /api/terminal-files/move` | 移动文件或目录 |
| 终端文件 | `POST /api/terminal-files/copy` | 复制文件或目录 |
| 终端文件 | `POST /api/terminal-files/compress` | 压缩为 ZIP |
| 终端文件 | `POST /api/terminal-files/chmod` | chmod |
| 终端文件 | `POST /api/terminal-files/extract` | 解压 |
| 终端文件 | `GET /api/terminal-files/checksum` | 文件校验和 |
| 终端文件 | `GET /api/terminal-files/search` | 递归搜索文件名 |
| 终端文件 | `GET /api/terminal-files/dir-size` | 递归统计目录大小 |
| 终端录屏 | `GET /api/terminal-recordings` | 录屏分页列表 |
| 终端录屏 | `POST /api/terminal-recordings` | 保存录屏 |
| 终端录屏 | `GET /api/terminal-recordings/:id` | 录屏详情 |
| 终端录屏 | `GET /api/terminal-recordings/:id/asciinema` | 导出 asciinema `.cast` 文件 |
| 终端录屏 | `DELETE /api/terminal-recordings/:id` | 删除录屏 |
| 终端录屏 | `DELETE /api/terminal-recordings/clean` | 清除录屏记录 |
| 终端会话 | `GET /api/terminal-sessions` | 活动终端会话列表 |
| 终端会话 | `POST /api/terminal-sessions/:sessionId/terminate` | 强制终止会话 |
| 进程 | `GET /api/processes` | 进程列表 |
| 进程 | `GET /api/processes/stream` | SSE 实时进程列表 |
| 进程 | `GET /api/processes/:pid` | 进程详情 |
| 进程 | `DELETE /api/processes/:pid` | 结束进程 |
| 进程 | `PUT /api/processes/:pid/priority` | 调整优先级 |
| 端口 | `GET /api/ports` | 监听端口列表 |
| 端口 | `DELETE /api/ports/{pid}` | 结束占用端口的进程 |
| Docker | `GET /api/docker` | 容器列表 |
| Docker | `POST /api/docker/:id/start` / `stop` / `restart` | 控制容器 |
| Docker | `GET /api/docker/:id/logs` | 容器日志 |
| Docker | `GET /api/docker/:id/stats` | 容器资源占用 |
| Docker | `GET /api/docker/:id/inspect` | 容器详情 |
| Docker | `GET /api/docker/images` | 镜像列表 |
| Docker | `POST /api/docker/images/pull` | 拉取镜像 |
| Docker | `DELETE /api/docker/images/:id` | 删除镜像 |
| Docker | `GET /api/docker/networks` | 网络列表 |
| Docker | `POST /api/docker/networks` | 创建网络 |
| Docker | `DELETE /api/docker/networks/:id` | 删除网络 |
| Docker | `GET /api/docker/volumes` | 卷列表 |
| Docker | `POST /api/docker/volumes` | 创建卷 |
| Docker | `DELETE /api/docker/volumes/:name` | 删除卷 |
| Docker | `GET /api/docker/:id/files` | 容器内目录列表 |
| Docker | `GET /api/docker/:id/files/content` | 读取容器内文件 |
| Docker | `POST /api/docker/prune/*` | 容器 / 镜像 / 网络 / 卷 / 系统清理 |
| 网络诊断 | `GET /api/network-diag/stream` | ping / traceroute 流式输出 |
| 网络诊断 | `GET /api/network-diag/nslookup` | nslookup |
| 网络诊断 | `GET /api/network-diag/dns` | DNS 记录查询 |
| 网络诊断 | `GET /api/network-diag/reverse` | 反向 DNS |
| 网络诊断 | `POST /api/network-diag/http-probe` | HTTP(S) 探测 |
| 网络诊断 | `POST /api/network-diag/port-check` | TCP 端口检测 |
| 网络诊断 | `GET /api/network-diag/interfaces` | 本机网卡信息 |
| systemd | `GET /api/systemd/check` | systemd 可用性 |
| systemd | `GET /api/systemd` | 服务列表 |
| systemd | `POST /api/systemd/:name/:action` | 控制服务 |
| systemd | `GET /api/systemd/:name/detail` | 服务详情 |
| systemd | `GET /api/systemd/:name/logs` | 近期日志 |
| systemd | `GET /api/systemd/:name/logs/stream` | 实时日志 |
| 日志查看器 | `GET /api/log-viewer/content` | 读取指定路径日志末尾 |
| 日志查看器 | `GET /api/log-viewer/stream` | tail -f 指定路径日志 |
| 日志查看器 | `GET /api/log-viewer/download` | 下载指定路径日志 |
| 日志文件 | `GET /api/log-files` | 日志文件列表 |
| 日志文件 | `GET /api/log-files/:filename/content` | 读取日志文件 |
| 日志文件 | `GET /api/log-files/:filename/tail` | SSE 实时追踪 |
| 日志文件 | `GET /api/log-files/:filename/download` | 下载日志文件 |
| 日志文件 | `DELETE /api/log-files/:filename` | 删除日志文件 |
| 数据库管理 | `GET /api/db-admin/overview` / `objects` / `tables` | 总览、数据库对象、表列表 |
| 数据库管理 | `GET /api/db-admin/tables/:schema/:name/structure` / `rows` | 表结构与分页行数据 |
| 数据库管理 | `POST` / `PATCH` / `DELETE /api/db-admin/tables/:schema/:name/rows` | 行级插入 / 更新 / 删除 |
| 数据库管理 | `POST /api/db-admin/tables/:schema/:name/batch-mutate` | 单事务批量变更行 |
| 数据库管理 | `POST /api/db-admin/tables/:schema/:name/import` | 批量导入 CSV / JSON |
| 数据库管理 | `POST /api/db-admin/tables/:schema/:name/truncate` | 截断表 |
| 数据库管理 | `GET /api/db-admin/tables/:schema/:name/export.csv` / `export.sql` | 导出表数据 |
| 数据库管理 | `POST /api/db-admin/query` / `query/cancel` / `explain` | 只读 SQL 执行、取消、EXPLAIN |
| 数据库管理 | `POST /api/db-admin/query/export.csv` / `export.json` | 导出查询结果 |
| 数据库管理 | `GET` / `DELETE /api/db-admin/query/history` | 查询历史列表与清理 |
| 数据库管理 | `GET` / `POST` / `PUT` / `DELETE /api/db-admin/query-favorites` | SQL 收藏夹 CRUD |
| 数据库管理 | `GET /api/db-admin/er-diagram` / `er-schema` | ER 图数据 |
| 数据库管理 | `GET /api/db-admin/index-health` / `schema-drift` | 索引健康与 Schema 漂移对照 |
| 数据库管理 | `GET /api/db-admin/activity`、`POST /api/db-admin/activity/:pid/cancel` / `terminate` | 活动连接管理 |
| 数据库管理 | `GET /api/db-admin/maintenance/tables`、`POST .../maintenance`、`POST .../refresh` | 表维护与物化视图刷新 |
| 数据库备份 | `GET` / `POST /api/db-backups`、`DELETE /api/db-backups/:id` | 备份列表、创建、删除 |
| 防火墙 | `GET /api/firewall`、`GET` / `POST /api/firewall/rules`、`DELETE /api/firewall/rules/:id` | 状态、规则查询与增删 |
| 防火墙 | `POST /api/firewall/enable` / `disable` | 启停防火墙 |
| Nginx 站点 | `GET /api/nginx-sites`、`GET /api/nginx-sites/info` / `:name` | 站点列表、Nginx 信息、站点详情 |
| Nginx 站点 | `POST` / `PUT` / `DELETE /api/nginx-sites(/:name)` | 创建、编辑、删除站点 |
| Nginx 站点 | `POST /api/nginx-sites/:name/enable` / `disable` | 启用 / 禁用站点 |
| Nginx 站点 | `POST /api/nginx-sites/test` / `reload` | `nginx -t` 测试与重载 |
| SSL 证书 | `GET /api/ssl-certificates(/:id)` | 证书列表与详情 |
| SSL 证书 | `POST /api/ssl-certificates/generate` / `upload` | 生成自签名证书 / 上传证书 |
| SSL 证书 | `GET /api/ssl-certificates/:id/download`、`DELETE /api/ssl-certificates/:id` | 下载与删除 |
| 维护模式 | `GET /api/maintenance/status`（公开）、`GET` / `PUT /api/maintenance`、`GET /api/maintenance/logs` | 状态查询、开关、维护记录 |

---

## 前端页面

系统运维页面由菜单种子 `SEED_MENUS` 配置，主要入口如下：

| 页面 | 路径 | 组件 | 权限 |
|------|------|------|------|
| Web 终端 | `/system/terminal` | `system/terminal/TerminalPage` | `system:terminal:execute` |
| 终端录屏 | `/system/terminal/recordings` | `system/terminal/TerminalRecordingsPage` | `system:terminal:execute` |
| 文件管理器 | `/system/file-manager` | `system/file-manager/FileManagerPage` | `system:terminal:execute` |
| 进程管理 | `/system/processes` | `system/processes/ProcessesPage` | `system:process:view` |
| 端口监听 | `/system/ports` | `system/ports/PortsPage` | `system:process:view` |
| Docker | `/system/docker` | `system/docker/DockerPage` | `system:process:view` |
| 网络诊断 | `/system/network-diag` | `system/network-diag/NetworkDiagPage` | `system:process:view` |
| 服务管理 | `/system/services` | `system/services/ServicesPage` | `system:process:view` |
| 日志查看器 | `/system/log-viewer` | `system/log-viewer/LogViewerPage` | `system:process:view` |
| 终端会话 | `/system/terminal/sessions` | `system/terminal/TerminalSessionsPage` | `system:terminal:monitor` |
| 防火墙管理 | `/system/firewall` | `system/firewall/FirewallPage` | `system:firewall:view` |
| Nginx 站点 | `/system/nginx-sites` | `system/nginx-sites/NginxSitesPage` | `system:nginx:view` |
| SSL 证书 | `/system/ssl-certificates` | `system/ssl-certificates/SslCertificatesPage` | `system:ssl:view` |
| 日志文件 | `/system/log-files` | `system/log-files/LogFilesPage` | `system:log:files` |
| 数据库管理 | `/system/db-admin` | `system/db-admin/DbAdminPage` | `system:db-admin:view` |
| 数据库备份 | `/system/db-backups` | `system/db-backups/DbBackupsPage` | `system:db-backup:list` |
| 维护模式 | `/system/maintenance` | `system/maintenance/MaintenancePage` | `system:maintenance:manage` |

以上页面中，「Web 终端」到「SSL 证书」位于「系统设置 → 系统运维」菜单组；「日志文件」位于「系统设置 → 审计日志」组；「数据库管理」「数据库备份」「维护模式」直接挂在「系统设置」下。

告警能力使用独立顶级菜单：

| 页面 | 路径 | 组件 | 权限 |
|------|------|------|------|
| 告警概览 | `/alerts/overview` | `alerts/overview/AlertOverviewPage` | `alert:overview:list` |
| 告警规则 | `/alerts/rules` | `alerts/rules/AlertRulesPage` | `alert:rule:list` |
| 告警事件 | `/alerts/events` | `alerts/events/AlertEventsPage` | `alert:event:list` |

按钮级权限包括 `system:process:kill`、`system:process:priority`、`system:terminal:monitor`、`system:log:files:download`、`system:log:files:delete`、`system:firewall:manage`、`system:nginx:manage`、`system:nginx:reload`、`system:ssl:create`、`system:ssl:delete`、`system:db-admin:query`、`system:db-admin:export`、`system:db-admin:write`、`system:db-admin:maintain`、`system:db-backup:create`、`system:db-backup:delete` 等。告警中心使用 `alert:rule:create`、`alert:rule:update`、`alert:rule:delete` 管理规则，`alert:rule:test` 试发通知，`alert:event:handle` 处理告警，`alert:event:export` 导出告警事件。

---

## 相关文档

- [功能模块：系统运维](../product/features.md#系统运维)
- [WebSocket 事件](../backend/websocket-events.md)
- [维护模式](../backend/maintenance-mode.md)
- [安全体系](../backend/security.md)
- [系统内置配置](../backend/system-configs.md)
- [定时任务](../backend/cron-jobs.md)
