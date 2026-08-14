CREATE TYPE "public"."wiki_comment_status" AS ENUM('visible', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."wiki_doc_status" AS ENUM('draft', 'pending', 'published', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."wiki_space_member_role" AS ENUM('owner', 'admin', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."wiki_space_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TABLE "wiki_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"doc_id" integer NOT NULL,
	"parent_id" integer,
	"content" varchar(1000) NOT NULL,
	"status" "wiki_comment_status" DEFAULT 'visible' NOT NULL,
	"author_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_doc_favorites" (
	"doc_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wiki_doc_favorites_doc_id_user_id_pk" PRIMARY KEY("doc_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "wiki_doc_tags" (
	"doc_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "wiki_doc_tags_doc_id_tag_id_pk" PRIMARY KEY("doc_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "wiki_doc_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"doc_id" integer NOT NULL,
	"version" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"change_note" varchar(300),
	"author_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wiki_doc_versions_doc_version_uk" UNIQUE("doc_id","version")
);
--> statement-breakpoint
CREATE TABLE "wiki_doc_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"doc_id" integer NOT NULL,
	"user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_docs" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"parent_id" integer,
	"title" varchar(200) NOT NULL,
	"summary" varchar(500),
	"content" text DEFAULT '' NOT NULL,
	"status" "wiki_doc_status" DEFAULT 'draft' NOT NULL,
	"reject_reason" varchar(500),
	"sort" integer DEFAULT 0 NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp,
	"deleted_at" timestamp,
	"tenant_id" integer,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_space_members" (
	"space_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" "wiki_space_member_role" DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wiki_space_members_space_id_user_id_pk" PRIMARY KEY("space_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "wiki_spaces" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(300),
	"icon" varchar(50),
	"visibility" "wiki_space_visibility" DEFAULT 'public' NOT NULL,
	"status" "status" DEFAULT 'enabled' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"ai_sync_enabled" boolean DEFAULT false NOT NULL,
	"tenant_id" integer,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"color" varchar(20),
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wiki_tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "wiki_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(300),
	"content" text DEFAULT '' NOT NULL,
	"status" "status" DEFAULT 'enabled' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wiki_comments" ADD CONSTRAINT "wiki_comments_doc_id_wiki_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."wiki_docs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_comments" ADD CONSTRAINT "wiki_comments_parent_id_wiki_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."wiki_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_comments" ADD CONSTRAINT "wiki_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_doc_favorites" ADD CONSTRAINT "wiki_doc_favorites_doc_id_wiki_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."wiki_docs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_doc_favorites" ADD CONSTRAINT "wiki_doc_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_doc_tags" ADD CONSTRAINT "wiki_doc_tags_doc_id_wiki_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."wiki_docs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_doc_tags" ADD CONSTRAINT "wiki_doc_tags_tag_id_wiki_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."wiki_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_doc_versions" ADD CONSTRAINT "wiki_doc_versions_doc_id_wiki_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."wiki_docs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_doc_versions" ADD CONSTRAINT "wiki_doc_versions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_doc_views" ADD CONSTRAINT "wiki_doc_views_doc_id_wiki_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."wiki_docs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_doc_views" ADD CONSTRAINT "wiki_doc_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_docs" ADD CONSTRAINT "wiki_docs_space_id_wiki_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."wiki_spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_docs" ADD CONSTRAINT "wiki_docs_parent_id_wiki_docs_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."wiki_docs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_docs" ADD CONSTRAINT "wiki_docs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_docs" ADD CONSTRAINT "wiki_docs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_docs" ADD CONSTRAINT "wiki_docs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_space_members" ADD CONSTRAINT "wiki_space_members_space_id_wiki_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."wiki_spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_space_members" ADD CONSTRAINT "wiki_space_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_spaces" ADD CONSTRAINT "wiki_spaces_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_spaces" ADD CONSTRAINT "wiki_spaces_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_spaces" ADD CONSTRAINT "wiki_spaces_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_tags" ADD CONSTRAINT "wiki_tags_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_tags" ADD CONSTRAINT "wiki_tags_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_templates" ADD CONSTRAINT "wiki_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_templates" ADD CONSTRAINT "wiki_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wiki_comments_doc_idx" ON "wiki_comments" USING btree ("doc_id");--> statement-breakpoint
CREATE INDEX "wiki_doc_views_doc_idx" ON "wiki_doc_views" USING btree ("doc_id");--> statement-breakpoint
CREATE INDEX "wiki_doc_views_created_idx" ON "wiki_doc_views" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "wiki_docs_space_idx" ON "wiki_docs" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "wiki_docs_parent_idx" ON "wiki_docs" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "wiki_docs_status_idx" ON "wiki_docs" USING btree ("status");