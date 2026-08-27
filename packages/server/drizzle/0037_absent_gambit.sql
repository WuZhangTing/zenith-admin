CREATE TYPE "public"."short_link_redirect_type" AS ENUM('302', '301');--> statement-breakpoint
CREATE TABLE "short_link_clicks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"link_id" integer NOT NULL,
	"visitor_id" varchar(40),
	"ip" varchar(64),
	"country" varchar(64),
	"province" varchar(64),
	"city" varchar(64),
	"device_type" varchar(16),
	"os" varchar(64),
	"browser" varchar(64),
	"referer" varchar(512),
	"is_bot" boolean DEFAULT false NOT NULL,
	"clicked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "short_link_daily_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"link_id" integer NOT NULL,
	"stat_date" date NOT NULL,
	"pv" integer DEFAULT 0 NOT NULL,
	"uv" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "short_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"target_url" text NOT NULL,
	"title" varchar(128),
	"redirect_type" "short_link_redirect_type" DEFAULT '302' NOT NULL,
	"status" "status" DEFAULT 'enabled' NOT NULL,
	"expires_at" timestamp,
	"max_visits" integer,
	"password" varchar(32),
	"utm_source" varchar(128),
	"utm_medium" varchar(128),
	"utm_campaign" varchar(128),
	"utm_term" varchar(128),
	"utm_content" varchar(128),
	"biz_type" varchar(32) DEFAULT 'custom' NOT NULL,
	"biz_ref" varchar(64),
	"remark" varchar(256),
	"total_pv" integer DEFAULT 0 NOT NULL,
	"last_visit_at" timestamp,
	"tenant_id" integer,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "short_links_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "short_link_clicks" ADD CONSTRAINT "short_link_clicks_link_id_short_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."short_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_link_daily_stats" ADD CONSTRAINT "short_link_daily_stats_link_id_short_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."short_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_short_link_clicks_link_time" ON "short_link_clicks" USING btree ("link_id","clicked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_short_link_daily_stats_link_date" ON "short_link_daily_stats" USING btree ("link_id","stat_date");--> statement-breakpoint
CREATE INDEX "idx_short_links_biz" ON "short_links" USING btree ("biz_type","biz_ref");--> statement-breakpoint
CREATE INDEX "idx_short_links_tenant" ON "short_links" USING btree ("tenant_id");