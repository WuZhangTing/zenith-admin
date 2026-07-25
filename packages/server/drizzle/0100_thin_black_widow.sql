-- 栏目标识（站内唯一）：新增列 → 回填存量 → 加 NOT NULL 与唯一索引。
-- 直接 ADD COLUMN NOT NULL 会在存量库上失败，故在生成语句之间补三步回填。
ALTER TABLE "cms_channels" ADD COLUMN "code" varchar(50);--> statement-breakpoint

-- 1) 首选 slug（截断到 50）；同站点内首次出现者直接采用
UPDATE "cms_channels" AS c
SET "code" = r.base
FROM (
  SELECT id, base, ROW_NUMBER() OVER (PARTITION BY site_id, base ORDER BY id) AS rn
  FROM (SELECT id, site_id, LEFT(slug, 50) AS base FROM "cms_channels") s
) AS r
WHERE c.id = r.id AND r.rn = 1;--> statement-breakpoint

-- 2) 同站点 slug 重复的其余行用 id 兜底
UPDATE "cms_channels" SET "code" = 'channel-' || id WHERE "code" IS NULL;--> statement-breakpoint

-- 3) 安全网：兜底值仍与他行撞车时，保留最小 id、其余改用 ch<id>
UPDATE "cms_channels" AS c
SET "code" = 'ch' || c.id
WHERE EXISTS (
  SELECT 1 FROM "cms_channels" o
  WHERE o.site_id = c.site_id AND o.code = c.code AND o.id < c.id
);--> statement-breakpoint

ALTER TABLE "cms_channels" ALTER COLUMN "code" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "cms_channels_site_code_uq" ON "cms_channels" USING btree ("site_id","code");
