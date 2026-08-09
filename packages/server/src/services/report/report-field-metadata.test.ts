import { describe, expect, it } from 'vitest';
import {
  buildReportFieldMetadataMap,
  isNumericReportField,
} from './report-field-metadata';

describe('report field metadata', () => {
  it('combines base and computed fields by name', () => {
    const fields = buildReportFieldMetadataMap(
      [{ name: 'amount', type: 'number' }],
      [{ name: 'margin', format: { kind: 'percent' } }],
    );

    expect([...fields.keys()]).toEqual(['amount', 'margin']);
    expect(fields.get('margin')?.format?.kind).toBe('percent');
  });

  it('recognizes numeric field types and formats', () => {
    expect(isNumericReportField({ name: 'amount', type: 'number' })).toBe(true);
    expect(isNumericReportField({ name: 'ratio', format: { kind: 'percent' } })).toBe(true);
    expect(isNumericReportField({ name: 'name', type: 'string' })).toBe(false);
    expect(isNumericReportField(undefined)).toBe(false);
  });
});
