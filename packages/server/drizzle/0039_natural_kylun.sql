CREATE TYPE "public"."marketing_campaign_status" AS ENUM('draft', 'published', 'ended');--> statement-breakpoint
CREATE TYPE "public"."marketing_campaign_type" AS ENUM('lottery');--> statement-breakpoint
CREATE TYPE "public"."marketing_grant_status" AS ENUM('none', 'granted', 'failed');--> statement-breakpoint
CREATE TYPE "public"."marketing_prize_type" AS ENUM('points', 'coupon', 'physical', 'none');--> statement-breakpoint
CREATE TABLE "marketing_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"type" "marketing_campaign_type" DEFAULT 'lottery' NOT NULL,
	"status" "marketing_campaign_status" DEFAULT 'draft' NOT NULL,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp NOT NULL,
	"per_member_limit" integer DEFAULT 1 NOT NULL,
	"daily_per_member_limit" integer,
	"landing_url" varchar(2048),
	"description" text,
	"tenant_id" integer,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_participations" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"prize_id" integer,
	"prize_name" varchar(128),
	"grant_status" "marketing_grant_status" DEFAULT 'none' NOT NULL,
	"grant_note" varchar(256),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_prizes" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"name" varchar(128) NOT NULL,
	"prize_type" "marketing_prize_type" NOT NULL,
	"points" integer,
	"coupon_id" integer,
	"stock" integer DEFAULT 0 NOT NULL,
	"total_stock" integer DEFAULT 0 NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_participations" ADD CONSTRAINT "marketing_participations_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_participations" ADD CONSTRAINT "marketing_participations_prize_id_marketing_prizes_id_fk" FOREIGN KEY ("prize_id") REFERENCES "public"."marketing_prizes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_prizes" ADD CONSTRAINT "marketing_prizes_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_prizes" ADD CONSTRAINT "marketing_prizes_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_marketing_campaigns_status" ON "marketing_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_marketing_campaigns_tenant" ON "marketing_campaigns" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_marketing_participations_campaign_member" ON "marketing_participations" USING btree ("campaign_id","member_id");--> statement-breakpoint
CREATE INDEX "idx_marketing_participations_campaign_time" ON "marketing_participations" USING btree ("campaign_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_marketing_prizes_campaign" ON "marketing_prizes" USING btree ("campaign_id");