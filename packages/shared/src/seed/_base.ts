/**
 * 种子数据共享基元。
 *
 * 单独成文件的原因：`SEED_DATE` 被 seed 下几乎所有分片引用。
 * 若把它留在 `menus.ts`，「menus.ts 聚合分片」与「分片引用 menus.ts」会形成 ESM 值环，
 * 分片先于 SEED_DATE 初始化 → TDZ 崩溃（`npm run lint:cycles` 会拦截）。
 */
export const SEED_DATE = '2024-01-01 00:00:00';
