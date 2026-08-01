import { http } from 'msw';
import { ok, badRequest, notFound, pageParams } from '@/mocks/utils/handlers';
import { mockDataMaskConfigs, createMockDataMaskConfig, getNextDataMaskId } from '@/mocks/data/data-mask';
import { mockDateTime } from '@/mocks/utils/date';
import type { DataMaskConfig, SensitiveField, MaskType } from '@zenith/shared/platform';

// 模拟的敏感字段扫描结果（基于 seed 数据的表结构）
const MOCK_SENSITIVE_FIELDS: SensitiveField[] = [
  { tableName: 'users', columnName: 'phone',    dataType: 'character varying', suggestedMaskType: 'phone',     suggestedLabel: '手机号',  hasRule: true },
  { tableName: 'users', columnName: 'email',    dataType: 'character varying', suggestedMaskType: 'email',     suggestedLabel: '邮箱',    hasRule: true },
  { tableName: 'users', columnName: 'id_card',  dataType: 'character varying', suggestedMaskType: 'id_card',   suggestedLabel: '身份证号', hasRule: false },
  { tableName: 'users', columnName: 'real_name',dataType: 'character varying', suggestedMaskType: 'name',      suggestedLabel: '姓名',    hasRule: false },
  { tableName: 'orders', columnName: 'phone',   dataType: 'character varying', suggestedMaskType: 'phone',     suggestedLabel: '手机号',  hasRule: false },
  { tableName: 'orders', columnName: 'bank_card_no', dataType: 'character varying', suggestedMaskType: 'bank_card', suggestedLabel: '银行卡号', hasRule: false },
];

export const dataMaskHandlers = [
  // 扫描敏感字段
  http.get('/api/data-mask-configs/scan', () => {
    // 根据当前已有规则动态计算 hasRule
    const fields = MOCK_SENSITIVE_FIELDS.map((f) => ({
      ...f,
      hasRule: mockDataMaskConfigs.some((r) => r.entity === f.tableName && r.field === f.columnName),
    }));
    return ok(fields);
  }),

  // 批量创建
  http.post('/api/data-mask-configs/batch-create', async ({ request: req }) => {
    const body = await req.json() as { items: Array<{ entity: string; field: string; label: string; maskType: MaskType; exemptRoleCodes: string[]; enabled: boolean }> };
    let created = 0;
    let skipped = 0;
    for (const item of body.items) {
      const dup = mockDataMaskConfigs.find((r) => r.entity === item.entity && r.field === item.field);
      if (dup) { skipped++; continue; }
      mockDataMaskConfigs.push({
        id: getNextDataMaskId(),
        entity: item.entity,
        field: item.field,
        label: item.label,
        maskType: item.maskType,
        customRule: null,
        exemptRoleCodes: item.exemptRoleCodes ?? [],
        enabled: item.enabled ?? true,
        remark: null,
        createdAt: mockDateTime(),
        updatedAt: mockDateTime(),
      });
      created++;
    }
    return ok({ created, skipped }, `已创建 ${created} 条，跳过 ${skipped} 条`);
  }),

  // 列表（分页+关键词）
  http.get('/api/data-mask-configs', ({ request }) => {
    const url = new URL(request.url);
    const { page, pageSize } = pageParams(url, 20);
    const keyword = url.searchParams.get('keyword') ?? '';
    const maskType = url.searchParams.get('maskType') ?? '';
    const enabledStr = url.searchParams.get('enabled') ?? '';

    let list = [...mockDataMaskConfigs];
    if (keyword) {
      const kw = keyword.toLowerCase();
      list = list.filter((r) =>
        r.entity.toLowerCase().includes(kw) || r.field.toLowerCase().includes(kw) || r.label.toLowerCase().includes(kw),
      );
    }
    if (maskType) list = list.filter((r) => r.maskType === maskType);
    if (enabledStr) list = list.filter((r) => r.enabled === (enabledStr === 'true'));
    const total = list.length;
    const paged = list.slice((page - 1) * pageSize, page * pageSize);
    return ok({ list: paged, total, page, pageSize });
  }),

  // 创建
  http.post('/api/data-mask-configs', async ({ request }) => {
    const body = await request.json() as Partial<DataMaskConfig>;
    const dup = mockDataMaskConfigs.find((r) => r.entity === body.entity && r.field === body.field);
    if (dup) {
      return badRequest(`实体 ${body.entity} 的字段 ${body.field} 脱敏规则已存在`, { status: 400 });
    }
    const created = createMockDataMaskConfig(body);
    mockDataMaskConfigs.push(created);
    return ok(created, '创建成功');
  }),

  // 更新
  http.put('/api/data-mask-configs/:id', async ({ params, request }) => {
    const id = Number(params.id);
    const idx = mockDataMaskConfigs.findIndex((r) => r.id === id);
    if (idx < 0) return notFound('规则不存在', { status: 404 });
    const body = await request.json() as Partial<DataMaskConfig>;
    mockDataMaskConfigs[idx] = { ...mockDataMaskConfigs[idx], ...body, id, updatedAt: mockDateTime() };
    return ok(mockDataMaskConfigs[idx], '更新成功');
  }),

  // 删除
  http.delete('/api/data-mask-configs/:id', ({ params }) => {
    const id = Number(params.id);
    const idx = mockDataMaskConfigs.findIndex((r) => r.id === id);
    if (idx < 0) return notFound('规则不存在', { status: 404 });
    mockDataMaskConfigs.splice(idx, 1);
    return ok(null, '删除成功');
  }),
];
