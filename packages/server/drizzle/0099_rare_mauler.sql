DELETE FROM "cms_publish_artifacts" WHERE "target_type" = 'template';--> statement-breakpoint
ALTER TABLE "cms_publish_artifacts" ALTER COLUMN "target_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."cms_publish_target_type";--> statement-breakpoint
CREATE TYPE "public"."cms_publish_target_type" AS ENUM('content', 'contents', 'channel', 'site', 'theme', 'page');--> statement-breakpoint
ALTER TABLE "cms_publish_artifacts" ALTER COLUMN "target_type" SET DATA TYPE "public"."cms_publish_target_type" USING "target_type"::"public"."cms_publish_target_type";