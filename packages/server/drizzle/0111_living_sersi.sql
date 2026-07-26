CREATE TABLE "cms_content_tombstones" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"content_id" integer NOT NULL,
	"deleted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_open_app_grants" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" varchar(64) NOT NULL,
	"site_id" integer NOT NULL,
	"channel_ids" integer[] DEFAULT '{}' NOT NULL,
	"can_publish" boolean DEFAULT false NOT NULL,
	"status" "status" DEFAULT 'enabled' NOT NULL,
	"remark" varchar(200),
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_webhook_subscriptions" ADD COLUMN "cms_site_id" integer;--> statement-breakpoint
ALTER TABLE "app_webhook_subscriptions" ADD COLUMN "internal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cms_content_tombstones" ADD CONSTRAINT "cms_content_tombstones_site_id_cms_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."cms_sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_open_app_grants" ADD CONSTRAINT "cms_open_app_grants_site_id_cms_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."cms_sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_open_app_grants" ADD CONSTRAINT "cms_open_app_grants_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_open_app_grants" ADD CONSTRAINT "cms_open_app_grants_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cms_content_tombstones_content_uq" ON "cms_content_tombstones" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "cms_content_tombstones_sync_idx" ON "cms_content_tombstones" USING btree ("site_id","deleted_at","content_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_open_app_grants_client_site_uq" ON "cms_open_app_grants" USING btree ("client_id","site_id");--> statement-breakpoint
CREATE INDEX "cms_open_app_grants_client_idx" ON "cms_open_app_grants" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "cms_open_app_grants_site_idx" ON "cms_open_app_grants" USING btree ("site_id");--> statement-breakpoint
ALTER TABLE "app_webhook_subscriptions" ADD CONSTRAINT "app_webhook_subscriptions_cms_site_id_cms_sites_id_fk" FOREIGN KEY ("cms_site_id") REFERENCES "public"."cms_sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_webhook_subscriptions_cms_site_idx" ON "app_webhook_subscriptions" USING btree ("cms_site_id");--> statement-breakpoint
CREATE INDEX "cms_contents_sync_idx" ON "cms_contents" USING btree ("site_id","updated_at","id");