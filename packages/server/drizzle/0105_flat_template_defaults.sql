-- 模板配置降维：从「按发布通道分组」拍平为单份配置。
-- 站点：settings.defaultTemplates = {"pc":{...},"h5":{...}} -> {...}（取默认通道那份，无默认通道则取第一份）
UPDATE cms_sites s
SET settings = jsonb_set(
  s.settings,
  '{defaultTemplates}',
  COALESCE(
    s.settings -> 'defaultTemplates' -> (
      SELECT pc.code FROM cms_publish_channels pc
      WHERE pc.site_id = s.id AND pc.is_default = true
      LIMIT 1
    ),
    (SELECT value FROM jsonb_each(s.settings -> 'defaultTemplates') LIMIT 1),
    '{}'::jsonb
  )
)
WHERE jsonb_typeof(s.settings -> 'defaultTemplates') = 'object'
  AND s.settings -> 'defaultTemplates' <> '{}'::jsonb;
--> statement-breakpoint
-- 栏目：settings.templates 只保留 detailByModel（通用 list/detail 由栏目自身列承载，避免同一语义两处存）
UPDATE cms_channels c
SET settings = jsonb_set(
  c.settings,
  '{templates}',
  COALESCE(
    (
      SELECT jsonb_build_object('detailByModel', v -> 'detailByModel')
      FROM jsonb_each(c.settings -> 'templates') AS t(k, v)
      WHERE jsonb_typeof(v -> 'detailByModel') = 'object'
      LIMIT 1
    ),
    '{}'::jsonb
  )
)
WHERE jsonb_typeof(c.settings -> 'templates') = 'object'
  AND c.settings -> 'templates' <> '{}'::jsonb;
