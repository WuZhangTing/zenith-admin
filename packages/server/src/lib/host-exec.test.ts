import { describe, expect, it } from 'vitest';
import { buildShellCommand, shellQuoteArg } from './host-exec';

describe('shellQuoteArg(POSIX 单引号编码)', () => {
  it('空串与普通参数', () => {
    expect(shellQuoteArg('')).toBe("''");
    expect(shellQuoteArg('abc')).toBe("'abc'");
    expect(shellQuoteArg('/var/log/syslog')).toBe("'/var/log/syslog'");
  });

  it('单引号以 quote-escape-quote 缝合', () => {
    expect(shellQuoteArg("it's")).toBe("'it'\\''s'");
    expect(shellQuoteArg("''")).toBe("''\\'''\\'''");
  });

  it('shell 元字符全部字面量化', () => {
    for (const dangerous of [
      '; rm -rf /',
      '$(reboot)',
      '`reboot`',
      'a && b',
      'a | b',
      'a > /etc/passwd',
      'a\nb',
      '${HOME}',
      '*',
      '~root',
      '!!',
      'a\tb',
      '--flag=$(id)',
    ]) {
      const quoted = shellQuoteArg(dangerous);
      expect(quoted.startsWith("'")).toBe(true);
      expect(quoted.endsWith("'")).toBe(true);
      // 编码结果内不存在裸(未被单引号包裹的)元字符:除缝合序列 '\'' 外全部处于引号内
      const outsideQuotes = quoted.split(/'(?:[^']*)'/).join('');
      expect(outsideQuotes.replaceAll("\\'", '')).toBe('');
    }
  });

  it('buildShellCommand 拼接 argv', () => {
    expect(buildShellCommand('tail', ['-n', '100', '/var/log/a b.log']))
      .toBe("'tail' '-n' '100' '/var/log/a b.log'");
    expect(buildShellCommand('kill', ['-SIGTERM', '123; reboot']))
      .toBe("'kill' '-SIGTERM' '123; reboot'");
  });
});
