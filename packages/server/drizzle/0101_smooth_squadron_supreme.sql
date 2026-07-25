CREATE TYPE "public"."cms_channel_static_mode" AS ENUM('inherit', 'dynamic', 'hybrid', 'static');--> statement-breakpoint
ALTER TABLE "cms_channels" ADD COLUMN "static_mode" "cms_channel_static_mode" DEFAULT 'inherit' NOT NULL;--> statement-breakpoint
ALTER TABLE "cms_contents" ADD COLUMN "title_style" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "cms_contents" ADD COLUMN "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "cms_contents" ADD COLUMN "static_path" varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX "cms_contents_site_static_path_uq" ON "cms_contents" USING btree ("site_id","static_path") WHERE "cms_contents"."static_path" is not null and "cms_contents"."deleted_at" is null;