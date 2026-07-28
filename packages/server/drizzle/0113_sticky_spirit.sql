--> 移除碎片（cms_fragments）功能。
--> 碎片是「按 code 引用的 HTML 字符串袋」，在 in-repo TSX + SSR 架构下是错位抽象：
--> 模板编译期就知道自己有哪些插槽，主题的 settingsSchema 已经能声明式表达（带类型、
--> label、分组，后台自动生成表单），而碎片靠魔法字符串耦合、后台完全没有可发现性。
--> 三种类型里 text/image 与 settingsSchema 的 textarea/image 完全冗余，仅 html 独有。

--> 1. 先清引用数据，否则下面重建 owner_type 枚举时 'fragment'::cms_resource_owner_type 报错
DELETE FROM "cms_resource_refs" WHERE "owner_type" = 'fragment';--> statement-breakpoint

--> 2. 清理搭建页里的 fragment 区块及其区块级 ACL（区块类型已移除，留着也渲染不出东西）
DELETE FROM "cms_page_block_acls" acl
USING "cms_pages" p, jsonb_array_elements(p."blocks") b
WHERE acl."page_id" = p."id"
  AND b->>'type' = 'fragment'
  AND acl."block_id" = b->>'id';--> statement-breakpoint

UPDATE "cms_pages" SET "blocks" = COALESCE(
  (SELECT jsonb_agg(b) FROM jsonb_array_elements("blocks") b WHERE b->>'type' <> 'fragment'),
  '[]'::jsonb
)
WHERE "blocks" @> '[{"type":"fragment"}]'::jsonb;--> statement-breakpoint

--> 3. 删菜单与按钮权限（role_menus / tenant_package_menus 由外键 ON DELETE CASCADE 连带清理）
DELETE FROM "menus" WHERE "id" IN (14090, 14091, 14092, 14093, 14094);--> statement-breakpoint

--> 4. 删表与枚举
DROP TABLE "cms_fragments" CASCADE;--> statement-breakpoint
ALTER TABLE "cms_resource_refs" ALTER COLUMN "owner_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."cms_resource_owner_type";--> statement-breakpoint
CREATE TYPE "public"."cms_resource_owner_type" AS ENUM('site', 'content', 'contentVersion', 'channel', 'friendLink', 'ad', 'page', 'form');--> statement-breakpoint
ALTER TABLE "cms_resource_refs" ALTER COLUMN "owner_type" SET DATA TYPE "public"."cms_resource_owner_type" USING "owner_type"::"public"."cms_resource_owner_type";--> statement-breakpoint
DROP TYPE "public"."cms_fragment_type";