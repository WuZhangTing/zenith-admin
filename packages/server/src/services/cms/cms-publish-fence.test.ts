import { describe, expect, it } from 'vitest';
import type { DbExecutor } from '../../db/types';
import { cmsSites } from '../../db/schema';
import { TaskCancelledError } from '../../lib/task-center';
import { assertCmsPublishFence } from './cms-site-publish-lock.service';

function executorFor(state: {
  themeRevision: number;
  templateRefsRevision: number;
}): DbExecutor {
  return {
    select: () => ({
      from: (table: unknown) => {
        const rows = table === cmsSites ? [{
          id: 1,
          parentId: null,
          name: 'Site',
          code: 'site',
          theme: 'default',
          themeRevision: state.themeRevision,
          templateRefsRevision: state.templateRefsRevision,
          settings: {},
          status: 'enabled',
        }] : [];
        const chain = {
          where: () => chain,
          limit: async () => rows,
          then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
            Promise.resolve(rows).then(resolve, reject),
        };
        return chain;
      },
    }),
  } as unknown as DbExecutor;
}

describe('CMS publish revision fence', () => {
  it('lets only the newest lifecycle task reach the write switch', async () => {
    const state = { themeRevision: 2, templateRefsRevision: 4 };
    const executor = executorFor(state);
    let deployedRevision = 0;
    const run = async (expectedThemeRevision: number) => {
      await assertCmsPublishFence(executor, {
        siteId: 1,
        targetType: 'theme',
        expectedThemeRevision,
        expectedTemplateRefsRevision: 4,
      });
      deployedRevision = expectedThemeRevision;
    };
    await run(2);
    await expect(run(1)).rejects.toBeInstanceOf(TaskCancelledError);
    expect(deployedRevision).toBe(2);
  });

  it('rejects changed template reference revisions', async () => {
    const executor = executorFor({ themeRevision: 2, templateRefsRevision: 5 });
    await expect(assertCmsPublishFence(executor, {
      siteId: 1,
      targetType: 'site',
      expectedThemeRevision: 2,
      expectedTemplateRefsRevision: 4,
    })).rejects.toThrow(/templateRefsRevision/);
  });
});