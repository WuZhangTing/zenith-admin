import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'drizzle/**', 'node_modules/**', 'logs/**', 'storage/**'] },
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
      // @zenith/shared 已按业务域拆分：根入口会把全部 18 个域拉进依赖图，
      // 使「改 CMS 类型」这类局部改动波及所有消费方，故禁止直接引用根入口与已废弃的旧巨石路径。
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@zenith/shared',
              message:
                "请改用域子路径：'@zenith/shared/identity' | 'payment' | 'workflow' | 'cms' | 'report' | 'core' 等；种子数据用 '@zenith/shared/seed'。",
            },
            {
              name: '@zenith/shared/types',
              message: "旧巨石路径已删除，请改用 '@zenith/shared/<domain>'。",
            },
            {
              name: '@zenith/shared/validation',
              message: "旧巨石路径已删除，请改用 '@zenith/shared/<domain>'。",
            },
            {
              name: '@zenith/shared/constants',
              message: "旧巨石路径已删除，请改用 '@zenith/shared/<domain>'。",
            },
            {
              name: '@zenith/shared/seed-data',
              message: "旧巨石路径已删除，请改用 '@zenith/shared/seed'。",
            },
          ],
        },
      ],
    },
  },
  // 元编程场景豁免：需要对 shared 全量导出做扫描（如所有 update*Schema 的默认值回归测试）
  {
    files: ['src/lib/update-schema-defaults.test.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  // Node 启动/构建脚本（纯 JS，需要声明 Node 运行时全局）
  {
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
);
