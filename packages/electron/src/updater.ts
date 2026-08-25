/**
 * 在线升级（双层）。
 *
 * 消费服务端「应用版本管理」的公开 API（/api/public/app-releases）：
 *
 *  1. **Web 热更新（高频）**：check 返回 hotupdate 制品 → 下载 zip → SHA256 校验 →
 *     解压到 userData/web-updates/{version} → 提示重载。壳不动，秒级生效。
 *  2. **壳全量更新（低频）**：check 返回 installer 制品 → electron-updater 指向
 *     generic feed（latest.yml / blockmap 布局由服务端按文件名分发）→ 后台下载 →
 *     提示重启安装。仅打包后可用（app.isPackaged）。
 *  3. **外链制品**（如应用商店）→ 打开系统浏览器。
 *
 * 服务器地址来源（优先级）：userData/update-config.json > 渲染进程 IPC 上报
 * （web 包内的 VITE_API_BASE_URL）> 环境变量 ZENITH_UPDATE_SERVER。
 *
 * 灰度与统计：deviceId 首次运行生成并持久化，check / 下载请求都携带；
 * 热更成功与壳更新重启后上报 install_success 回执。
 */
import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import extract from 'extract-zip';
import { autoUpdater } from 'electron-updater';

const APP_KEY = 'zenith-desktop';
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 小时
const INITIAL_DELAY_MS = 15 * 1000;           // 启动后延迟，避免抢占首屏

type UpdateChannel = 'stable' | 'beta' | 'internal';

interface UpdateConfig {
  serverUrl?: string;
  channel?: UpdateChannel;
}

interface UpdateState {
  /** 已应用的 Web 热更版本（高于壳版本时生效） */
  webVersion?: string;
  /** 壳更新触发 quitAndInstall 前记录，重启后据此上报 install_success */
  pendingShellVersion?: string;
}

interface CheckArtifact {
  kind: 'installer' | 'hotupdate' | 'metadata' | 'external';
  fileName: string;
  size: number;
  sha256?: string | null;
  downloadUrl: string;
}

interface CheckResult {
  hasUpdate: boolean;
  mandatory?: boolean;
  version?: string;
  notes?: string | null;
  artifact?: CheckArtifact;
}

// ─── 路径与持久化 ─────────────────────────────────────────────────────────────

const userDataDir = () => app.getPath('userData');
const configPath = () => path.join(userDataDir(), 'update-config.json');
const statePath = () => path.join(userDataDir(), 'update-state.json');
const deviceIdPath = () => path.join(userDataDir(), 'device-id');
const webUpdatesDir = () => path.join(userDataDir(), 'web-updates');

function readJsonSync<T>(file: string): T | null {
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as T;
  } catch {
    return null;
  }
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
}

function loadState(): UpdateState {
  return readJsonSync<UpdateState>(statePath()) ?? {};
}

async function saveState(patch: Partial<UpdateState>): Promise<void> {
  await writeJson(statePath(), { ...loadState(), ...patch });
}

/** 匿名设备标识：首次运行生成并持久化，用于灰度命中与设备数统计 */
function getDeviceId(): string {
  try {
    const existing = readFileSync(deviceIdPath(), 'utf-8').trim();
    if (existing) return existing;
  } catch { /* 首次运行 */ }
  const id = randomUUID();
  void fs.writeFile(deviceIdPath(), id, 'utf-8').catch(() => { /* 下次再生成 */ });
  return id;
}

// ─── 运行时配置（serverUrl / channel）────────────────────────────────────────

let runtimeConfig: UpdateConfig = {};

function getConfig(): UpdateConfig {
  const fileConfig = readJsonSync<UpdateConfig>(configPath()) ?? {};
  return {
    serverUrl: fileConfig.serverUrl || runtimeConfig.serverUrl || process.env.ZENITH_UPDATE_SERVER || '',
    channel: fileConfig.channel || runtimeConfig.channel || 'stable',
  };
}

