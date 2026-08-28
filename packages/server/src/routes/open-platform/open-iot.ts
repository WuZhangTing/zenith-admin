/**
 * IoT 开放 API（`/api/open/v1/iot/*`）。
 *
 * 面向第三方应用的设备查询与控制通道：对外以 SN 寻址，不暴露内部 id 与密钥。
 * 鉴权链（签名 → 计量 → 限流）由 open-gateway 挂载，本模块只做 scope 校验与业务编排。
 *   - iot:read  设备列表 / 详情（含影子）
 *   - iot:write 服务调用指令 / 期望属性下发
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sendIotCommandSchema, setIotDesiredSchema } from '@zenith/shared/iot';
import {
  ErrorResponse, commonErrorResponses, jsonContent, ok, okBody, okPaginated,
  PaginationQuery, validationHook,
} from '../../lib/openapi-schemas';
import { OpenIotDeviceDTO, OpenIotDeviceDetailDTO } from '../../lib/openapi-dtos';
import {
  findOpenIotDeviceBySn, getOpenIotDeviceDetail, listOpenIotDevices,
} from '../../services/iot/iot-open.service';
import type { IotDeviceRow } from '../../db/schema';

const router = new OpenAPIHono({ defaultHook: validationHook });

/** 声明本次调用所需 scope（供计量记录），未授权直接 403 */
function requireScope(scope: string): MiddlewareHandler {
  return async (c, next) => {
    c.set('openScope', scope);
    if (!c.get('openPrincipal')?.scopes.includes(scope)) {
      throw new HTTPException(403, { message: `应用未授权 scope：${scope}` });
    }
    await next();
  };
}

async function requireDevice(sn: string): Promise<IotDeviceRow> {
  const device = await findOpenIotDeviceBySn(sn);
  if (!device) throw new HTTPException(404, { message: `设备「${sn}」不存在` });
  return device;
}

const SnParam = z.object({
  sn: z.string().min(1).max(64).openapi({ description: '设备序列号', example: 'SN-0001' }),
});

// ─── 设备查询（iot:read）─────────────────────────────────────────────────────

const listDevicesRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/iot/devices',
    tags: ['开放 API · IoT'], summary: '设备列表（含在线状态）',
    middleware: [requireScope('iot:read')] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional().openapi({ description: 'SN / 名称模糊搜索' }),
        productId: z.coerce.number().int().positive().optional(),
        status: z.enum(['enabled', 'disabled']).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(OpenIotDeviceDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listOpenIotDevices(c.req.valid('query'))), 200),
});

const getDeviceRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/iot/devices/{sn}',
    tags: ['开放 API · IoT'], summary: '设备详情（含设备影子 reported / desired）',
    middleware: [requireScope('iot:read')] as const,
    request: { params: SnParam },
    responses: {
      ...commonErrorResponses,
      ...ok(OpenIotDeviceDetailDTO, 'ok'),
      404: { content: jsonContent(ErrorResponse), description: '设备不存在' },
    },
  }),
  handler: async (c) => {
    const device = await requireDevice(c.req.valid('param').sn);
    return c.json(okBody(await getOpenIotDeviceDetail(device)), 200);
  },
});

// ─── 设备控制（iot:write）────────────────────────────────────────────────────

const CommandAcceptedDTO = z.object({
  commandId: z.number().int(),
  service: z.string(),
  status: z.string(),
  expireAt: z.string(),
}).openapi('OpenIotCommandAccepted');

const sendCommandRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/iot/devices/{sn}/commands',
    tags: ['开放 API · IoT'], summary: '下发服务调用指令（在线即推、离线排队至过期）',
    middleware: [requireScope('iot:write')] as const,
    request: { params: SnParam, body: { content: jsonContent(sendIotCommandSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(CommandAcceptedDTO, '已受理'),
      404: { content: jsonContent(ErrorResponse), description: '设备不存在' },
    },
  }),
  handler: async (c) => {
    const device = await requireDevice(c.req.valid('param').sn);
    const { sendIotCommandToDevice } = await import('../../services/iot/iot-telemetry.service');
    const cmd = await sendIotCommandToDevice(device, c.req.valid('json'));
    return c.json(okBody({
      commandId: cmd.id, service: cmd.service, status: cmd.status, expireAt: cmd.expireAt,
    }, '指令已受理'), 200);
  },
});

const ShadowResultDTO = z.object({
  reported: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
  desired: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
  desiredVersion: z.number().int(),
  reportedAt: z.string().nullable(),
  desiredAt: z.string().nullable(),
}).openapi('OpenIotShadow');

const setDesiredRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/iot/devices/{sn}/desired',
    tags: ['开放 API · IoT'], summary: '设置期望属性（合并写入，设备上线后收敛）',
    middleware: [requireScope('iot:write')] as const,
    request: { params: SnParam, body: { content: jsonContent(setIotDesiredSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(ShadowResultDTO, '已写入'),
      404: { content: jsonContent(ErrorResponse), description: '设备不存在' },
    },
  }),
  handler: async (c) => {
    const device = await requireDevice(c.req.valid('param').sn);
    const { setIotDesiredForDevice } = await import('../../services/iot/iot-shadow.service');
    const shadow = await setIotDesiredForDevice(device, c.req.valid('json'));
    return c.json(okBody({
      reported: shadow.reported, desired: shadow.desired, desiredVersion: shadow.desiredVersion,
      reportedAt: shadow.reportedAt, desiredAt: shadow.desiredAt,
    }, '期望属性已写入'), 200);
  },
});

router.openapiRoutes([
  listDevicesRoute,
  getDeviceRoute,
  sendCommandRoute,
  setDesiredRoute,
] as const);

export default router;

/** 供 API 调试台展示的端点目录 */
export const OPEN_IOT_ENDPOINTS: Array<{ method: string; path: string; summary: string; scope: string | null }> = [
  { method: 'GET', path: '/api/open/v1/iot/devices', summary: 'IoT 设备列表（含在线状态）', scope: 'iot:read' },
  { method: 'GET', path: '/api/open/v1/iot/devices/{sn}', summary: 'IoT 设备详情（含影子）', scope: 'iot:read' },
  { method: 'POST', path: '/api/open/v1/iot/devices/{sn}/commands', summary: 'IoT 下发服务调用指令', scope: 'iot:write' },
  { method: 'POST', path: '/api/open/v1/iot/devices/{sn}/desired', summary: 'IoT 设置期望属性', scope: 'iot:write' },
];
