/**
 * 短信模板变量装配的回归测试。
 *
 * 服务商按位置映射参数（腾讯云 `Object.values(variables)`），而事件 vars 经
 * jsonb 往返后键序会被 PG 按长度+字节序重排——曾导致腾讯云模板收到
 * [节点名, 标题, taskId, instanceId] 而注册模板只声明两个参数。
 * 锁定：变量顺序取决于模板占位符出现顺序，与来源对象键序无关；多余变量被剔除。
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../db', () => ({ db: {} }));
vi.mock('../../../services/messaging/sms-configs.service', () => ({ findDefaultSmsConfig: vi.fn() }));
vi.mock('../../sms-sender', () => ({ renderTemplate: vi.fn(), sendSmsByProvider: vi.fn() }));

import { buildTemplateVariables } from './sms.adapter';

describe('buildTemplateVariables', () => {
  const template = '你有新的待办：流程「{{title}}」（节点：{{node}}），请及时处理';

  it('按模板占位符出现顺序装配，与来源键序无关', () => {
    // 模拟 jsonb 重排后的键序：node 在 title 之前，还混入模板未声明的 id 字段
    const scrambled = { node: '部门审批', taskId: '55', title: '请假申请', instanceId: '9' };
    const variables = buildTemplateVariables(template, scrambled);
    // Object.values 的顺序（= 腾讯云位置参数）必须是 [标题, 节点]
    expect(Object.keys(variables)).toEqual(['title', 'node']);
    expect(Object.values(variables)).toEqual(['请假申请', '部门审批']);
  });

  it('剔除模板未声明的多余变量，缺失变量补空串', () => {
    const variables = buildTemplateVariables(template, { title: '报销' });
    expect(variables).toEqual({ title: '报销', node: '' });
    expect('taskId' in variables).toBe(false);
  });

  it('重复占位符只取一次', () => {
    const variables = buildTemplateVariables('{{a}}-{{b}}-{{a}}', { a: '1', b: '2' });
    expect(Object.keys(variables)).toEqual(['a', 'b']);
  });
});
