declare module '@baiducloud/sdk' {
  interface BosClientOptions {
    endpoint: string;
    credentials: { ak: string; sk: string };
  }
  // 运行时为 CJS 命名导出（module.exports.BosClient），无 default 导出
  export class BosClient {
    constructor(options: BosClientOptions);
    putObjectFromString(bucket: string, key: string, data: string, options?: Record<string, unknown>): Promise<unknown>;
    getObject(bucket: string, key: string): Promise<{ body: string }>;
    deleteObject(bucket: string, key: string): Promise<unknown>;
  }
}
