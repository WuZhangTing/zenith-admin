/**
 * 部分更新 schema 不得夹带默认值。
 *
 * Zod 的 `.partial()` **保留** `.default()`，所以由 create schema `.partial()` 派生的
 * update schema 在字段省略时会主动填入默认值。服务层普遍用 `...data` 展开写库，
 * 于是一次 `PUT {"remark":"x"}` 就会把刻意停用的碎片静默启用、把 text 碎片改成 html，
 * 并被发布链路立刻推到线上产物里。默认值只属于创建语义。
 */
import { describe, expect, it } from 'vitest';
import { createCmsFragmentSchema, updateCmsFragmentSchema } from '@zenith/shared';

describe('碎片校验 schema', () => {
  it('部分更新只回传显式提交的字段', () => {
    expect(updateCmsFragmentSchema.parse({ remark: '只改备注' })).toEqual({ remark: '只改备注' });
    expect(updateCmsFragmentSchema.parse({ name: '改名' })).toEqual({ name: '改名' });
  });

  it('部分更新保留显式提交的类型与状态', () => {
    expect(updateCmsFragmentSchema.parse({ type: 'text' })).toEqual({ type: 'text' });
    expect(updateCmsFragmentSchema.parse({ status: 'disabled' })).toEqual({ status: 'disabled' });
  });

  it('创建时仍补齐默认值', () => {
    expect(createCmsFragmentSchema.parse({ siteId: 1, code: 'home-banner', name: '首页横幅' }))
      .toMatchObject({ type: 'html', status: 'enabled' });
  });

  it('已移除的 json 类型在创建与更新两侧都被拒绝', () => {
    expect(() => createCmsFragmentSchema.parse({ siteId: 1, code: 'a', name: 'n', type: 'json' })).toThrow();
    expect(() => updateCmsFragmentSchema.parse({ type: 'json' })).toThrow();
  });
});
