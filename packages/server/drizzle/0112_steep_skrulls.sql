ALTER TABLE "cms_fragments" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "cms_fragments" ALTER COLUMN "type" SET DEFAULT 'html'::text;--> statement-breakpoint
--> 移除 json 碎片类型：该类型没有真正的消费方（主题只做 <pre> 原样展示），
--> 结构化配置已由站点扩展模型（cms_sites.model_id + extend）承担。
--> 存量 json 行必须先降级为 text，否则下面回写枚举时 'json'::cms_fragment_type 直接报错。
UPDATE "cms_fragments" SET "type" = 'text' WHERE "type" = 'json';--> statement-breakpoint
DROP TYPE "public"."cms_fragment_type";--> statement-breakpoint
CREATE TYPE "public"."cms_fragment_type" AS ENUM('html', 'text', 'image');--> statement-breakpoint
ALTER TABLE "cms_fragments" ALTER COLUMN "type" SET DEFAULT 'html'::"public"."cms_fragment_type";--> statement-breakpoint
ALTER TABLE "cms_fragments" ALTER COLUMN "type" SET DATA TYPE "public"."cms_fragment_type" USING "type"::"public"."cms_fragment_type";