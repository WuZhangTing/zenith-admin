import { pinyin } from 'pinyin-pro';

/**
 * 汉字名称 → 拼音 slug（与服务端 slugifyChannelName 规则一致）。
 * 供 CMS 栏目 slug、互动问卷访问标识等场景复用。
 */
export function slugifyName(name: string, maxLength = 100): string {
  const py = pinyin(name, { toneType: 'none', type: 'array', nonZh: 'consecutive' }).join('-');
  return py.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, maxLength);
}
