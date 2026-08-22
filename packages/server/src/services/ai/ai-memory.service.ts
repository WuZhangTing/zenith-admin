import logger from '../../lib/logger';
import { getChatMemory, chatThreadId, chatResourceId } from '../../lib/mastra';

/**
 * 账本(激活路径)→ Mastra thread 的镜像同步。
 *
 * 常态追加轮次由 Agent Memory 自动读写,零同步成本;仅分支类操作
 * (重新生成 / 编辑重发 / 切换分支 / 删除消息)触发重建:
 * 删除 thread 后按激活路径回放,使 Mastra 上下文始终等于账本激活路径。
 */

/** 账本消息 ID → 镜像消息 ID(幂等回放) */
const mirrorMsgId = (bizId: number) => `biz-${bizId}`;

export interface RebuildMirrorOptions {
  activeLeafMsgId?: number | null;
  /** 编辑重发:回放至该消息(含自身)为止的祖先链 */
  upToMsgId?: number | null;
  /** 重新生成:回放时丢弃「最后一条 user 消息(含)之后」的整段(该 user 消息随后作为本轮输入重发) */
  dropFromLastUser?: boolean;
}

/** 重建 thread 镜像 = 激活路径回放(分支操作后调用) */
export async function rebuildThreadMirror(
  conversationId: number,
  userId: number,
  opts: RebuildMirrorOptions = {},
): Promise<void> {
  // 动态 import 打破与 conversations.service 的模块环
  const { getActivePathRaw } = await import('./ai-conversations.service');
  const memory = await getChatMemory();
  const threadId = chatThreadId(conversationId);
  const resourceId = chatResourceId(userId);

  let path = await getActivePathRaw(conversationId, {
    activeLeafMsgId: opts.activeLeafMsgId ?? null,
    upToMsgId: opts.upToMsgId ?? null,
  });
  if (opts.dropFromLastUser) {
    let lastUserIdx = -1;
    for (let i = path.length - 1; i >= 0; i--) {
      if (path[i].role === 'user') { lastUserIdx = i; break; }
    }
    path = lastUserIdx >= 0 ? path.slice(0, lastUserIdx) : path;
  }

  await memory.deleteThread(threadId).catch(() => { /* thread 尚不存在 */ });
  await memory.createThread({ threadId, resourceId, saveThread: true });
  const replay = path.filter((n) => n.role !== 'system');
  if (replay.length > 0) {
    await memory.saveMessages({
      messages: replay.map((n) => ({
        id: mirrorMsgId(n.id),
        threadId,
        resourceId,
        role: n.role,
        createdAt: n.createdAt,
        content: { format: 2 as const, parts: [{ type: 'text' as const, text: n.content }], content: n.content },
      })) as never,
    });
  }
}

/** 删除 thread 镜像(删除对话时调用;失败仅告警,不阻塞业务删除) */
export async function deleteThreadMirror(conversationId: number): Promise<void> {
  try {
    const memory = await getChatMemory();
    await memory.deleteThread(chatThreadId(conversationId));
  } catch (err) {
    logger.warn('[ai-memory] delete thread mirror failed', { conversationId, err });
  }
}
