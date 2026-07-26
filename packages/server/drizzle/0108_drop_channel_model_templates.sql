-- 移除栏目级「按内容模型细分的详情模板」（cms_channels.settings.templates）。
--
-- 详情页只在内容主栏目路径下可达（getPublishedContent 锁 channel_id），而内容 model_id
-- 恒等于其主栏目的 model_id —— 栏目内模型唯一，按模型细分退化为 detail_template 的重复槽位，
-- 且在栏目编辑页上会列出本栏目永远命中不了的其他模型，属误导性死配置。
-- 站点级 settings.defaultTemplates.detailByModel 跨栏目生效、模型有区分度，保持不变。
UPDATE cms_channels
SET settings = settings - 'templates'
WHERE settings ? 'templates';
