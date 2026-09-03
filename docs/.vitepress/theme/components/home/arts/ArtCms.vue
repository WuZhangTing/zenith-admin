<script setup lang="ts">
import ArtIcon from './ArtIcon.vue'
</script>

<template>
  <div class="za cms">
    <div class="tabs">
      <span class="on">官网</span><span>帮助中心</span><span>活动站</span>
    </div>

    <div class="rows">
      <div class="row">
        <ArtIcon name="file" />
        <b class="za-ellipsis">2026 秋季新品发布</b>
        <em class="za-tag za-tag--ok">已发布</em>
      </div>
      <div class="row">
        <ArtIcon name="file" />
        <b class="za-ellipsis">企业服务白皮书 v3</b>
        <em class="za-tag za-tag--warn">待审核</em>
      </div>
      <div class="row">
        <ArtIcon name="file" />
        <b class="za-ellipsis">渠道合作伙伴招募</b>
        <em class="za-tag za-tag--muted">草稿</em>
      </div>
    </div>

    <div class="za-foot"><i class="pulse"></i>静态化发布 · 3 站点 · 2 分钟前</div>
  </div>
</template>

<style scoped>
.cms {
  display: grid;
  gap: 8px;
}

.tabs {
  display: flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--zn-line);
  border-radius: 9px;
  background: var(--zn-card-2);
}

.tabs span {
  flex: 1;
  padding: 3px 0;
  border-radius: 6px;
  color: var(--zn-text-3);
  font-size: 11px;
  font-weight: 500;
  text-align: center;
  white-space: nowrap;
}

.tabs span.on {
  background: var(--zn-card);
  color: var(--zn-text-1);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.rows {
  display: grid;
  gap: 6px;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 9px;
  border: 1px solid var(--zn-line);
  border-radius: 9px;
}

.row .za-ic {
  --s: 13px;
  color: var(--zn-text-3);
}

.row b {
  flex: 1;
  font-weight: 500;
}

.pulse {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--zn-success);
  box-shadow: 0 0 0 2.5px var(--zn-success-soft);
}
</style>