function normalizeBase(url: string): string {
  return url.replace(/\/+$/, '');
}

// ─── 平台与版本 ───────────────────────────────────────────────────────────────

function platformKey(): 'windows' | 'macos' | 'linux' {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'macos';
  return 'linux';
}

function archKey(): 'x64' | 'arm64' {
  return process.arch === 'arm64' ? 'arm64' : 'x64';
}

function parseSemver(v: string) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function semverGt(a: string, b: string): boolean {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return false;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] > pb[i];
  }
  return false;
}

/** 当前生效版本：已应用的热更版本高于壳版本时取热更版本，避免重复推送同一热更 */
function effectiveVersion(): string {
  const shellVersion = app.getVersion();
  const { webVersion } = loadState();
  return webVersion && semverGt(webVersion, shellVersion) ? webVersion : shellVersion;
}

// ─── Web 资源加载解析（main.ts 创建窗口前调用，必须同步）──────────────────────

/**
 * 解析应加载的前端 index.html：
 * 存在高于壳版本的热更资源时优先加载；壳升级后热更资源过期，回退内置并异步清理。
 */
export function resolveWebIndexPath(): string {
  const bundled = path.join(process.resourcesPath, 'web', 'index.html');
  const { webVersion } = loadState();
  if (!webVersion) return bundled;

  if (semverGt(webVersion, app.getVersion())) {
    const hotIndex = path.join(webUpdatesDir(), webVersion, 'index.html');
    if (existsSync(hotIndex)) return hotIndex;
  }
  // 热更资源过期或缺失：清理状态与目录，回退内置
  void saveState({ webVersion: undefined });
  void fs.rm(webUpdatesDir(), { recursive: true, force: true }).catch(() => { /* 忽略 */ });
  return bundled;
}

// ─── 回执上报 ─────────────────────────────────────────────────────────────────

async function reportEvent(eventType: 'install_success' | 'install_fail', version: string): Promise<void> {
  const { serverUrl, channel } = getConfig();
  if (!serverUrl) return;
  try {
    await fetch(`${normalizeBase(serverUrl)}/api/public/app-releases/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app: APP_KEY,
        eventType,
        channel,
        platform: platformKey(),
        arch: archKey(),
        version,
        deviceId: getDeviceId(),
      }),
    });
  } catch (err) {
    console.warn('[updater] 回执上报失败:', err);
  }
}

// ─── Web 热更新 ───────────────────────────────────────────────────────────────

async function sha256Of(file: string): Promise<string> {
  const buf = await fs.readFile(file);
  return createHash('sha256').update(buf).digest('hex');
}

/** zip 根目录可能是 dist 本体也可能多包一层目录，定位真正的 web 根 */
async function locateWebRoot(dir: string): Promise<string | null> {
  if (existsSync(path.join(dir, 'index.html'))) return dir;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());
  if (dirs.length === 1) {
    const nested = path.join(dir, dirs[0].name);
    if (existsSync(path.join(nested, 'index.html'))) return nested;
  }
  return null;
}

async function applyWebUpdate(win: BrowserWindow | null, info: CheckResult): Promise<void> {
  const { serverUrl } = getConfig();
  const artifact = info.artifact;
  const version = info.version;
  if (!serverUrl || !artifact || !version) return;

  const base = normalizeBase(serverUrl);
  const url = artifact.downloadUrl.startsWith('http') ? artifact.downloadUrl : `${base}${artifact.downloadUrl}`;
  const zipPath = path.join(webUpdatesDir(), `download-${version}.zip`);
  const tmpDir = path.join(webUpdatesDir(), `tmp-${Date.now()}`);
  const targetDir = path.join(webUpdatesDir(), version);

  try {
    await fs.mkdir(webUpdatesDir(), { recursive: true });

    const res = await fetch(`${url}?deviceId=${encodeURIComponent(getDeviceId())}`);
    if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}`);
    await fs.writeFile(zipPath, Buffer.from(await res.arrayBuffer()));

    if (artifact.sha256) {
      const actual = await sha256Of(zipPath);
      if (actual !== artifact.sha256.toLowerCase()) throw new Error('SHA256 校验不通过，已丢弃下载文件');
    }

    // 制品由管理端发布并经过哈希校验，解压视为可信内容
    await extract(zipPath, { dir: tmpDir });
    const webRoot = await locateWebRoot(tmpDir);
    if (!webRoot) throw new Error('热更包内未找到 index.html');

    await fs.rm(targetDir, { recursive: true, force: true });
    await fs.rename(webRoot, targetDir);
    await saveState({ webVersion: version });
    await reportEvent('install_success', version);

    const detail = info.notes ? info.notes.slice(0, 600) : undefined;
    if (info.mandatory) {
      await dialog.showMessageBox({ type: 'info', title: '更新已就绪', message: `新版本 v${version} 已就绪，需要重新加载`, detail, buttons: ['立即重载'] });
      win?.loadFile(path.join(targetDir, 'index.html')).catch(console.error);
      return;
    }
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: '更新已就绪',
      message: `新版本 v${version} 已就绪`,
      detail,
      buttons: ['立即重载', '稍后（下次启动生效）'],
      cancelId: 1,
    });
    if (response === 0) win?.loadFile(path.join(targetDir, 'index.html')).catch(console.error);
  } catch (err) {
    console.error('[updater] Web 热更新失败:', err);
    await reportEvent('install_fail', version);
  } finally {
    await fs.rm(zipPath, { force: true }).catch(() => { /* 忽略 */ });
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => { /* 忽略 */ });
  }
}

