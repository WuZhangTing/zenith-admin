ALTER TABLE "ai_provider_configs" ALTER COLUMN "base_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_provider_configs" ALTER COLUMN "models" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_provider_configs" ADD COLUMN "provider_id" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_provider_configs" ADD COLUMN "headers" jsonb;--> statement-breakpoint
ALTER TABLE "ai_provider_configs" ADD COLUMN "default_model" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_provider_configs" ADD COLUMN "model_settings" jsonb;--> statement-breakpoint
ALTER TABLE "ai_provider_configs" ADD COLUMN "provider_options" jsonb;--> statement-breakpoint
ALTER TABLE "ai_provider_configs" ADD COLUMN "fallbacks" jsonb;--> statement-breakpoint
ALTER TABLE "user_ai_configs" ADD COLUMN "provider_id" varchar(50) DEFAULT 'custom' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_ai_configs" ADD COLUMN "model_settings" jsonb;