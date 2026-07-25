import { describe, expect, it } from 'vitest';
import { pruneStaleTemplateDefaults } from './cms-template-refs.service';

/**
 * 默认主题内置的扩展模板：list-card / list-compact / detail-plain。
 * 用例围绕「主题移除模板变体后，站点历史引用如何处理」展开。
 */
describe('pruneStaleTemplateDefaults', () => {
  const withDefaults = (defaultTemplates: unknown) => ({ defaultTemplates });

  it('剔除本次未改动、且主题中已不存在的模板引用', () => {
    const previous = withDefaults({ pc: { list: 'list-editorial', detail: 'detail-editorial' } });
    const merged = withDefaults({ pc: { list: 'list-editorial', detail: 'detail-editorial' } });

    const { settings, removed } = pruneStaleTemplateDefaults('default', merged, previous);

    expect(settings.defaultTemplates).toEqual({});
    expect(removed).toEqual([
      '[pc]列表模板「list-editorial」',
      '[pc]详情模板「detail-editorial」',
    ]);
  });

  it('保留本次新提交的失效模板名，交由校验层抛错（保住拼写错误反馈）', () => {
    const previous = withDefaults({});
    const merged = withDefaults({ pc: { list: 'list-typo' } });

    const { settings, removed } = pruneStaleTemplateDefaults('default', merged, previous);

    expect(settings.defaultTemplates).toEqual({ pc: { list: 'list-typo' } });
    expect(removed).toEqual([]);
  });

  it('模板名本次被改动时不静默摘除，即使新值同样失效', () => {
    const previous = withDefaults({ pc: { list: 'list-editorial' } });
    const merged = withDefaults({ pc: { list: 'list-another-missing' } });

    const { removed } = pruneStaleTemplateDefaults('default', merged, previous);

    expect(removed).toEqual([]);
  });

  it('有效模板引用原样保留，且返回原对象引用避免无谓写入', () => {
    const merged = withDefaults({ pc: { list: 'list-card', detail: 'detail-plain' } });

    const result = pruneStaleTemplateDefaults('default', merged, merged);

    expect(result.settings).toBe(merged);
    expect(result.removed).toEqual([]);
  });

  it('按模型维度的详情模板同样自愈，且不影响同组有效项', () => {
    const previous = withDefaults({ pc: { detailByModel: { article: 'detail-editorial', product: 'detail-plain' } } });
    const merged = withDefaults({ pc: { detailByModel: { article: 'detail-editorial', product: 'detail-plain' } } });

    const { settings, removed } = pruneStaleTemplateDefaults('default', merged, previous);

    expect(settings.defaultTemplates).toEqual({ pc: { detailByModel: { product: 'detail-plain' } } });
    expect(removed).toEqual(['[pc]article 详情模板「detail-editorial」']);
  });

  it('未注册主题不做任何处理（交由主题校验层报错）', () => {
    const merged = withDefaults({ pc: { list: 'list-editorial' } });

    const result = pruneStaleTemplateDefaults('not-a-theme', merged, merged);

    expect(result.settings).toBe(merged);
    expect(result.removed).toEqual([]);
  });

  it('无 defaultTemplates 的 settings 原样返回', () => {
    const merged = { recycleKeepDays: 30 };

    const result = pruneStaleTemplateDefaults('default', merged, {});

    expect(result.settings).toBe(merged);
    expect(result.removed).toEqual([]);
  });
});
