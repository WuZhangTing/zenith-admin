CREATE TYPE "public"."cms_field_option_source" AS ENUM('manual', 'dict');--> statement-breakpoint
CREATE TABLE "cms_friend_link_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(50) NOT NULL,
	"status" "status" DEFAULT 'enabled' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"remark" text,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cms_friend_links" ADD COLUMN "group_id" integer;--> statement-breakpoint
ALTER TABLE "cms_model_fields" ADD COLUMN "option_source" "cms_field_option_source" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "cms_model_fields" ADD COLUMN "dict_code" varchar(64);--> statement-breakpoint
ALTER TABLE "cms_sites" ADD COLUMN "model_id" integer;--> statement-breakpoint
ALTER TABLE "cms_sites" ADD COLUMN "extend" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "cms_friend_link_groups" ADD CONSTRAINT "cms_friend_link_groups_site_id_cms_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."cms_sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_friend_link_groups" ADD CONSTRAINT "cms_friend_link_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_friend_link_groups" ADD CONSTRAINT "cms_friend_link_groups_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cms_friend_link_groups_site_code_uq" ON "cms_friend_link_groups" USING btree ("site_id","code");--> statement-breakpoint
CREATE INDEX "cms_friend_link_groups_site_sort_idx" ON "cms_friend_link_groups" USING btree ("site_id","sort","id");--> statement-breakpoint
ALTER TABLE "cms_friend_links" ADD CONSTRAINT "cms_friend_links_group_id_cms_friend_link_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."cms_friend_link_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_sites" ADD CONSTRAINT "cms_sites_model_id_cms_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."cms_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cms_friend_links_site_group_idx" ON "cms_friend_links" USING btree ("site_id","group_id","sort","id");