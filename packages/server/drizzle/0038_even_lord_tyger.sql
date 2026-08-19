CREATE TABLE "tenant_package_features" (
	"package_id" integer NOT NULL,
	"feature_key" varchar(50) NOT NULL,
	CONSTRAINT "tenant_package_features_package_id_feature_key_pk" PRIMARY KEY("package_id","feature_key")
);
--> statement-breakpoint
DROP TABLE "tenant_package_menus" CASCADE;--> statement-breakpoint
ALTER TABLE "menus" ADD COLUMN "feature_key" varchar(50);--> statement-breakpoint
ALTER TABLE "tenant_packages" ADD COLUMN "quotas" jsonb;--> statement-breakpoint
ALTER TABLE "tenant_package_features" ADD CONSTRAINT "tenant_package_features_package_id_tenant_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."tenant_packages"("id") ON DELETE cascade ON UPDATE no action;