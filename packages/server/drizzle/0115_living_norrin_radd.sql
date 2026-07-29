CREATE TYPE "public"."cms_widget_ref_owner_type" AS ENUM('page', 'theme_slot');--> statement-breakpoint
CREATE TYPE "public"."cms_widget_source_type" AS ENUM('content', 'channel');--> statement-breakpoint
CREATE TYPE "public"."cms_widget_status" AS ENUM('draft', 'published', 'offline');--> statement-breakpoint
CREATE TYPE "public"."cms_widget_type" AS ENUM('manual-list');--> statement-breakpoint
ALTER TYPE "public"."cms_resource_owner_type" ADD VALUE 'widget' BEFORE 'form';--> statement-breakpoint
CREATE TABLE "cms_widget_refs" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"widget_id" integer NOT NULL,
	"owner_type" "cms_widget_ref_owner_type" NOT NULL,
	"owner_id" integer NOT NULL,
	"field" varchar(100) NOT NULL,
	"renderer_key" varchar(50) NOT NULL,
	"style_props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_widget_source_refs" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"widget_id" integer NOT NULL,
	"item_id" varchar(100) NOT NULL,
	"source_type" "cms_widget_source_type" NOT NULL,
	"source_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_widgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(100) NOT NULL,
	"type" "cms_widget_type" DEFAULT 'manual-list' NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"draft_data" jsonb DEFAULT '{"items":[]}'::jsonb NOT NULL,
	"published_data" jsonb,
	"published_name" varchar(100),
	"draft_revision" integer DEFAULT 1 NOT NULL,
	"published_revision" integer DEFAULT 0 NOT NULL,
	"status" "cms_widget_status" DEFAULT 'draft' NOT NULL,
	"default_renderer_key" varchar(50) DEFAULT 'list-sidebar' NOT NULL,
	"remark" varchar(200),
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cms_widget_refs" ADD CONSTRAINT "cms_widget_refs_site_id_cms_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."cms_sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_widget_refs" ADD CONSTRAINT "cms_widget_refs_widget_id_cms_widgets_id_fk" FOREIGN KEY ("widget_id") REFERENCES "public"."cms_widgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_widget_source_refs" ADD CONSTRAINT "cms_widget_source_refs_site_id_cms_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."cms_sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_widget_source_refs" ADD CONSTRAINT "cms_widget_source_refs_widget_id_cms_widgets_id_fk" FOREIGN KEY ("widget_id") REFERENCES "public"."cms_widgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_widgets" ADD CONSTRAINT "cms_widgets_site_id_cms_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."cms_sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_widgets" ADD CONSTRAINT "cms_widgets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_widgets" ADD CONSTRAINT "cms_widgets_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cms_widget_refs_owner_field_uq" ON "cms_widget_refs" USING btree ("owner_type","owner_id","field");--> statement-breakpoint
CREATE INDEX "cms_widget_refs_widget_idx" ON "cms_widget_refs" USING btree ("widget_id");--> statement-breakpoint
CREATE INDEX "cms_widget_refs_site_owner_idx" ON "cms_widget_refs" USING btree ("site_id","owner_type","owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_widget_source_refs_widget_item_uq" ON "cms_widget_source_refs" USING btree ("widget_id","item_id");--> statement-breakpoint
CREATE INDEX "cms_widget_source_refs_source_idx" ON "cms_widget_source_refs" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "cms_widget_source_refs_site_idx" ON "cms_widget_source_refs" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_widgets_site_code_uq" ON "cms_widgets" USING btree ("site_id","code");--> statement-breakpoint
CREATE INDEX "cms_widgets_site_status_idx" ON "cms_widgets" USING btree ("site_id","status");