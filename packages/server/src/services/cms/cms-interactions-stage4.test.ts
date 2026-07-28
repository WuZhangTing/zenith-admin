import { readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  createCmsInteractionSchema,
} from '@zenith/shared';
import {
  canExposeCmsInteractionResults,
  cmsInteractionRepeatIdentity,
  applyInteractionMarkers,
  interactionCodeStem,
  nextInteractionCopyCode,
  toCmsInteractionAnswerDetail,
  toCmsInteractionPublicStats,
} from './cms-interactions.service';

const option = (id: string) => ({ id, label: id, value: id });

async function stage4Migration(): Promise<string> {
  const directory = new URL('../../../drizzle/', import.meta.url);
  const filename = (await readdir(directory)).find((name) => name.startsWith('0096_') && name.endsWith('.sql'));
  if (!filename) throw new Error('0096 migration missing');
  return readFile(new URL(filename, directory), 'utf8');
}

describe('CMS Stage4 unified interactions', () => {
  it('supports survey and constrained poll definitions in one schema', () => {
    expect(createCmsInteractionSchema.safeParse({
      siteId: 1,
      code: 'feedback',
      kind: 'survey',
      title: 'Feedback',
      questions: [{ label: 'Comment', type: 'text', required: false, options: [], minChoices: 0, maxChoices: 1 }],
    }).success).toBe(true);
    expect(createCmsInteractionSchema.safeParse({
      siteId: 1,
      code: 'vote',
      kind: 'poll',
      title: 'Vote',
      questions: [{ label: 'Pick', type: 'single', options: [option('a'), option('b')], minChoices: 1, maxChoices: 1 }],
    }).success).toBe(true);
    expect(createCmsInteractionSchema.safeParse({
      siteId: 1,
      code: 'bad-poll',
      kind: 'poll',
      title: 'Bad',
      questions: [{ label: 'Text', type: 'text', options: [], minChoices: 0, maxChoices: 1 }],
    }).success).toBe(false);
    expect(createCmsInteractionSchema.safeParse({
      siteId: 1,
      code: 'turnstile-survey',
      kind: 'survey',
      title: 'Protected',
      captchaPolicy: 'turnstile',
      turnstileSiteKey: 'site-key',
      questions: [{ label: 'Comment', type: 'text', required: false, options: [], minChoices: 0, maxChoices: 1 }],
    }).success).toBe(false);
    expect(createCmsInteractionSchema.safeParse({
      siteId: 1,
      code: 'turnstile-survey',
      kind: 'survey',
      title: 'Protected',
      captchaPolicy: 'turnstile',
      turnstileSiteKey: 'site-key',
      turnstileSecret: 'secret-key',
      questions: [{ label: 'Comment', type: 'text', required: false, options: [], minChoices: 0, maxChoices: 1 }],
    }).success).toBe(true);
  });

  it('never exposes text answers in public state/submit statistics', () => {
    const publicStats = toCmsInteractionPublicStats({
      interactionId: 1,
      responseCount: 2,
      questions: [{
        id: 3,
        label: 'private text',
        type: 'text',
        options: [],
        texts: ['must-not-leak'],
      }],
    });
    expect(JSON.stringify(publicStats)).not.toContain('texts');
    expect(JSON.stringify(publicStats)).not.toContain('must-not-leak');
  });

  it('renders unified markers and safely ignores legacy poll/survey markers', () => {
    const rendered = applyInteractionMarkers(
      '<p>[投票:legacy]</p><p>[问卷:old-survey]</p><p>[互动:current]</p>',
      'main',
    );
    expect(rendered).not.toContain('[投票:');
    expect(rendered).not.toContain('[问卷:');
    expect(rendered).toContain('data-code="current"');
    expect(() => applyInteractionMarkers('[互动:<malformed>][投票:broken', 'main')).not.toThrow();
  });

  it('serializes question replacement with submissions and keeps multiple forms reusable', async () => {
    const [service, theme] = await Promise.all([
      readFile(new URL('./cms-interactions.service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../../cms/themes/default/templates.tsx', import.meta.url), 'utf8'),
    ]);
    expect((service.match(/\.for\('update'\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(service).toContain('current.responseCount > 0');
    expect(service).toContain('validateInteractionAnswers(questions, input)');
    expect(theme).toContain("i.repeatPolicy==='multiple'");
    expect(theme).toContain('f.reset()');
  });

  it('enforces repeat identities and result visibility without leaking hidden results', () => {
    expect(cmsInteractionRepeatIdentity({ policy: 'once_per_member', memberId: 7, ipHash: 'ip' })).toBe('m:7');
    expect(cmsInteractionRepeatIdentity({ policy: 'once_per_ip', memberId: null, ipHash: 'hash' })).toBe('i:hash');
    expect(cmsInteractionRepeatIdentity({ policy: 'multiple', memberId: null, ipHash: 'hash' })).toBeNull();
    expect(canExposeCmsInteractionResults({ visibility: 'hidden', status: 'closed', submitted: true })).toBe(false);
    expect(canExposeCmsInteractionResults({ visibility: 'after_submit', status: 'published', submitted: true })).toBe(true);
    expect(canExposeCmsInteractionResults({ visibility: 'after_close', status: 'published', submitted: true })).toBe(false);
  });

  it('migration drops both legacy product tables', async () => {
    const migration = await stage4Migration();
    expect(migration).toContain('DROP TABLE "cms_polls"');
    expect(migration).toContain('DROP TABLE "cms_surveys"');
    expect(migration).toContain('CREATE TABLE "cms_interactions"');
  });

  it('generates non-colliding copy codes and never nests -copy suffixes', () => {
    expect(interactionCodeStem('satisfaction')).toBe('satisfaction');
    expect(interactionCodeStem('satisfaction-copy')).toBe('satisfaction');
    expect(interactionCodeStem('satisfaction-copy-7')).toBe('satisfaction');
    expect(nextInteractionCopyCode('satisfaction', new Set())).toBe('satisfaction-copy');
    expect(nextInteractionCopyCode('satisfaction', new Set(['satisfaction-copy']))).toBe('satisfaction-copy-2');
    // 副本的副本仍挂在原始词根上，不会累加成 xxx-copy-copy
    expect(nextInteractionCopyCode('satisfaction-copy', new Set(['satisfaction-copy', 'satisfaction-copy-2'])))
      .toBe('satisfaction-copy-3');
    const long = 'a'.repeat(60);
    expect(nextInteractionCopyCode(long, new Set()).length).toBeLessThanOrEqual(50);
    expect(() => nextInteractionCopyCode('x', new Set([
      'x-copy',
      ...Array.from({ length: 99 }, (_, i) => `x-copy-${i + 2}`),
    ]))).toThrow();
  });

  it('resolves option values to labels and falls back when options changed', () => {
    const options = [{ label: '非常满意', value: 'very' }, { label: '满意', value: 'ok' }];
    expect(toCmsInteractionAnswerDetail({
      questionId: 1, label: '满意度', type: 'single', options, value: 'very',
    })).toEqual({ questionId: 1, label: '满意度', type: 'single', values: ['非常满意'], display: '非常满意' });
    expect(toCmsInteractionAnswerDetail({
      questionId: 2, label: '功能', type: 'multiple', options, value: ['very', 'ok'],
    }).display).toBe('非常满意、满意');
    // 选项被删除/改名后回退成原始 value，不吞内容
    expect(toCmsInteractionAnswerDetail({
      questionId: 3, label: '功能', type: 'multiple', options, value: ['very', 'removed'],
    }).display).toBe('非常满意、removed');
    // 文本题原样返回，不做任何选项反查
    expect(toCmsInteractionAnswerDetail({
      questionId: 4, label: '建议', type: 'text', options: null, value: 'very',
    }).display).toBe('very');
  });
});
