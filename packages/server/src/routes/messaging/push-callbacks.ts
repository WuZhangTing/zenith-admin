/**
 * App 推送送达回执回调（公开,供应商服务端调用,无需登录）。
 *
 * POST /api/public/push/callbacks/jpush
 *
 * 极光在控制台配置回调地址后,以 HTTP POST 推送送达/点击回执。
 * 报文宽松解析:data 支持单事件或事件数组;type 兼容字符串与数字编码。
 * 未匹配到发送记录的事件静默忽略并计数——对回调方永远返回 200,避免重试轰炸。
 * 真实对接时如启用极光回调验签,在此处补充 token/sign 校验。
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { commonErrorResponses, jsonContent, ok, okBody, validationHook } from '../../lib/openapi-schemas';
import logger from '../../lib/logger';
import { applyPushReceipt } from '../../services/messaging/push-send-logs.service';

const router = new OpenAPIHono({ defaultHook: validationHook });

const JPushReceiptEvent = z.looseObject({
  msg_id: z.union([z.string(), z.number()]),
  /** received/0=送达,click/opened/1=点击 */
  type: z.union([z.string(), z.number()]).optional(),
  registration_id: z.string().optional(),
  /** 事件发生时间（秒级时间戳） */
  itime: z.number().optional(),
});

const JPushCallbackBody = z.object({
  appKey: z.string().optional(),
  token: z.string().optional(),
  data: z.union([JPushReceiptEvent, z.array(JPushReceiptEvent)]),
}).openapi('JPushCallbackBody');

const ResultDTO = z.object({
  received: z.number().openapi({ example: 2, description: '本次回调携带的事件数' }),
  processed: z.number().openapi({ example: 2, description: '成功写回发送记录的事件数' }),
}).openapi('PushCallbackResult');

function normalizeReceiptType(type: string | number | undefined): 'received' | 'click' | null {
  if (type === undefined || type === 'received' || type === 0) return 'received';
  if (type === 'click' || type === 'opened' || type === 1) return 'click';
  return null;
}

const jpushCallbackRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post',
    path: '/jpush',
    tags: ['推送管理'],
    summary: '极光送达/点击回执回调（公开）',
    security: [],
    request: { body: { content: jsonContent(JPushCallbackBody), required: true } },
    responses: { ...commonErrorResponses, ...ok(ResultDTO, '回执处理结果') },
  }),
  handler: async (c) => {
    const body = c.req.valid('json');
    const events = Array.isArray(body.data) ? body.data : [body.data];
    let processed = 0;
    for (const event of events) {
      const type = normalizeReceiptType(event.type);
      if (!type) continue;
      const updated = await applyPushReceipt({
        provider: 'jpush',
        msgId: String(event.msg_id),
        type,
        itime: event.itime,
      });
      if (updated) processed += 1;
    }
    if (processed < events.length) {
      logger.info(`[push-callbacks] 极光回执 ${events.length} 条,写回 ${processed} 条（其余无匹配记录或已幂等跳过）`);
    }
    return c.json(okBody({ received: events.length, processed }), 200);
  },
});

router.openapiRoutes([jpushCallbackRoute] as const);

export default router;
