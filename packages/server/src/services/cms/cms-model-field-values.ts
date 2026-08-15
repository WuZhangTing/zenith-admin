import dayjs from 'dayjs';
import type { CmsModelFieldValue } from '../../cms/themes/types';
import { listCmsModelFields, resolveCmsModelFieldOptions } from './cms-models.service';

/**
 * 组装详情页「模型字段表」展示值（Theme API `ctx.content.modelFields`）：
 * 取模型中勾选 showInDetail 的字段，按 detailGroup 分组、detailSort 排序，
 * 并把原始 extend 值格式化为可直接渲染的 displayValue（日期格式化、选项/字典翻译、开关转是否）。
 */
export async function buildCmsModelFieldValues(
  modelId: number | null | undefined,
  extend: Record<string, unknown> | null | undefined,
): Promise<CmsModelFieldValue[]> {
  if (!modelId) return [];
  const fields = (await listCmsModelFields(modelId)).filter((f) => f.showInDetail);
  if (fields.length === 0) return [];
  const resolved = await resolveCmsModelFieldOptions(fields);
  const values = extend ?? {};
  return fields
    .map((field) => {
      const rawValue = values[field.name];
      return {
        name: field.name,
        label: field.label,
        fieldType: field.fieldType,
        rawValue,
        displayValue: formatDisplayValue(field.fieldType, rawValue, resolved.get(field.id) ?? []),
        group: field.detailGroup?.trim() || null,
        sort: field.detailSort,
      };
    })
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
}

function optionLabel(options: { label: string; value: string }[], value: unknown): string {
  const raw = String(value);
  return options.find((o) => o.value === raw)?.label ?? raw;
}

function formatDisplayValue(
  fieldType: string,
  value: unknown,
  options: { label: string; value: string }[],
): string {
  if (value === undefined || value === null || value === '') return '';
  switch (fieldType) {
    case 'date': {
      const d = dayjs(value as string | number | Date);
      return d.isValid() ? d.format('YYYY-MM-DD') : String(value);
    }
    case 'datetime': {
      const d = dayjs(value as string | number | Date);
      return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : String(value);
    }
    case 'select':
    case 'radio':
      return optionLabel(options, value);
    case 'checkbox': {
      const list = Array.isArray(value) ? value : [value];
      return list.map((v) => optionLabel(options, v)).join('、');
    }
    case 'switch':
      return value === true || value === 'true' ? '是' : '否';
    case 'richtext':
      // 富文本字段不适合键值表；输出纯文本摘要，完整渲染由主题自行处理 rawValue
      return String(value).replace(/<[^>]+>/g, '').slice(0, 200);
    default:
      return String(value);
  }
}
