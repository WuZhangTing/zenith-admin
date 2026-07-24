DROP TABLE IF EXISTS "cms_template_versions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "cms_theme_deployments" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "cms_templates" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "cms_theme_packages" CASCADE;--> statement-breakpoint
ALTER TABLE "cms_publish_artifacts" DROP CONSTRAINT IF EXISTS "cms_publish_artifacts_theme_package_id_cms_theme_packages_id_fk";--> statement-breakpoint
ALTER TABLE "cms_publish_artifacts" DROP CONSTRAINT IF EXISTS "cms_publish_artifacts_template_id_cms_templates_id_fk";--> statement-breakpoint
ALTER TABLE "cms_publish_artifacts" DROP COLUMN IF EXISTS "theme_package_id";--> statement-breakpoint
ALTER TABLE "cms_publish_artifacts" DROP COLUMN IF EXISTS "template_id";--> statement-breakpoint
ALTER TABLE "cms_publish_artifacts" DROP COLUMN IF EXISTS "template_version";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."cms_template_source";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."cms_template_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."cms_theme_deployment_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."cms_theme_package_status";