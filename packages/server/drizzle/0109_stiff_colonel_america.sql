CREATE TYPE "public"."cms_resource_owner_type" AS ENUM('site', 'content', 'contentVersion', 'channel', 'fragment', 'friendLink', 'ad', 'page', 'form');--> statement-breakpoint
CREATE TABLE "cms_resource_refs" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"resource_id" integer NOT NULL,
	"owner_type" "cms_resource_owner_type" NOT NULL,
	"owner_id" integer NOT NULL,
	"field" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cms_resource_refs" ADD CONSTRAINT "cms_resource_refs_site_id_cms_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."cms_sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_resource_refs" ADD CONSTRAINT "cms_resource_refs_resource_id_cms_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."cms_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cms_resource_refs_uq" ON "cms_resource_refs" USING btree ("resource_id","owner_type","owner_id","field");--> statement-breakpoint
CREATE INDEX "cms_resource_refs_resource_idx" ON "cms_resource_refs" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "cms_resource_refs_site_idx" ON "cms_resource_refs" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "cms_resource_refs_owner_idx" ON "cms_resource_refs" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "cms_resources_file_idx" ON "cms_resources" USING btree ("file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_resources_site_url_uq" ON "cms_resources" USING btree ("site_id","url");--> statement-breakpoint
ALTER TABLE "cms_contents" DROP COLUMN "cover_thumb";