// ─── 壳全量更新（electron-updater）───────────────────────────────────────────

let shellUpdateRunning = false;

async function applyShellUpdate(win: BrowserWindow | null, info: CheckResult): Promise<void> {
  const { serverUrl, channel } = getConfig();
  const version = info.version;
  if (!serverUrl || !version) return;
  if (!app.isPackaged) {
    console.info('[updater] 开发模式跳过壳更新（electron-updater 仅打包后可用）');
    return;
  }
  if (shellUpdateRunning) return;
  shellUpdateRunning = true;

  try {
    const detail = info.notes ? info.notes.slice(0, 600) : undefined;
    if (!info.mandatory) {
      const { response } = await dialog.showMessageBox({
        type: 'info',
        title: '发现新版本',
        message: `发现新版本 v${version}，是否后台下载？`,
        detail,
        buttons: ['下载更新', '稍后'],
        cancelId: 1,
      });
      if (response !== 0) return;
    }

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.requestHeaders = { 'x-device-id': getDeviceId() };
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: `${normalizeBase(serverUrl)}/api/public/app-releases/${APP_KEY}/${channel}/${platformKey()}`,
    });

    autoUpdater.removeAllListeners('update-downloaded');
    autoUpdater.removeAllListeners('error');
    autoUpdater.on('error', (err) => {
      console.error('[updater] 壳更新失败:', err);
      void reportEvent('install_fail', version);
      shellUpdateRunning = false;
    });
    autoUpdater.on('update-downloaded', () => {
      void (async () => {
        await saveState({ pendingShellVersion: version });
        const { response } = await dialog.showMessageBox({
          type: 'info',
          title: '更新下载完成',
          message: `v${version} 已下载完成，重启后生效`,
          buttons: info.mandatory ? ['立即重启'] : ['立即重启', '退出时安装'],
          cancelId: info.mandatory ? 0 : 1,
        });
        if (response === 0) {
          setImmediate(() => autoUpdater.quitAndInstall());
        } else {
          shellUpdateRunning = false; // autoInstallOnAppQuit 会在退出时安装
        }
      })();
    });

    const check = await autoUpdater.checkForUpdates();
    if (!check?.updateInfo || !semverGt(check.updateInfo.version, app.getVersion())) {
      shellUpdateRunning = false;
      return;
    }
    await autoUpdater.downloadUpdate();
  } catch (err) {
    console.error('[updater] 壳更新失败:', err);
    void reportEvent('install_fail', version);
    shellUpdateRunning = false;
  }
}

