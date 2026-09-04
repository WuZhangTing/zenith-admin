CREATE TYPE "public"."file_visibility" AS ENUM('public', 'restricted');--> statement-breakpoint
CREATE TYPE "public"."drive_activity_action" AS ENUM('upload', 'new_version', 'create_folder', 'rename', 'move', 'copy', 'delete', 'restore', 'purge', 'download', 'preview', 'share_create', 'share_update', 'share_revoke', 'share_access', 'save_from_share', 'permission_change', 'inherit_change', 'version_restore', 'version_delete', 'lock', 'unlock', 'comment', 'tag');--> statement-breakpoint
CREATE TYPE "public"."drive_node_type" AS ENUM('folder', 'file');--> statement-breakpoint
CREATE TYPE "public"."drive_role" AS ENUM('viewer', 'downloader', 'editor', 'manager');--> statement-breakpoint
CREATE TYPE "public"."drive_share_permission" AS ENUM('preview', 'download');--> statement-breakpoint
CREATE TYPE "public"."drive_space_type" AS ENUM('personal', 'department', 'team');--> statement-breakpoint
CREATE TYPE "public"."drive_subject_type" AS ENUM('user', 'department', 'role', 'user_group');--> statement-breakpoint
CREATE TYPE "public"."drive_upload_conflict_policy" AS ENUM('rename', 'version', 'fail');--> statement-breakpoint
CREATE TABLE "drive_activities" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "drive_activities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"space_id" integer NOT NULL,
	"node_id" integer,
	"node_name" varchar(255) NOT NULL,
	"node_type" "drive_node_type" NOT NULL,
	"action" "drive_activity_action" NOT NULL,
	"actor_id" integer,
	"share_id" integer,
	"detail" jsonb,
	"client_ip" varchar(64),
	"tenant_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drive_file_versions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "drive_file_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"node_id" integer NOT NULL,
	"version" integer NOT NULL,
	"file_id" uuid NOT NULL,
	"size" bigint DEFAULT 0 NOT NULL,
	"content_hash" varchar(64),
	"comment" varchar(500),
	"author_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "drive_file_versions_node_version_unique" UNIQUE("node_id","version")
);
--> statement-breakpoint
CREATE TABLE "drive_node_comments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "drive_node_comments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"node_id" integer NOT NULL,
	"parent_id" integer,
	"content" varchar(2000) NOT NULL,
	"author_id" integer,
	"tenant_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drive_node_permissions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "drive_node_permissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"node_id" integer NOT NULL,
	"subject_type" "drive_subject_type" NOT NULL,
	"subject_id" integer NOT NULL,
	"role" "drive_role" NOT NULL,
	"expire_at" timestamp,
	"tenant_id" integer,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "drive_node_permissions_node_subject_unique" UNIQUE("node_id","subject_type","subject_id")
);
--> statement-breakpoint
CREATE TABLE "drive_node_stars" (
	"user_id" integer NOT NULL,
	"node_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "drive_node_stars_user_id_node_id_pk" PRIMARY KEY("user_id","node_id")
);
--> statement-breakpoint
CREATE TABLE "drive_node_tags" (
	"node_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "drive_node_tags_node_id_tag_id_pk" PRIMARY KEY("node_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "drive_node_texts" (
	"node_id" integer PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"search_vector" "tsvector",
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drive_nodes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "drive_nodes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"space_id" integer NOT NULL,
	"parent_id" integer,
	"ancestor_ids" integer[] DEFAULT '{}' NOT NULL,
	"depth" smallint DEFAULT 0 NOT NULL,
	"type" "drive_node_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"extension" varchar(32),
	"mime_type" varchar(128),
	"file_id" uuid,
	"size" bigint DEFAULT 0 NOT NULL,
	"content_hash" varchar(64),
	"current_version" integer DEFAULT 1 NOT NULL,
	"inherit_permissions" boolean DEFAULT true NOT NULL,
	"locked_by" integer,
	"locked_at" timestamp,
	"lock_expires_at" timestamp,
	"thumbnail_file_id" uuid,
	"deleted_at" timestamp,
	"deleted_by" integer,
	"deleted_root_id" integer,
	"tenant_id" integer,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drive_recent_access" (
	"user_id" integer NOT NULL,
	"node_id" integer NOT NULL,
	"action" "drive_activity_action" NOT NULL,
	"last_access_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "drive_recent_access_user_id_node_id_pk" PRIMARY KEY("user_id","node_id")
);
--> statement-breakpoint
CREATE TABLE "drive_share_access_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "drive_share_access_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"share_id" integer NOT NULL,
	"node_id" integer NOT NULL,
	"action" varchar(16) NOT NULL,
	"client_ip" varchar(64),
	"ok" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drive_share_links" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "drive_share_links_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"node_id" integer NOT NULL,
	"token" varchar(64) NOT NULL,
	"token_encrypted" varchar(256),
	"password_hash" varchar(100),
	"permission" "drive_share_permission" DEFAULT 'preview' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"expire_at" timestamp,
	"max_access_count" integer,
	"access_count" integer DEFAULT 0 NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"session_version" integer DEFAULT 1 NOT NULL,
	"revoked_at" timestamp,
	"remark" varchar(256),
	"tenant_id" integer,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "drive_share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "drive_space_members" (
	"space_id" integer NOT NULL,
	"subject_type" "drive_subject_type" NOT NULL,
	"subject_id" integer NOT NULL,
	"role" "drive_role" DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "drive_space_members_space_id_subject_type_subject_id_pk" PRIMARY KEY("space_id","subject_type","subject_id")
);
--> statement-breakpoint
CREATE TABLE "drive_spaces" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "drive_spaces_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"type" "drive_space_type" NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(300),
	"icon" varchar(50),
	"owner_id" integer,
	"department_id" integer,
	"default_member_role" "drive_role",
	"quota_bytes" bigint,
	"used_bytes" bigint DEFAULT 0 NOT NULL,
	"max_versions" integer,
	"allow_external_share" boolean DEFAULT true NOT NULL,
	"status" "status" DEFAULT 'enabled' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"tenant_id" integer,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drive_tags" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "drive_tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"space_id" integer NOT NULL,
	"name" varchar(50) NOT NULL,
	"color" varchar(20),
	"tenant_id" integer,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "drive_tags_space_name_unique" UNIQUE("space_id","name")
);
--> statement-breakpoint
CREATE TABLE "drive_upload_bindings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "drive_upload_bindings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"upload_id" varchar(64) NOT NULL,
	"space_id" integer NOT NULL,
	"parent_id" integer,
	"node_id" integer,
	"file_name" varchar(255) NOT NULL,
	"file_size" bigint NOT NULL,
	"conflict_policy" "drive_upload_conflict_policy" DEFAULT 'rename' NOT NULL,
	"expected_hash" varchar(64),
	"tenant_id" integer,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "drive_upload_bindings_upload_id_unique" UNIQUE("upload_id")
);
--> statement-breakpoint
ALTER TABLE "managed_files" ALTER COLUMN "size" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "managed_files" ADD COLUMN "visibility" "file_visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "managed_files" ADD COLUMN "content_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "drive_activities" ADD CONSTRAINT "drive_activities_node_id_drive_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."drive_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_activities" ADD CONSTRAINT "drive_activities_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_activities" ADD CONSTRAINT "drive_activities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_file_versions" ADD CONSTRAINT "drive_file_versions_node_id_drive_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."drive_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_file_versions" ADD CONSTRAINT "drive_file_versions_file_id_managed_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."managed_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_file_versions" ADD CONSTRAINT "drive_file_versions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_node_comments" ADD CONSTRAINT "drive_node_comments_node_id_drive_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."drive_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_node_comments" ADD CONSTRAINT "drive_node_comments_parent_id_drive_node_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."drive_node_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_node_comments" ADD CONSTRAINT "drive_node_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_node_comments" ADD CONSTRAINT "drive_node_comments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_node_permissions" ADD CONSTRAINT "drive_node_permissions_node_id_drive_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."drive_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_node_permissions" ADD CONSTRAINT "drive_node_permissions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_node_permissions" ADD CONSTRAINT "drive_node_permissions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_node_permissions" ADD CONSTRAINT "drive_node_permissions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_node_stars" ADD CONSTRAINT "drive_node_stars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_node_stars" ADD CONSTRAINT "drive_node_stars_node_id_drive_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."drive_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_node_tags" ADD CONSTRAINT "drive_node_tags_node_id_drive_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."drive_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_node_tags" ADD CONSTRAINT "drive_node_tags_tag_id_drive_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."drive_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_node_texts" ADD CONSTRAINT "drive_node_texts_node_id_drive_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."drive_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_nodes" ADD CONSTRAINT "drive_nodes_space_id_drive_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."drive_spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_nodes" ADD CONSTRAINT "drive_nodes_parent_id_drive_nodes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."drive_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_nodes" ADD CONSTRAINT "drive_nodes_file_id_managed_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."managed_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_nodes" ADD CONSTRAINT "drive_nodes_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_nodes" ADD CONSTRAINT "drive_nodes_thumbnail_file_id_managed_files_id_fk" FOREIGN KEY ("thumbnail_file_id") REFERENCES "public"."managed_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_nodes" ADD CONSTRAINT "drive_nodes_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_nodes" ADD CONSTRAINT "drive_nodes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_nodes" ADD CONSTRAINT "drive_nodes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_nodes" ADD CONSTRAINT "drive_nodes_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_recent_access" ADD CONSTRAINT "drive_recent_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_recent_access" ADD CONSTRAINT "drive_recent_access_node_id_drive_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."drive_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_share_access_logs" ADD CONSTRAINT "drive_share_access_logs_share_id_drive_share_links_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."drive_share_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_share_links" ADD CONSTRAINT "drive_share_links_node_id_drive_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."drive_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_share_links" ADD CONSTRAINT "drive_share_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_share_links" ADD CONSTRAINT "drive_share_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_share_links" ADD CONSTRAINT "drive_share_links_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_space_members" ADD CONSTRAINT "drive_space_members_space_id_drive_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."drive_spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_spaces" ADD CONSTRAINT "drive_spaces_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_spaces" ADD CONSTRAINT "drive_spaces_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_spaces" ADD CONSTRAINT "drive_spaces_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_spaces" ADD CONSTRAINT "drive_spaces_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_spaces" ADD CONSTRAINT "drive_spaces_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_tags" ADD CONSTRAINT "drive_tags_space_id_drive_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."drive_spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_tags" ADD CONSTRAINT "drive_tags_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_tags" ADD CONSTRAINT "drive_tags_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_tags" ADD CONSTRAINT "drive_tags_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_upload_bindings" ADD CONSTRAINT "drive_upload_bindings_space_id_drive_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."drive_spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_upload_bindings" ADD CONSTRAINT "drive_upload_bindings_parent_id_drive_nodes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."drive_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_upload_bindings" ADD CONSTRAINT "drive_upload_bindings_node_id_drive_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."drive_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_upload_bindings" ADD CONSTRAINT "drive_upload_bindings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_upload_bindings" ADD CONSTRAINT "drive_upload_bindings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drive_activities_node_idx" ON "drive_activities" USING btree ("node_id","created_at");--> statement-breakpoint
CREATE INDEX "drive_activities_space_idx" ON "drive_activities" USING btree ("space_id","created_at");--> statement-breakpoint
CREATE INDEX "drive_activities_actor_idx" ON "drive_activities" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "drive_activities_created_idx" ON "drive_activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "drive_file_versions_file_idx" ON "drive_file_versions" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "drive_node_comments_node_idx" ON "drive_node_comments" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "drive_node_permissions_subject_idx" ON "drive_node_permissions" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "drive_node_stars_node_idx" ON "drive_node_stars" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "drive_node_tags_tag_idx" ON "drive_node_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "drive_node_texts_search_idx" ON "drive_node_texts" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "drive_nodes_space_parent_idx" ON "drive_nodes" USING btree ("space_id","parent_id","deleted_at");--> statement-breakpoint
CREATE INDEX "drive_nodes_ancestors_gin_idx" ON "drive_nodes" USING gin ("ancestor_ids");--> statement-breakpoint
CREATE INDEX "drive_nodes_file_idx" ON "drive_nodes" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "drive_nodes_deleted_root_idx" ON "drive_nodes" USING btree ("deleted_root_id");--> statement-breakpoint
CREATE INDEX "drive_nodes_content_hash_idx" ON "drive_nodes" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "drive_nodes_name_trgm_idx" ON "drive_nodes" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "drive_nodes_sibling_name_uq" ON "drive_nodes" USING btree ("space_id",coalesce("parent_id", 0),lower("name")) WHERE "drive_nodes"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "drive_recent_access_user_time_idx" ON "drive_recent_access" USING btree ("user_id","last_access_at");--> statement-breakpoint
CREATE INDEX "drive_share_access_logs_share_idx" ON "drive_share_access_logs" USING btree ("share_id");--> statement-breakpoint
CREATE INDEX "drive_share_access_logs_created_idx" ON "drive_share_access_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "drive_share_links_node_idx" ON "drive_share_links" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "drive_share_links_tenant_idx" ON "drive_share_links" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "drive_space_members_subject_idx" ON "drive_space_members" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "drive_spaces_personal_owner_uq" ON "drive_spaces" USING btree ("owner_id") WHERE "drive_spaces"."type" = 'personal';--> statement-breakpoint
CREATE UNIQUE INDEX "drive_spaces_department_uq" ON "drive_spaces" USING btree ("department_id") WHERE "drive_spaces"."type" = 'department';--> statement-breakpoint
CREATE INDEX "drive_spaces_tenant_idx" ON "drive_spaces" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "managed_files_content_hash_idx" ON "managed_files" USING btree ("tenant_id","content_hash");