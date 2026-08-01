import { describe, expect, it } from 'vitest';
import {
  badRequest,
  conflict,
  fail,
  forbidden,
  locked,
  nextIdFrom,
  notFound,
  ok,
  pageParams,
  pageResult,
  paginate,
  unauthorized,
} from './handlers';

const body = async (res: Response) => res.json() as Promise<Record<string, unknown>>;

describe('mock 响应构造', () => {
  it('ok 默认 message 为 ok，HTTP 状态为 200', async () => {
    const res = ok({ id: 1 });
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ code: 0, message: 'ok', data: { id: 1 } });
  });

  it('ok 省略 data 时响应体不含 data 字段', async () => {
    // 与内联写法 `HttpResponse.json({ code: 0, message: '删除成功' })` 保持一致，
    // 不能退化成 `data: null`
    expect(await body(ok(undefined, '删除成功'))).toEqual({ code: 0, message: '删除成功' });
  });

  it('ok 显式传 null 时保留 data: null', async () => {
    expect(await body(ok(null, '删除成功'))).toEqual({ code: 0, message: '删除成功', data: null });
  });

  it('失败构造函数使用约定的业务 code，data 固定为 null', async () => {
    const cases = [
      [badRequest('参数错误'), 400],
      [unauthorized('未登录'), 401],
      [forbidden('无权限'), 403],
      [notFound('不存在'), 404],
      [conflict('冲突'), 409],
      [locked('已锁定'), 423],
    ] as const;
    for (const [res, code] of cases) {
      expect(await body(res)).toMatchObject({ code, data: null });
    }
  });

  it('默认不设置 HTTP 状态码，传入 ResponseInit 时才透传', () => {
    // 历史上两种写法并存，且 mocks/*.test.ts 有 expect(res.status) 断言，不能统一
    expect(notFound('不存在').status).toBe(200);
    expect(notFound('不存在', { status: 404 }).status).toBe(404);
    expect(fail(423, '已锁定', { status: 423 }).status).toBe(423);
  });
});

describe('mock 分页', () => {
  const list = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));

  it('缺省或非法的分页参数回落到默认值', () => {
    expect(pageParams(new URL('http://x/api'))).toEqual({ page: 1, pageSize: 10 });
    expect(pageParams(new URL('http://x/api'), 20)).toEqual({ page: 1, pageSize: 20 });
    expect(pageParams(new URL('http://x/api?page=&pageSize=abc'), 20)).toEqual({ page: 1, pageSize: 20 });
  });

  it('paginate 按 query 切片并返回总数', () => {
    const res = paginate(list, new URL('http://x/api?page=3&pageSize=10'));
    expect(res).toEqual({ list: [{ id: 21 }, { id: 22 }, { id: 23 }, { id: 24 }, { id: 25 }], total: 25, page: 3, pageSize: 10 });
  });

  it('pageResult 与 paginate 对同样的页码等价', () => {
    expect(pageResult(list, 2, 10)).toEqual(paginate(list, new URL('http://x/api?page=2&pageSize=10')));
  });

  it('越界页码返回空列表但保留总数', () => {
    expect(paginate(list, new URL('http://x/api?page=9&pageSize=10'))).toEqual({ list: [], total: 25, page: 9, pageSize: 10 });
  });
});

describe('nextIdFrom', () => {
  it('取最大 id 加一', () => {
    expect(nextIdFrom([{ id: 3 }, { id: 7 }, { id: 5 }])).toBe(8);
  });

  it('空列表返回 1（内联的 Math.max 写法此处会得到 -Infinity）', () => {
    expect(nextIdFrom([])).toBe(1);
  });
});
