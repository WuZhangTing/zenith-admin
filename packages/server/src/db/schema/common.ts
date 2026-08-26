import { pgEnum } from 'drizzle-orm/pg-core';

export const statusEnum = pgEnum('status', ['enabled', 'disabled']);

/** App 推送聚合供应商（定义在 common 破除 messaging ↔ app-releases 模块环） */
export const pushProviderEnum = pgEnum('push_provider', ['jpush']);
