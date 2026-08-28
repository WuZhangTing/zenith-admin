declare module 'pino-roll' {
  import type { SonicBoom, SonicBoomOpts } from 'sonic-boom';

  /** 旧日志文件清理策略 */
  interface PinoRollLimitOptions {
    /** 除当前活跃文件外最多保留的轮转文件数 */
    count?: number;
    /** 为 true 时按文件名模式清理（含历史进程产生的文件），否则只清理当前进程创建的文件 */
    removeOtherLogFiles?: boolean;
  }

  /** pino-roll 构建选项（除 dest 外的 SonicBoom 选项均可透传，如 mkdir） */
  type PinoRollOptions = Omit<SonicBoomOpts, 'dest'> & {
    file: string | (() => string);
    size?: number | string;
    frequency?: number | 'daily' | 'hourly';
    extension?: string;
    symlink?: boolean;
    dateFormat?: string;
    limit?: PinoRollLimitOptions;
  };

  /** 创建按频率/大小自动轮转的 SonicBoom 写入流，文件名为 `{file}.{date}.{n}{extension}` */
  export default function pinoRoll(options: PinoRollOptions): Promise<SonicBoom>;
}
