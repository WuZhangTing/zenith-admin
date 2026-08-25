import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import { PaginationQuery, commonErrorResponses, dateRangeBound, ok, okBody, okPaginated, validationHook } from '../../lib/openapi-schemas';
import { MemberCheckinDTO } from '../../lib/openapi-dtos';
import { getCheckinCalendar, listMemberCheckins } from '../../services/member/member-checkin.service';

const memberCheckinsRouter = new OpenAPIHono({ defaultHook: validationHook });

const querySchema = PaginationQuery.extend({
  memberKeyword: z.string().optional(),
  dateStart: dateRangeBound('起始日期').openapi({ param: { name: 'dateStart', in: 'query' }, example: '2026-06-01' }),
  dateEnd: dateRangeBound('结束日期').openapi({ param: { name: 'dateEnd', in: 'query' }, example: '2026-06-30' }),
});

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/',
    tags: ['会员签到'],
    summary: '签到记录列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'member:checkin:log:list' })] as const,
    request: { query: querySchema },
    responses: { ...commonErrorResponses, ...okPaginated(MemberCheckinDTO, '签到记录列表') },
  }),
  handler: async (c) => c.json(okBody(await listMemberCheckins(c.req.valid('query'))), 200),
});

const CheckinCalendarDayDTO = z.object({
  date: z.string().openapi({ example: '2026-08-01' }),
  count: z.number().int(),
  makeupCount: z.number().int(),
}).openapi('MemberCheckinCalendarDay');

const calendarRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/calendar',
    tags: ['会员签到'],
    summary: '签到日历（按月聚合）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'member:checkin:log:list' })] as const,
    request: { query: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, '月份格式为 YYYY-MM').openapi({ example: '2026-08' }) }) },
    responses: { ...commonErrorResponses, ...ok(z.array(CheckinCalendarDayDTO), '每日签到聚合') },
  }),
  handler: async (c) => c.json(okBody(await getCheckinCalendar(c.req.valid('query').month)), 200),
});

memberCheckinsRouter.openapiRoutes([listRoute, calendarRoute] as const);

export default memberCheckinsRouter;
