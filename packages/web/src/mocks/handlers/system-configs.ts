import { http } from 'msw';
import { ok, notFound, pageParams, nextIdFrom } from '@/mocks/utils/handlers';
import { mockSystemConfigs } from '@/mocks/data/system';
import { mockDateTime } from '@/mocks/utils/date';
import type { SystemConfig } from '@zenith/shared/platform';

export const systemConfigsHandlers = [
  // 密码策略（公开，无需鉴权）
  http.get('/api/system-configs/password-policy', () => {
    return ok({ minLength: 6, requireUppercase: false, requireSpecialChar: false }, 'success');
  }),

  // 系统参数列表
  http.get('/api/system-configs', ({ request }) => {
    const url = new URL(request.url);
    const { page, pageSize } = pageParams(url);
    const keyword = url.searchParams.get('keyword') ?? '';
    const configType = url.searchParams.get('configType') ?? '';
    const keysParam = url.searchParams.get('keys') ?? '';

    // 精确批量查询模式（不分页）
    if (keysParam) {
      const keyList = keysParam.split(',').map((k) => k.trim()).filter(Boolean);
      const list = mockSystemConfigs.filter((c) => keyList.includes(c.configKey));
      return ok({ list, total: list.length, page: 1, pageSize: list.length });
    }

    let list = mockSystemConfigs.filter((c) => {
      if (keyword && !c.configKey.includes(keyword) && !c.configName.includes(keyword) && !c.description.includes(keyword)) return false;
      if (configType && c.configType !== configType) return false;
      return true;
    });
    const total = list.length;
    list = list.slice((page - 1) * pageSize, page * pageSize);
    return ok({ list, total, page, pageSize });
  }),

  // 通过 key 查询公开配置（无需鉴权）
  http.get('/api/system-configs/public/:key', ({ params }) => {
    const config = mockSystemConfigs.find((c) => c.configKey === params.key);
    if (!config) return notFound('配置不存在');
    return ok(config);
  }),

  // 获取单个配置
  http.get('/api/system-configs/:id', ({ params }) => {
    const config = mockSystemConfigs.find((c) => c.id === Number(params.id));
    if (!config) return notFound('配置不存在');
    return ok(config);
  }),

  // 新增配置
  http.post('/api/system-configs', async ({ request }) => {
    const body = await request.json() as Partial<SystemConfig>;
    const newConfig: SystemConfig = {
      id: nextIdFrom(mockSystemConfigs),
      configKey: body.configKey ?? '',
      configName: body.configName ?? '',
      configValue: body.configValue ?? '',
      configType: body.configType ?? 'string',
      description: body.description ?? '',
      createdAt: mockDateTime(),
      updatedAt: mockDateTime(),
    };
    mockSystemConfigs.push(newConfig);
    return ok(newConfig, '新增成功');
  }),

  // 更新配置
  http.put('/api/system-configs/:id', async ({ params, request }) => {
    const config = mockSystemConfigs.find((c) => c.id === Number(params.id));
    if (!config) return notFound('配置不存在');
    const body = await request.json() as Partial<SystemConfig>;
    Object.assign(config, body, { updatedAt: mockDateTime() });
    return ok(config, '更新成功');
  }),

  // 删除配置
  http.delete('/api/system-configs/:id', ({ params }) => {
    const index = mockSystemConfigs.findIndex((c) => c.id === Number(params.id));
    if (index === -1) return notFound('配置不存在');
    mockSystemConfigs.splice(index, 1);
    return ok(null, '删除成功');
  }),
];
