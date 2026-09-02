/**
 * 运行时无关的随机 UUID（RFC 4122 v4）。
 *
 * 浏览器只在安全上下文（HTTPS / localhost）暴露 `crypto.randomUUID`，内网以 `http://ip` 访问时它不存在；
 * `crypto.getRandomValues` 不受此限制，按 v4 规则组装即可得到格式与熵源都等价的结果。
 *  - web 入口用 `uuidV4` polyfill `crypto.randomUUID`（见 web/src/polyfills.ts），业务代码继续用标准 API
 *  - analytics-sdk 嵌入第三方页面，不能改宿主全局，直接调用 `randomUUID`
 */

/** 仅用 getRandomValues 组装 v4，不探测原生 randomUUID——供 polyfill 安装到 crypto 上时不会自引用 */
export function uuidV4(): string {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    // 无 Web Crypto 的宿主（极端情况），只保证格式正确
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** 优先原生 `crypto.randomUUID`，非安全上下文回退 `uuidV4` */
export function randomUUID(): string {
  return typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : uuidV4();
}
