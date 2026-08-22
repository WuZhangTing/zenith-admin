ALTER TABLE "ai_agents" ADD COLUMN "instructions" text NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_agents" ADD COLUMN "model_settings" jsonb;--> statement-breakpoint
ALTER TABLE "ai_agents" ADD COLUMN "max_steps" integer;