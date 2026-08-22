-- Mastra 模型层改造:字段形状不向后兼容,清空存量配置后重建
TRUNCATE TABLE "ai_provider_configs";--> statement-breakpoint
TRUNCATE TABLE "user_ai_configs";--> statement-breakpoint
ALTER TABLE "ai_provider_configs" DROP COLUMN "provider";--> statement-breakpoint
ALTER TABLE "ai_provider_configs" DROP COLUMN "model";--> statement-breakpoint
ALTER TABLE "ai_provider_configs" DROP COLUMN "system_prompt";--> statement-breakpoint
ALTER TABLE "ai_provider_configs" DROP COLUMN "max_tokens";--> statement-breakpoint
ALTER TABLE "ai_provider_configs" DROP COLUMN "temperature";--> statement-breakpoint
ALTER TABLE "ai_provider_configs" DROP COLUMN "fallback_config_id";--> statement-breakpoint
ALTER TABLE "user_ai_configs" DROP COLUMN "provider";--> statement-breakpoint
ALTER TABLE "user_ai_configs" DROP COLUMN "temperature";--> statement-breakpoint
ALTER TABLE "user_ai_configs" DROP COLUMN "max_tokens";--> statement-breakpoint
DROP TYPE "public"."ai_provider";