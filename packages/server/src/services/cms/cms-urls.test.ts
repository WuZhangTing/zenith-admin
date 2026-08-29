import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { APP_TIME_ZONE, formatDateTime } from '../../lib/datetime';
import { contentArchiveDir, contentUrl } from './cms-urls';

dayjs.extend(utc);
dayjs.extend(timezone);

// 固定在 APP_TIME_ZONE 的正午构造，避开任何 runner 时区的日界，使字面断言与 TZ 无关
// （用 new Date(2026, 6, 5) 会随 OS 时区漂移，CI 与本地结果不一致）
const AT = dayjs.tz('2026-07-05 12:00:00', 'YYYY-MM-DD HH:mm:ss', APP_TIME_ZONE).toDate();

function content(overrides: Partial<Parameters<typeof contentUrl>[2]> = {}) {
  return { id: 42, slug: null, publishedAt: AT, createdAt: AT, ...overrides };
}

describe('contentArchiveDir', () => {
  it('不归档时返回空串', () => {
    expect(contentArchiveDir('none', content())).toBe('');
  });

  it('按年 / 年月 / 年月日归档（不补零，与栏目路径拼接）', () => {
    expect(contentArchiveDir('year', content())).toBe('2026/');
    expect(contentArchiveDir('month', content())).toBe('2026/7/');
    expect(contentArchiveDir('date', content())).toBe('2026/7/5/');
  });

  it('日期串归档补零，便于目录名等宽排序', () => {
    expect(contentArchiveDir('dateStr', content())).toBe('2026-07-05/');
  });

  it('ID 散列分 10 桶，且不依赖时间字段', () => {
    expect(contentArchiveDir('idHash', content({ id: 42, publishedAt: null, createdAt: null }))).toBe('2/');
    expect(contentArchiveDir('idHash', content({ id: 10 }))).toBe('0/');
  });

  it('日期类规则在未发布时回退创建时间', () => {
    expect(contentArchiveDir('year', content({ publishedAt: null }))).toBe('2026/');
  });

  it('日期类规则在两个时间都缺失时退化为不归档，避免产生 undefined 目录', () => {
    expect(contentArchiveDir('year', content({ publishedAt: null, createdAt: null }))).toBe('');
  });

  it('取值口径与 formatDateTime 展示一致（同为 APP_TIME_ZONE，而非 OS 本地时区）', () => {
    // APP_TIME_ZONE 默认 Asia/Shanghai，部署机 TZ 未设置时裸 dayjs 会按 UTC 算，两者差一年
    const utcBoundary = new Date('2023-12-31T16:00:00.000Z');
    const displayedYear = Number(formatDateTime(utcBoundary).slice(0, 4));
    expect(contentArchiveDir('year', content({ publishedAt: utcBoundary }))).toBe(`${displayedYear}/`);
  });

  it('非法日期不产生 Invalid 目录', () => {
    expect(contentArchiveDir('year', content({ publishedAt: new Date('nope') }))).toBe('');
  });
});

describe('contentUrl 与归档规则', () => {
  const channel = { path: 'news', detailPathRule: 'year' } as const;

  it('归档目录插在栏目路径与文件名之间', () => {
    expect(contentUrl('', channel, content())).toBe('/news/2026/42.html');
  });

  it('slug 优先于 id 作为文件名', () => {
    expect(contentUrl('', channel, content({ slug: 'hello' }))).toBe('/news/2026/hello.html');
  });

  it('正文分页在文件名后追加 _N', () => {
    expect(contentUrl('', channel, content(), 2)).toBe('/news/2026/42_2.html');
  });

  it('内容自定义静态路径完全绕过归档规则', () => {
    const c = content({ staticPath: 'topic/2026/special.html' });
    expect(contentUrl('', channel, c)).toBe('/topic/2026/special.html');
    expect(contentUrl('', channel, c, 3)).toBe('/topic/2026/special_3.html');
  });

  it('baseUrl 前缀参与拼接（预览场景）', () => {
    expect(contentUrl('/__cms/main', channel, content())).toBe('/__cms/main/news/2026/42.html');
  });

  it('规则为 none 时与历史行为完全一致', () => {
    expect(contentUrl('', { path: 'news', detailPathRule: 'none' }, content())).toBe('/news/42.html');
  });
});
