<script setup lang="ts">
import ArtIcon from './ArtIcon.vue'
</script>

<template>
  <div class="za wiki">
    <div class="sp">
      <i class="za-avatar za-avatar--sq" style="--za-av: var(--za-g-sky)"><ArtIcon name="folder" /></i>
      <b>产品空间</b>
      <small>12 人 · 可编辑</small>
    </div>

    <div class="tree za-panel za-panel--soft">
      <div class="n n--dir"><ArtIcon name="chevron" class="cv" />需求文档</div>
      <div class="n n--doc n--on"><ArtIcon name="file" /><span class="za-ellipsis">PRD · 会员体系 v2</span><em class="za-mono">v12</em></div>
      <div class="n n--doc"><ArtIcon name="file" /><span class="za-ellipsis">竞品分析 · 2026Q3</span></div>
      <div class="n n--dir"><ArtIcon name="chevron" class="cv" />会议纪要</div>
      <div class="n n--doc"><ArtIcon name="file" /><span class="za-ellipsis">9 月产品周会</span></div>
    </div>

    <div class="za-foot">
      <span class="za-tag za-tag--ok">已发布</span>
      <span class="za-ellipsis">审批人 张伟 · 3 条评论</span>
    </div>
  </div>
</template>

<style scoped>
.wiki {
  display: grid;
  gap: 7px;
}

.sp {
  display: flex;
  align-items: center;
  gap: 7px;
  font-weight: 600;
}

.sp .za-avatar {
  width: 20px;
  height: 20px;
  border-radius: 6px;
}

.sp .za-avatar .za-ic {
  --s: 11px;
}

.sp small {
  margin-left: auto;
  font-size: 10.5px;
  font-weight: 500;
  color: var(--zn-text-3);
  white-space: nowrap;
}

.tree {
  display: grid;
  gap: 1px;
  padding: 5px;
}

.n {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 7px;
  border-radius: 6px;
  color: var(--zn-text-2);
  white-space: nowrap;
}

.n .za-ic {
  --s: 12px;
  color: var(--zn-text-3);
}

.n--dir {
  font-weight: 600;
  color: var(--zn-text-1);
}

.cv {
  --s: 11px;
  stroke-width: 2.4;
}

.n--doc {
  padding-left: 21px;
}

.n--on {
  background: var(--zn-card);
  color: var(--vp-c-brand-1);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.n--on .za-ic {
  color: var(--vp-c-brand-1);
}

.n em {
  margin-left: auto;
  font-style: normal;
  font-size: 10px;
  color: var(--zn-text-3);
}
</style>
