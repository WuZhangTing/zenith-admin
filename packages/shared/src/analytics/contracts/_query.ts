import * as z from 'zod';

/**
 * 列表筛选用的枚举查询参数：空串（筛选控件的「全部」项）视为未筛选，非法取值 400。
 * 与 core 的 `queryBool()` 同一套约定：解析后的值不含空串，handler 无需再做 `|| undefined`。
 */
export function filterEnum<const T extends readonly string[]>(values: T, description?: string) {
  return z
    .union([z.literal('').transform(() => undefined), z.enum(values)])
    .optional()
    .meta(description ? { description } : {});
}

/** `days` 窗口参数（最近 N 天） */
export function daysQuery(max: number, defaultDays: number, description = '统计窗口（天）') {
  return z.coerce.number().int().min(1).max(max).default(defaultDays).meta({ description, example: defaultDays });
}

/** 纯日期端点（YYYY-MM-DD） */
export const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须为 YYYY-MM-DD');

/** 站点 Key 查询参数：匿名采集时用于归属租户；与 `X-Analytics-Site-Key` 请求头等价 */
export const siteKeyQueryField = z.string().optional().meta({ description: '站点 Key（与 X-Analytics-Site-Key 请求头等价）' });
