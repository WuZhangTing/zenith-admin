ALTER TYPE "public"."payment_risk_dimension" ADD VALUE 'decision';--> statement-breakpoint
ALTER TABLE "payment_risk_rules" DROP COLUMN "blocklist";--> statement-breakpoint
ALTER TABLE "payment_risk_rules" DROP COLUMN "allowlist";