ALTER TABLE "cms_model_fields" ADD COLUMN "show_in_detail" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cms_model_fields" ADD COLUMN "detail_group" varchar(50);--> statement-breakpoint
ALTER TABLE "cms_model_fields" ADD COLUMN "detail_sort" integer DEFAULT 0 NOT NULL;