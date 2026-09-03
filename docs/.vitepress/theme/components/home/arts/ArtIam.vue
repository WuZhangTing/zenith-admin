<script setup lang="ts">
import ArtIcon from './ArtIcon.vue'
</script>

<template>
  <div class="za iam">
    <div class="role za-panel">
      <i class="za-avatar" style="--za-av: var(--za-g-indigo)">管</i>
      <b>管理员</b>
      <span>全部菜单</span>
      <i class="za-switch"></i>
    </div>
    <div class="role za-panel">
      <i class="za-avatar" style="--za-av: var(--za-g-emerald)">运</i>
      <b>运营</b>
      <span>内容 · 会员</span>
      <i class="za-switch"></i>
    </div>
    <div class="role za-panel">
      <i class="za-avatar" style="--za-av: var(--za-g-amber)">访</i>
      <b>访客</b>
      <span>只读</span>
      <i class="za-switch za-switch--off"></i>
    </div>
    <div class="scope">
      <ArtIcon name="building" />
      <span>数据范围</span>
      <b>本部门及以下</b>
    </div>
  </div>
</template>

<style scoped>
.iam {
  display: grid;
  gap: 7px;
}

.role {
  display: flex;
  align-items: center;
  gap: 9px;
  height: 40px;
  padding: 0 10px;
}

.role b {
  font-weight: 600;
  white-space: nowrap;
}

.role span {
  margin-left: auto;
  font-size: 11px;
  color: var(--zn-text-3);
  white-space: nowrap;
}

.scope {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 1px 2px 0;
  font-size: 11px;
  color: var(--zn-text-3);
}

.scope .za-ic {
  --s: 13px;
}

.scope b {
  font-weight: 600;
  color: var(--zn-text-2);
}
</style>
