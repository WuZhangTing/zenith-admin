export interface ReportFieldMetadata {
  name: string;
  type?: string;
  format?: { kind?: string };
}

export function buildReportFieldMetadataMap(
  ...groups: Array<readonly ReportFieldMetadata[] | undefined>
): Map<string, ReportFieldMetadata> {
  const fields = new Map<string, ReportFieldMetadata>();
  for (const group of groups) {
    for (const field of group ?? []) fields.set(field.name, field);
  }
  return fields;
}

export function isNumericReportField(field: ReportFieldMetadata | undefined): boolean {
  return field?.type === 'number'
    || ['number', 'percent', 'currency'].includes(String(field?.format?.kind ?? ''));
}
