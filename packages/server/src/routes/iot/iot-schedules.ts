/**
 * IoT 设备计划任务 API（/api/iot/schedules）
 *
 * CRUD + 执行记录；到期调度由系统任务 iot-schedule-dispatch 每分钟执行。
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  ErrorResponse, jsonContent, PaginationQuery, validationHook, commonErrorResponses,
  ok, okPaginated, okMsg, IdParam, okBody,
} from '../../lib/openapi-schemas';
import { IotScheduleDTO, IotScheduleRunDTO } from '../../lib/openapi-dtos';
import { createIotScheduleSchema, updateIotScheduleSchema } from '@zenith/shared/iot';
import {
  createIotSchedule, deleteIotSchedule, ensureIotScheduleExists,
  listIotScheduleRuns, listIotSchedules, mapIotSchedule, updateIotSchedule,
} from '../../services/iot/iot-schedules.service';

export const iotSchedulesRouter = new OpenAPIHono({ defaultHook: validationHook });

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['IoT 计划任务'], summary: '计划任务列表（含下次执行时刻与近 24h 执行数）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:schedule:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        productId: z.coerce.number().int().positive().optional(),
        status: z.enum(['enabled', 'disabled']).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(IotScheduleDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listIotSchedules(c.req.valid('query'))), 200),
});

const listRunsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/runs',
    tags: ['IoT 计划任务'], summary: '计划执行记录（按时间倒序）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:schedule:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        scheduleId: z.coerce.number().int().positive().optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(IotScheduleRunDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listIotScheduleRuns(c.req.valid('query'))), 200),
});

const createScheduleRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/',
    tags: ['IoT 计划任务'], summary: '创建计划任务（cron 周期 / 定时一次）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:schedule:create',
      audit: { description: '创建 IoT 计划任务', module: 'IoT 计划任务' },
    })] as const,
    request: { body: { content: jsonContent(createIotScheduleSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(IotScheduleDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createIotSchedule(c.req.valid('json')), '创建成功'), 200),
});

const updateScheduleRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}',
    tags: ['IoT 计划任务'], summary: '更新计划任务（类型/产品/动作不可变更）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:schedule:update',
      audit: { description: '更新 IoT 计划任务', module: 'IoT 计划任务' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateIotScheduleSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(IotScheduleDTO, '更新成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, mapIotSchedule(await ensureIotScheduleExists(id)));
    return c.json(okBody(await updateIotSchedule(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteScheduleRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}',
    tags: ['IoT 计划任务'], summary: '删除计划任务（执行记录级联删除）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:schedule:delete',
      audit: { description: '删除 IoT 计划任务', module: 'IoT 计划任务' },
    })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...okMsg('删除成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, mapIotSchedule(await ensureIotScheduleExists(id)));
    await deleteIotSchedule(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

iotSchedulesRouter.openapiRoutes([
  listRoute,
  listRunsRoute,
  createScheduleRoute,
  updateScheduleRoute,
  deleteScheduleRoute,
] as const);
