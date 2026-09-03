<script setup lang="ts">
import ArtIcon from './ArtIcon.vue'
</script>

<template>
  <div class="za tn">
    <div class="sel">
      <i class="za-avatar za-avatar--sq" style="--za-av: var(--za-g-indigo)">A</i>
      <div class="sel__bd">
        <small>当前租户</small>
        <b>Acme 集团</b>
      </div>
      <em class="za-tag za-tag--brand">企业版</em>
      <ArtIcon name="chevron" class="cv" />
    </div>

    <div class="list za-panel za-panel--soft">
      <div class="row on"><b>Acme 集团</b><span>企业版 · 128 用户</span><i></i></div>
      <div class="row"><b>星辰科技</b><span>专业版 · 36 用户</span></div>
      <div class="row"><b>演示租户</b><span>体验版 · 到期 30 天</span></div>
    </div>
  </div>
</template>

<style scoped>
.tn {
  display: grid;
  gap: 7px;
}

.sel {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 9px;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 10px;
  background: var(--zn-card);
  box-shadow: 0 0 0 3px var(--zn-brand-soft);
}

.sel .za-avatar {
  border-radius: 7px;
  font-size: 12px;
}

.sel__bd {
  flex: 1;
  min-width: 0;
}

.sel__bd small {
  display: block;
  font-size: 10px;
  line-height: 1.3;
  color: var(--zn-text-3);
}

.sel__bd b {
  display: block;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
}

.cv {
  --s: 12px;
  color: var(--zn-text-3);
}

.list {
  display: grid;
  gap: 1px;
  padding: 5px;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 26px;
  padding: 0 7px;
  border-radius: 6px;
}

.row.on {
  background: var(--zn-card);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.row b {
  font-weight: 500;
  white-space: nowrap;
}

.row span {
  margin-left: auto;
  font-size: 10.5px;
  color: var(--zn-text-3);
  white-space: nowrap;
}

.row i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--vp-c-brand-1);
}
</style>
