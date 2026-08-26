# PWA 支持

前端集成 `vite-plugin-pwa`，通过环境变量选择是否在生产构建中生成 Service Worker 与 Manifest。默认关闭。

## 启用方式

创建或编辑 `packages/web/.env.production`：

```ini
VITE_PWA_ENABLED=true
VITE_APP_TITLE=Zenith Admin
VITE_APP_SHORT_NAME=Zenith
VITE_APP_DESCRIPTION=企业级后台管理系统
VITE_APP_THEME_COLOR=#07c160
```

重新构建前端：

```bash
npm run build -w @zenith/web
```

构建产物会包含 `sw.js` 与 `manifest.webmanifest`。

## 当前配置

| 项 | 当前实现 |
| --- | --- |
| 注册策略 | `registerType: 'autoUpdate'` |
| Manifest 名称 | `VITE_APP_TITLE`，默认 `Zenith Admin` |
| Manifest 短名称 | `VITE_APP_SHORT_NAME`，默认 `Zenith` |
| 主题色 | `VITE_APP_THEME_COLOR`，默认 `#07c160` |
| `display` | `standalone` |
| `start_url` / `scope` | `/` |
| 预缓存 | `**/*.{js,css,woff2,png,svg,ico}` |
| API 请求 | `/api/*` 使用 `NetworkOnly`，不缓存业务数据 |
| SPA fallback | `index.html`，排除 `/api/` |
| 开发模式 SW | `devOptions.enabled=false` |

## 图标

默认图标位于：

```text
packages/web/public/icons/icon-192.png
packages/web/public/icons/icon-512.png
```

替换品牌图标时保持 192×192 与 512×512 尺寸。Manifest 中 `icon-512.png` 同时作为 `maskable` 图标。

## 注意事项

- Service Worker 在 HTTPS 或 `localhost` 下工作。
- API 不缓存，后台数据实时性由网络请求保证。
- Electron 构建不依赖 PWA；桌面客户端使用 Electron 自身的更新机制。
- GitHub Pages Demo 站由 `npm run build:demo` 构建，是否启用 PWA 取决于 Demo 构建时注入的环境变量。
