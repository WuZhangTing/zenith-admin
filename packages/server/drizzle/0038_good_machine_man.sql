ALTER TYPE "public"."analytics_campaign_channel" ADD VALUE 'sms';--> statement-breakpoint
ALTER TABLE "analytics_segment_campaigns" ADD COLUMN "landing_url" varchar(2048);