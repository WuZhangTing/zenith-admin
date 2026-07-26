ALTER TABLE "cms_ad_events" DROP CONSTRAINT "cms_ad_events_publish_channel_id_cms_publish_channels_id_fk";
--> statement-breakpoint
ALTER TABLE "cms_publish_artifacts" DROP CONSTRAINT "cms_publish_artifacts_publish_channel_id_cms_publish_channels_id_fk";
--> statement-breakpoint
DROP INDEX "cms_ad_events_channel_time_idx";--> statement-breakpoint
ALTER TABLE "cms_ad_events" DROP COLUMN "publish_channel_id";--> statement-breakpoint
ALTER TABLE "cms_publish_artifacts" DROP COLUMN "publish_channel_id";--> statement-breakpoint
ALTER TABLE "cms_visit_logs" DROP COLUMN "channel_code";