// ─── 检查入口 ─────────────────────────────────────────────────────────────────

let checking = false;

async function checkForUpdates(win: BrowserWindow | null, trigger: 'auto' | 'manual'): Promise<void> {
  const { serverUrl, channel } = getConfig();
  if (!serverUrl) {
    if (trigger === 'manual') console.warn('[updater] 未配置更新服务器地址（update-config.json / VITE_API_BASE_URL / ZENITH_UPDATE_SERVER）');
    return;
  }
  if (checking) return;
  checking = true;

  try {
    const params = new URLSearchParams({
      app: APP_KEY,
      platform: platformKey(),
      arch: archKey(),
      channel: channel ?? 'stable',
      version: effectiveVersion(),
      deviceId: getDeviceId(),
    });
    const res = await fetch(`${normalizeBase(serverUrl)}/api/public/app-releases/check?${params}`);
    if (!res.ok) throw new Error(`check HTTP ${res.status}`);
    const body = (await res.json()) as { code: number; data: CheckResult };
    const info = body.data;

    if (!info?.hasUpdate || !info.artifact) {
      if (trigger === 'manual') {
        await dialog.showMessageBox({ type: 'info', title: '检查更新', message: `当前已是最新版本（v${effectiveVersion()}）`, buttons: ['好的'] });
      }
      return;
    }

    switch (info.artifact.kind) {
      case 'hotupdate':
        await applyWebUpdate(win, info);
        break;
      case 'installer':
        await applyShellUpdate(win, info);
        break;
      case 'external': {
        const { response } = await dialog.showMessageBox({
          type: 'info',
          title: '发现新版本',
          message: `发现新版本 v${info.version}，请前往下载页更新`,
          detail: info.notes?.slice(0, 600),
          buttons: ['打开下载页', '稍后'],
          cancelId: 1,
        });
        if (response === 0) void shell.openExternal(info.artifact.downloadUrl);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('[updater] 检查更新失败:', err);
  } finally {
    checking = false;
  }
}

// ─── 初始化 ───────────────────────────────────────────────────────────────────

/** 壳更新重启后的回执：pendingShellVersion 与当前版本一致 → install_success */
async function reportPendingShellInstall(): Promise<void> {
  const { pendingShellVersion } = loadState();
  if (!pendingShellVersion) return;
  if (app.getVersion() === pendingShellVersion) {
    await reportEvent('install_success', pendingShellVersion);
  }
  // 版本未变说明用户取消了安装器，静默清除，不误报失败
  await saveState({ pendingShellVersion: undefined });
}

export function initUpdater(getWindow: () => BrowserWindow | null): void {
  // 渲染进程上报 API 地址（web 包内的 VITE_API_BASE_URL 是唯一权威来源）
  ipcMain.on('updater:configure', (_event, cfg: UpdateConfig) => {
    if (cfg && typeof cfg.serverUrl === 'string' && /^https?:\/\//.test(cfg.serverUrl)) {
      runtimeConfig = { ...runtimeConfig, serverUrl: cfg.serverUrl };
    }
    if (cfg?.channel && ['stable', 'beta', 'internal'].includes(cfg.channel)) {
      runtimeConfig = { ...runtimeConfig, channel: cfg.channel };
    }
  });
  ipcMain.on('updater:check', () => {
    void checkForUpdates(getWindow(), 'manual');
  });

  void reportPendingShellInstall();

  // 开发模式不做自动检查（本地 dev server 走 Vite，热更没有意义）
  if (!app.isPackaged) return;

  setTimeout(() => void checkForUpdates(getWindow(), 'auto'), INITIAL_DELAY_MS);
  setInterval(() => void checkForUpdates(getWindow(), 'auto'), CHECK_INTERVAL_MS);
}
