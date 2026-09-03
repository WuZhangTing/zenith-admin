import { Modal } from '@douyinfe/semi-ui';
import type { ModalReactProps } from '@douyinfe/semi-ui/lib/es/modal';

/**
 * 危险操作确认弹窗。
 *
 * 破坏性操作（删除、清空、彻底移除、强制下线、回滚…）的确认按钮必须是红色实心，
 * 与普通确认在视觉上区分开。此前这条样式由每个调用点手写
 * `okButtonProps: { type: 'danger', theme: 'solid' }`，漏写就会渲染成蓝色主按钮，
 * 用户在「确定删除」与「确定提交」上看到同一个按钮。
 *
 * 除注入按钮样式外，其余选项原样透传给 `Modal.confirm`——
 * **文案不做统一**：`'确定要删除该评测集吗？'` 这类具体文案比通用文案更能防误操作。
 *
 * @example
 * confirmDanger({ title: `停用「${name}」？`, content: '停用后不再对外可见', onOk: () => disable(id) });
 */
export function confirmDanger(options: ModalReactProps) {
  return Modal.confirm({
    ...options,
    // 允许调用点覆盖（如需要 theme='light' 的弱化样式）
    okButtonProps: { type: 'danger', theme: 'solid', ...options.okButtonProps },
  });
}

/**
 * 删除确认弹窗：`confirmDanger` 的删除专用形态，仅多一个默认标题。
 *
 * @example
 * confirmDelete({ onOk: () => handleDelete(row.id) });                       // 用默认标题
 * confirmDelete({ title: '确定要删除该标签吗？', onOk: () => remove(id) });   // 指明删除对象
 * confirmDelete({ title: '确定要删除吗？', content: '删除后不可恢复', onOk });
 */
export function confirmDelete(options: ModalReactProps = {}) {
  return confirmDanger({ title: '确定要删除吗？', ...options });
}

/**
 * `confirmDanger` 的 Promise 形态：确认返回 true，取消或关闭返回 false，
 * 供 async 流程在用户确认后继续执行（如停用前二次确认）。
 *
 * @example
 * if (!(await confirmDangerAsync({ title: `确认停用「${name}」？`, okText: '确认停用' }))) return;
 */
export function confirmDangerAsync(options: Omit<ModalReactProps, 'onOk' | 'onCancel'>): Promise<boolean> {
  return new Promise((resolve) => {
    confirmDanger({ ...options, onOk: () => resolve(true), onCancel: () => resolve(false) });
  });
}