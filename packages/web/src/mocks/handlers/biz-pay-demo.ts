import { http } from 'msw';
import { ok, badRequest, notFound, pageParams } from '@/mocks/utils/handlers';
import type { BizPayDemo } from '@zenith/shared/biz';
import type { CreatePaymentResult, PaymentChannel, PaymentMethod } from '@zenith/shared/payment';
import { mockBizPayDemos, getNextPayDemoId } from '@/mocks/data/biz-pay-demo';
import { mockDateTime } from '@/mocks/utils/date';

const channelOf = (m: PaymentMethod): PaymentChannel => (m.startsWith('wechat') ? 'wechat' : 'alipay');

export const bizPayDemoHandlers = [
  // 列表
  http.get('/api/biz/pay-demos', ({ request }) => {
    const url = new URL(request.url);
    const { page, pageSize } = pageParams(url);
    const status = url.searchParams.get('status') ?? '';
    const keyword = (url.searchParams.get('keyword') ?? '').trim().toLowerCase();
    let list = [...mockBizPayDemos].sort((a, b) => b.id - a.id);
    if (status) list = list.filter((d) => d.status === status);
    if (keyword) list = list.filter((d) => d.subject.toLowerCase().includes(keyword));
    const total = list.length;
    const paged = list.slice((page - 1) * pageSize, page * pageSize);
    return ok({ list: paged, total, page, pageSize });
  }),

  // 详情
  http.get('/api/biz/pay-demos/:id', ({ params }) => {
    const demo = mockBizPayDemos.find((d) => d.id === Number(params.id));
    if (!demo) return notFound('示例单不存在');
    return ok(demo);
  }),

  // 新建
  http.post('/api/biz/pay-demos', async ({ request }) => {
    const body = await request.json() as Partial<BizPayDemo>;
    const now = mockDateTime();
    const demo: BizPayDemo = {
      id: getNextPayDemoId(),
      subject: body.subject ?? '示例事项',
      amount: Number(body.amount ?? 0),
      payMethod: null,
      status: 'pending',
      paymentOrderNo: null,
      paidAt: null,
      fulfillRemark: null,
      tenantId: 1,
      createdAt: now,
      updatedAt: now,
    };
    mockBizPayDemos.unshift(demo);
    return ok(demo, '创建成功');
  }),

  // 删除
  http.delete('/api/biz/pay-demos/:id', ({ params }) => {
    const idx = mockBizPayDemos.findIndex((d) => d.id === Number(params.id));
    if (idx === -1) return notFound('示例单不存在');
    if (mockBizPayDemos[idx].status === 'paid') return badRequest('已支付的示例单不可删除');
    mockBizPayDemos.splice(idx, 1);
    return ok(null, '已删除');
  }),

  // 发起支付：返回二维码/跳转链接，并置「支付中」
  http.post('/api/biz/pay-demos/:id/pay', async ({ params, request }) => {
    const demo = mockBizPayDemos.find((d) => d.id === Number(params.id));
    if (!demo) return notFound('示例单不存在');
    if (demo.status === 'paid') return badRequest('该示例单已支付，无需重复发起');
    const body = await request.json() as { payMethod: PaymentMethod };
    const payMethod = body.payMethod;
    const channel = channelOf(payMethod);
    const orderNo = `PAYDEMO${Date.now()}${demo.id}`;
    demo.status = 'paying';
    demo.payMethod = payMethod;
    demo.paymentOrderNo = orderNo;
    demo.updatedAt = mockDateTime();
    const payParams: CreatePaymentResult = {
      orderNo,
      payMethod,
      channel,
      ...(channel === 'wechat'
        ? { codeUrl: `weixin://wxpay/bizpayurl?pr=DEMO${demo.id}` }
        : { payUrl: `https://example.com/mock-alipay/pay?orderNo=${orderNo}` }),
    };
    return ok({ demo, payParams }, '下单成功');
  }),

  // 模拟支付成功：履约（置 paid + 发放权益）
  http.post('/api/biz/pay-demos/:id/simulate-paid', ({ params }) => {
    const demo = mockBizPayDemos.find((d) => d.id === Number(params.id));
    if (!demo) return notFound('示例单不存在');
    if (demo.status !== 'paid') {
      const now = mockDateTime();
      demo.status = 'paid';
      demo.paidAt = now;
      demo.paymentOrderNo = demo.paymentOrderNo ?? `PAYDEMO${Date.now()}${demo.id}`;
      demo.fulfillRemark = '支付成功，已自动发放示例权益（演示履约）';
      demo.updatedAt = now;
    }
    return ok(demo, '已模拟支付成功');
  }),
];
