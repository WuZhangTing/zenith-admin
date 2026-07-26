DROP TABLE "cms_publish_channels" CASCADE;--> statement-breakpoint
-- 发布通道菜单与权限一并回收（角色绑定经 role_menus 外键级联删除）
DELETE FROM "menus" WHERE "id" IN (14190, 14191, 14192, 14193, 14194);
