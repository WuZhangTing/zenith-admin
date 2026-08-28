/**
 * 数据导入中心 API（/api/import-jobs）。
 * 历史/进度/行级明细复用任务中心接口（taskType 'data-import'）。
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { submitImportJobSchema } from '@zenith/shared/tasks';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import { commonErrorResponses, jsonContent, ok, okBody, okFile, validationHook } from '../../lib/openapi-schemas';
import { AsyncTaskDTO, ImportEntityMetaDTO } from '../../lib/openapi-dtos';
import { mapAsyncTask } from '../../lib/task-center/map';
import { registerImportDefinitions } from '../../lib/import-center/definitions';
import { getImportTemplate, listImportEntities, submitImportJob } from '../../services/tasks/import-jobs.service';

registerImportDefinitions();

const importJobsRoute = new OpenAPIHono({ defaultHook: validationHook });

const EntityParam = z.object({
  entity: z.string().min(1).max(64).openapi({ param: { name: 'entity', in: 'path' }, example: 'member.members' }),
});

const entitiesRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/entities', tags: ['ImportJobs'], summary: '可导入实体列表（按权限过滤）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware] as const,
    responses: { ...commonErrorResponses, ...ok(z.array(ImportEntityMetaDTO), '可导入实体') },
  }),
  handler: async (c) => c.json(okBody(await listImportEntities()), 200),
});

const templateRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{entity}/template', tags: ['ImportJobs'], summary: '下载导入模板',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware] as const,
    request: { params: EntityParam },
    responses: { ...commonErrorResponses, ...okFile('导入模板 xlsx') },
  }),
  handler: async (c) => {
    const { entity } = c.req.valid('param');
    const { buffer, filename } = await getImportTemplate(entity);
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'X-Content-Type-Options': 'nosniff',
      },
    }) as never;
  },
});

const submitRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/', tags: ['ImportJobs'], summary: '提交导入任务（文件先经 /api/files/upload 上传）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ audit: { description: '提交数据导入任务', module: '导入中心' } })] as const,
    request: { body: { content: jsonContent(submitImportJobSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(AsyncTaskDTO, '导入任务已提交') },
  }),
  handler: async (c) => {
    const { entity, fileId, dryRun, context } = c.req.valid('json');
    const row = await submitImportJob(entity, fileId, { dryRun, context });
    return c.json(okBody(mapAsyncTask(row), dryRun ? '预检任务已提交（不落库）' : '导入任务已提交，可在任务中心查看进度与行级明细'), 200);
  },
});

importJobsRoute.openapiRoutes([entitiesRoute, templateRoute, submitRoute] as const);

export default importJobsRoute;
