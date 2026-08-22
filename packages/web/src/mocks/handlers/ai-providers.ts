import { http } from 'msw';
import { ok, notFound } from '@/mocks/utils/handlers';
import { mockAiProviders, getNextProviderId } from '@/mocks/data/ai';
import { mockDateTime } from '@/mocks/utils/date';
import { AI_COMMON_PROVIDERS, AI_CUSTOM_PROVIDER_ID } from '@zenith/shared/ai';
import type { AiProviderCatalogEntry, AiProviderConfig } from '@zenith/shared/ai';

const store = [...mockAiProviders];

/** Demo 目录:常用服务商 + 每家几款代表模型 */
const CATALOG_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o3-mini'],
  anthropic: ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-haiku-4-5'],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  alibaba: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
  moonshotai: ['kimi-k2', 'moonshot-v1-128k'],
  zhipuai: ['glm-4.6', 'glm-4.5-air'],
  minimax: ['minimax-m2'],
  siliconflow: ['deepseek-v3', 'qwen3-32b'],
  xai: ['grok-4', 'grok-3-mini'],
  mistral: ['mistral-large-latest', 'mistral-small-latest'],
  groq: ['llama-3.3-70b-versatile'],
  openrouter: ['openai/gpt-4o', 'anthropic/claude-sonnet-4-5'],
};

export const aiProvidersHandlers = [
  // 测试连接（Demo 模拟）
  http.post('/api/ai/providers/test-connection', async () => {
    return ok({ success: true, message: '连接成功（Demo 模拟）' });
  }),

  // 服务商目录（Demo：常用清单）
  http.get('/api/ai/providers/catalog', () => {
    const entries: AiProviderCatalogEntry[] = AI_COMMON_PROVIDERS.map((p) => ({
      id: p.id,
      name: p.label,
      docUrl: null,
      common: true,
      modelCount: CATALOG_MODELS[p.id]?.length ?? 0,
    }));
    return ok(entries);
  }),

  // 目录内某服务商的模型清单
  http.get('/api/ai/providers/catalog/:providerId/models', ({ params }) => {
    const providerId = String(params.providerId);
    if (providerId === AI_CUSTOM_PROVIDER_ID) return ok([]);
    return ok(CATALOG_MODELS[providerId] ?? []);
  }),

  // 从供应商 API 自动发现模型（Demo：返回目录样例）
  http.post('/api/ai/providers/fetch-models', async ({ request }) => {
    const body = await request.json() as { providerId?: string };
    return ok(CATALOG_MODELS[body.providerId ?? ''] ?? ['demo-model-a', 'demo-model-b']);
  }),

  // 聊天可用模型（轻量列表：仅启用配置的非敏感字段）
  http.get('/api/ai/models', () => {
    const models = store
      .filter((p) => p.isEnabled)
      .flatMap((p) => {
        const rest = (p.models ?? []).filter((m) => m !== p.defaultModel);
        return [p.defaultModel, ...rest].map((model, idx) => ({
          id: p.id, name: p.name, model, providerId: p.providerId, isDefault: p.isDefault && idx === 0, capabilities: p.capabilities ?? null,
        }));
      });
    return ok(models);
  }),

  // 列表
  http.get('/api/ai/providers', () => {
    return ok(store);
  }),

  // 单条
  http.get('/api/ai/providers/:id', ({ params }) => {
    const id = Number(params.id);
    const item = store.find((p) => p.id === id);
    if (!item) return notFound('服务商不存在', { status: 404 });
    return ok(item);
  }),

  // 创建
  http.post('/api/ai/providers', async ({ request }) => {
    const body = await request.json() as Partial<AiProviderConfig>;
    const now = mockDateTime();
    const models = body.models?.length ? body.models : ['demo-model'];
    const newItem: AiProviderConfig = {
      id: getNextProviderId(),
      name: body.name ?? '未命名服务商',
      providerId: body.providerId ?? AI_CUSTOM_PROVIDER_ID,
      baseUrl: body.baseUrl ?? null,
      apiKey: body.apiKey ? `${(body.apiKey as string).slice(0, 4)}...${(body.apiKey as string).slice(-4)}` : '****',
      headers: body.headers ?? null,
      models,
      defaultModel: body.defaultModel && models.includes(body.defaultModel) ? body.defaultModel : models[0],
      modelSettings: body.modelSettings ?? null,
      providerOptions: body.providerOptions ?? null,
      fallbacks: body.fallbacks ?? null,
      capabilities: body.capabilities ?? null,
      priceInputPerM: body.priceInputPerM ?? null,
      priceOutputPerM: body.priceOutputPerM ?? null,
      isDefault: body.isDefault ?? false,
      isEnabled: body.isEnabled ?? true,
      maxConcurrent: body.maxConcurrent ?? null,
      createdAt: now,
      updatedAt: now,
    };
    if (newItem.isDefault) {
      store.forEach((p) => { p.isDefault = false; });
    }
    store.push(newItem);
    return ok(newItem, '创建成功');
  }),

  // 更新
  http.put('/api/ai/providers/:id', async ({ params, request }) => {
    const id = Number(params.id);
    const idx = store.findIndex((p) => p.id === id);
    if (idx === -1) return notFound('服务商不存在', { status: 404 });
    const body = await request.json() as Partial<AiProviderConfig>;
    const now = mockDateTime();
    if (body.isDefault) {
      store.forEach((p) => { p.isDefault = false; });
    }
    store[idx] = {
      ...store[idx],
      ...body,
      apiKey: body.apiKey && !(body.apiKey as string).includes('...')
        ? `${(body.apiKey as string).slice(0, 4)}...${(body.apiKey as string).slice(-4)}`
        : store[idx].apiKey,
      id,
      updatedAt: now,
    };
    return ok(store[idx], '修改成功');
  }),

  // 删除
  http.delete('/api/ai/providers/:id', ({ params }) => {
    const id = Number(params.id);
    const idx = store.findIndex((p) => p.id === id);
    if (idx === -1) return notFound('服务商不存在', { status: 404 });
    store.splice(idx, 1);
    return ok(null, '删除成功');
  }),

  // 设为默认
  http.post('/api/ai/providers/:id/set-default', ({ params }) => {
    const id = Number(params.id);
    const item = store.find((p) => p.id === id);
    if (!item) return notFound('服务商不存在', { status: 404 });
    store.forEach((p) => { p.isDefault = p.id === id; });
    return ok(null, '已设为默认');
  }),
];
