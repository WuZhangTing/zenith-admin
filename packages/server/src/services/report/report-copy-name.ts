export function buildReportCopyName(
  baseName: string,
  existingNames: ReadonlySet<string>,
): string {
  const normalized = new Set(
    [...existingNames].map((name) => name.trim().toLowerCase()),
  );
  const base = baseName.trim() || '未命名副本';
  const direct = `${base} 副本`;
  if (!normalized.has(direct.toLowerCase())) return direct;

  for (let index = 2; index <= 200; index += 1) {
    const candidate = `${base} 副本 ${index}`;
    if (!normalized.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} 副本 ${Date.now()}`;
}
