import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * `@zenith/shared` 此前没有任何 lint 配置——111 个文件、前后端共用的全部类型与
 * Zod schema 完全不受约束，而 CI 的 `npm run lint` 也只覆盖 server / analytics-sdk / web。
 * 一处 schema 改错可以同时打穿两端却无人拦截。
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // 种子数据只服务于 db/seed.ts 与 MSW mock，不应进入生产依赖图。
    // 域代码一旦引用 seed，消费方 import 任意域都会把整棵种子树拉进 bundle。
    files: ['src/*/**/*.ts'],
    ignores: ['src/seed/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/seed', '**/seed/*', '@zenith/shared/seed', '@zenith/shared/seed/*'],
              message: '业务域不得引用 seed：种子数据只服务于 db/seed.ts 与 MSW mock，不应进入生产依赖图。',
            },
          ],
        },
      ],
    },
  },
  // 部分更新 schema 一律由 partialForUpdate() 派生：Zod 的 .partial() 保留 .default()，
  // 字段省略时会填入默认值并经服务层 .set({ ...data }) 写库，覆盖从未提交的字段。
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='partial']",
          message: '禁止直接调用 .partial()：请改用 partialForUpdate()（core/validation），否则字段省略时会注入 .default() 并覆盖未提交的字段。',
        },
      ],
    },
  },
);
