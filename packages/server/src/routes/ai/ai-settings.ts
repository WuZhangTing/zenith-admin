import { OpenAPIHono, createRoute, defineOpenAPIRoute } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { jsonContent, validationHook, commonErrorResponses, ok, okMsg, okBody } from '../../lib/openapi-schemas';
import { AiUserSettingsDTO, AiMemoryProfileDTO } from '../../lib/openapi-dtos';
import { getMyAiSettings, saveMyAiSettings } from '../../services/ai/ai-user-settings.service';
import { getMemoryProfile, updateMemoryProfile, clearMemoryProfile } from '../../services/ai/ai-memory.service';
import { currentUser } from '../../lib/context';
import { saveAiUserSettingsSchema, updateAiMemoryProfileSchema } from '@zenith/shared/ai';

const router = new OpenAPIHono({ defaultHook: validationHook });

const get = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/',
    tags: ['AI'],
    summary: '获取我的 AI 设置（个人指令 / AI 记忆开关等）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware] as const,
    responses: { ...commonErrorResponses, ...ok(AiUserSettingsDTO, 'AI 设置') },
  }),
  handler: async (c) => c.json(okBody(await getMyAiSettings()), 200),
});

const save = defineOpenAPIRoute({
  route: createRoute({
    method: 'put',
    path: '/',
    tags: ['AI'],
    summary: '保存我的 AI 设置（域内字段级合并）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware] as const,
    request: { body: { content: jsonContent(saveAiUserSettingsSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(AiUserSettingsDTO, '保存成功') },
  }),
  handler: async (c) => c.json(okBody(await saveMyAiSettings(c.req.valid('json')), '保存成功'), 200),
});

const getProfile = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/memory-profile',
    tags: ['AI'],
    summary: '查看我的 AI 记忆画像（working memory）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware] as const,
    responses: { ...commonErrorResponses, ...ok(AiMemoryProfileDTO, 'AI 记忆画像') },
  }),
  handler: async (c) => {
    const user = currentUser();
    return c.json(okBody({ content: await getMemoryProfile(user.userId) }), 200);
  },
});

const putProfile = defineOpenAPIRoute({
  route: createRoute({
    method: 'put',
    path: '/memory-profile',
    tags: ['AI'],
    summary: '编辑我的 AI 记忆画像',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware] as const,
    request: { body: { content: jsonContent(updateAiMemoryProfileSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(AiMemoryProfileDTO, '保存成功') },
  }),
  handler: async (c) => {
    const user = currentUser();
    const { content } = c.req.valid('json');
    await updateMemoryProfile(user.userId, content);
    return c.json(okBody({ content: content || null }, '保存成功'), 200);
  },
});

const deleteProfile = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete',
    path: '/memory-profile',
    tags: ['AI'],
    summary: '清空我的 AI 记忆画像',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware] as const,
    responses: { ...commonErrorResponses, ...okMsg('已清空') },
  }),
  handler: async (c) => {
    const user = currentUser();
    await clearMemoryProfile(user.userId);
    return c.json(okBody(null, '已清空'), 200);
  },
});

router.openapiRoutes([get, save, getProfile, putProfile, deleteProfile] as const);

export default router;
