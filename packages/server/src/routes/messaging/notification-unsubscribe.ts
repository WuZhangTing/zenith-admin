/**
 * 公开退订端点（无需登录，凭 HMAC 签名令牌）。
 *
 * GET 返回极简确认页（人点按钮确认，避免邮件客户端预取链接造成误退订）；
 * POST 实际应用退订（同时兼容 RFC 8058 One-Click：客户端直接 POST 本地址）。
 */
import { Hono } from 'hono';
import { verifyUnsubscribeToken } from '../../lib/notification/unsubscribe';
import { applyUnsubscribe } from '../../services/messaging/notification-preferences.service';

const router = new Hono();

function page(title: string, body: string): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;display:flex;justify-content:center;padding:64px 16px;background:#f5f6f8;color:#1f2329}
.card{background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.06);padding:32px;max-width:420px;width:100%}
h2{margin:0 0 12px;font-size:18px}p{margin:8px 0;color:#555;font-size:14px;line-height:1.6}
button{margin-top:16px;background:#0064fa;color:#fff;border:none;border-radius:6px;padding:10px 20px;font-size:14px;cursor:pointer}
button:hover{background:#0052cc}</style></head>
<body><div class="card">${body}</div></body></html>`;
}

router.get('/:token', (c) => {
  const payload = verifyUnsubscribeToken(c.req.param('token'));
  if (!payload) {
    return c.html(page('链接无效', '<h2>链接无效或已过期</h2><p>退订链接已失效。你可以登录系统，在「个人中心 → 通知设置」中管理通知偏好。</p>'), 400);
  }
  return c.html(page('退订确认', `
    <h2>确认退订邮件通知？</h2>
    <p>${payload.scope === 'event' ? '将不再通过邮件接收该类型的通知。' : '将不再通过邮件接收全部可退订通知。'}</p>
    <p>站内通知不受影响；你也可以随时在「个人中心 → 通知设置」中重新开启。</p>
    <form method="post"><button type="submit">确认退订</button></form>
  `));
});

router.post('/:token', async (c) => {
  const payload = verifyUnsubscribeToken(c.req.param('token'));
  if (!payload) {
    return c.html(page('链接无效', '<h2>链接无效或已过期</h2><p>退订链接已失效，未做任何变更。</p>'), 400);
  }
  const { eventLabels } = await applyUnsubscribe(payload);
  const detail = payload.scope === 'event'
    ? `已退订「${eventLabels[0] ?? payload.eventKey}」的邮件通知。`
    : `已退订 ${eventLabels.length} 类通知的邮件推送。`;
  return c.html(page('退订成功', `<h2>退订成功</h2><p>${detail}</p><p>如需恢复，请登录系统在「个人中心 → 通知设置」中重新开启。</p>`));
});

export default router;
