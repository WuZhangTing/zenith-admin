import type { MpCredential } from './api';

/**
 * 微信 API 沙箱：演示账号不出网，按接口路径返回可信的模拟成功响应。
 *
 * seed 的示例公众号（appId 以 `wxdemo` 开头）没有真实微信凭证，直连
 * api.weixin.qq.com 必然报 40013 invalid appid，导致演示环境所有
 * 公众号写操作不可用。在 api.ts / access-token.ts 收口层识别沙箱账号
 * 短路返回，全部 mp 服务无需感知。
 */

const SANDBOX_APPID_PREFIX = 'wxdemo';

export function isSandboxAccount(account: Pick<MpCredential, 'appId'>): boolean {
  return account.appId.startsWith(SANDBOX_APPID_PREFIX);
}

let sandboxSeq = 0;

function nextId(): number {
  sandboxSeq += 1;
  return Date.now() * 100 + (sandboxSeq % 100);
}

/** 按接口路径返回模拟响应；未特殊处理的路径统一返回 errcode 0 */
export function sandboxCall<T>(path: string, body?: Record<string, unknown> | unknown[]): T {
  const ok = { errcode: 0, errmsg: 'ok' };
  const b = (body ?? {}) as Record<string, unknown>;

  // 带参二维码：返回沙箱 ticket（前端凭 url 展示，演示环境为占位地址）
  if (path === '/cgi-bin/qrcode/create') {
    const isTemp = b.action_name === 'QR_STR_SCENE';
    return { ...ok, ticket: `sandbox-ticket-${nextId()}`, ...(isTemp ? { expire_seconds: b.expire_seconds ?? 604800 } : {}) } as T;
  }
  // 群发：返回模拟 msg_id；状态查询恒为发送成功
  if (path === '/cgi-bin/message/mass/sendall') {
    return { ...ok, msg_id: nextId(), msg_data_id: nextId() } as T;
  }
  if (path === '/cgi-bin/message/mass/get') {
    return { ...ok, msg_status: 'SEND_SUCCESS', total_count: 0, filter_count: 0, sent_count: 0, error_count: 0 } as T;
  }
  // 图文草稿：返回沙箱 media_id
  if (path === '/cgi-bin/draft/add') {
    return { ...ok, media_id: `sandbox-draft-${nextId()}` } as T;
  }
  // 个性化菜单：返回沙箱 menuid
  if (path === '/cgi-bin/menu/addconditional') {
    return { ...ok, menuid: `sandbox-menu-${nextId()}` } as T;
  }
  // 菜单查询 / 匹配测试：空菜单（本地库是权威数据源）
  if (path === '/cgi-bin/menu/get') {
    return { ...ok, menu: { button: [] } } as T;
  }
  if (path === '/cgi-bin/menu/trymatch') {
    return { ...ok, button: [] } as T;
  }
  // 模板消息：发送返回模拟 msgid；列表 / 行业为空
  if (path === '/cgi-bin/message/template/send') {
    return { ...ok, msgid: nextId() } as T;
  }
  if (path === '/cgi-bin/template/get_all_private_template') {
    return { ...ok, template_list: [] } as T;
  }
  if (path === '/cgi-bin/template/get_industry') {
    return { ...ok, primary_industry: { first_class: 'IT科技', second_class: '互联网|电子商务' }, secondary_industry: { first_class: 'IT科技', second_class: 'IT软件与服务' } } as T;
  }
  // JS-SDK ticket
  if (path === '/cgi-bin/ticket/getticket') {
    return { ...ok, ticket: `sandbox-jsapi-${nextId()}`, expires_in: 7200 } as T;
  }
  // 内容安全：一律通过
  if (path === '/wxa/msg_sec_check') {
    return { ...ok, result: { suggest: 'pass', label: 100 } } as T;
  }
  // 粉丝 / 标签 / 黑名单 / 客服 / 素材 / 统计：空集合（本地库承载演示数据）
  if (path === '/cgi-bin/tags/get') {
    return { ...ok, tags: [] } as T;
  }
  if (path === '/cgi-bin/user/get') {
    return { ...ok, total: 0, count: 0, data: { openid: [] }, next_openid: '' } as T;
  }
  if (path === '/cgi-bin/user/info/batchget') {
    return { ...ok, user_info_list: [] } as T;
  }
  if (path === '/cgi-bin/tags/members/getblacklist') {
    return { ...ok, total: 0, count: 0, data: { openid: [] }, next_openid: '' } as T;
  }
  if (path === '/cgi-bin/customservice/getkflist') {
    return { ...ok, kf_list: [] } as T;
  }
  if (path === '/cgi-bin/material/batchget_material') {
    return { ...ok, total_count: 0, item_count: 0, item: [] } as T;
  }
  if (path.startsWith('/datacube/')) {
    return { ...ok, list: [] } as T;
  }
  // 其余写操作（菜单创建/删除、客服消息、打标、拉黑、客服账号增删改等）：直接成功
  return ok as T;
}
