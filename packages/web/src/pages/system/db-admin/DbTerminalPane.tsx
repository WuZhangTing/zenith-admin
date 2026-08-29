import { useMemo } from 'react';
import { Button, Space, Tag, Tooltip, Typography } from '@douyinfe/semi-ui';
import TerminalTab from '../terminal/TerminalTab';
import { terminalSessionStore } from '../terminal/terminalSessionStore';
import '../terminal/terminal-split.css';

const { Text } = Typography;

/** psql 快捷命令；insertOnly 的命令只回填不回车（等待用户补参数） */
const QUICK_COMMANDS: Array<{ text: string; command: string; tip: string; insertOnly?: boolean }> = [
  { text: '\\dt', command: '\\dt', tip: '列出当前库的表' },
  { text: '\\d', command: '\\d ', tip: '查看表结构（补表名后回车）', insertOnly: true },
  { text: '\\l', command: '\\l', tip: '列出数据库' },
  { text: '\\du', command: '\\du', tip: '列出角色' },
  { text: '\\timing', command: '\\timing', tip: '切换语句计时' },
  { text: '\\x', command: '\\x', tip: '切换扩展显示（竖排结果）' },
  { text: '\\conninfo', command: '\\conninfo', tip: '当前连接信息' },
];

export type DbTerminalShell = 'db-psql' | 'db-psql:rw';

interface DbTerminalPaneProps {
  /** 前端面板句柄（终端会话 store 的 key） */
  readonly paneId: string;
  readonly shell: DbTerminalShell;
  readonly active: boolean;
}

/**
 * 数据库管理页内嵌 psql 终端面板。
 *
 * 复用系统终端的 xterm/WebSocket 基建（录制、断线重连、监控随之生效），
 * 服务端按 shell 标识注入数据库连接，前端不接触任何凭据。
 */
export function DbTerminalPane({ paneId, shell, active }: DbTerminalPaneProps) {
  const readOnly = shell === 'db-psql';
  const label = useMemo(() => (readOnly ? 'psql · 只读' : 'psql · 读写'), [readOnly]);

  const runCommand = (command: string, insertOnly?: boolean) => {
    terminalSessionStore.sendInput(paneId, insertOnly ? command : `${command}\r`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 }}>
      <Space wrap>
        {readOnly ? (
          <Tooltip content="默认事务级别为只读，用于防误操作；权限边界以数据库终端权限为准">
            <Tag color="green">只读</Tag>
          </Tooltip>
        ) : (
          <Tag color="orange">读写</Tag>
        )}
        {QUICK_COMMANDS.map((c) => (
          <Tooltip key={c.text} content={c.tip}>
            <Button size="small" theme="borderless" onClick={() => runCommand(c.command, c.insertOnly)}>
              <span style={{ fontFamily: 'var(--semi-font-family-code, monospace)' }}>{c.text}</span>
            </Button>
          </Tooltip>
        ))}
        <Text type="tertiary" size="small">会话自动录制审计 · 关闭标签即结束连接</Text>
      </Space>
      <div style={{ flex: 1, minHeight: 320, border: '1px solid var(--semi-color-border)', borderRadius: 'var(--semi-border-radius-medium)', overflow: 'hidden' }}>
        <TerminalTab sessionId={paneId} active={active} shell={shell} label={label} />
      </div>
    </div>
  );
}
