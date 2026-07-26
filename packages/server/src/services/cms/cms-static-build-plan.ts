/**
 * 全量重建的断点键：`{scope}|{phase}|{id}`，字典序单调递增，续跑时按 `<=` 跳过已完成目标。
 * scope 固定两种：`~site`（站点主产物）与 `~meta`（sitemap/rss/robots）。
 */
export function cmsStaticTargetKey(scope: string, phase: number, id: number): string {
  return `${scope}|${phase}|${String(id).padStart(12, '0')}`;
}

export function isCmsStaticTargetCompleted(targetKey: string, resumeAfterKey: string | null | undefined): boolean {
  return Boolean(resumeAfterKey && targetKey <= resumeAfterKey);
}
