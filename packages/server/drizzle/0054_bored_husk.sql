CREATE TYPE "public"."rate_limit_algorithm" AS ENUM('fixed_window', 'sliding_window');--> statement-breakpoint
CREATE TYPE "public"."rate_limit_mode" AS ENUM('enforce', 'monitor');--> statement-breakpoint
ALTER TABLE "rate_limit_rules" ADD COLUMN "mode" "rate_limit_mode" DEFAULT 'enforce' NOT NULL;--> statement-breakpoint
ALTER TABLE "rate_limit_rules" ADD COLUMN "algorithm" "rate_limit_algorithm" DEFAULT 'fixed_window' NOT NULL;--> statement-breakpoint
ALTER TABLE "rate_limit_rules" ADD COLUMN "allowlist" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "rate_limit_rules" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "rate_limit_rules" ADD COLUMN "alert_threshold" integer;