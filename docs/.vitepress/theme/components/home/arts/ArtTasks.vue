<script setup lang="ts">
import ArtIcon from './ArtIcon.vue'
</script>

<template>
  <div class="za tasks">
    <div class="t">
      <div class="t__hd">
        <i class="st st--run"><ArtIcon name="refresh" /></i>
        <b class="za-ellipsis">导出会员名单</b>
        <span class="za-mono">78%</span>
      </div>
      <div class="za-bar"><i style="width: 78%"></i></div>
    </div>

    <div class="t">
      <div class="t__hd">
        <i class="st st--ok"><ArtIcon name="check" /></i>
        <b class="za-ellipsis">批量导入用户 · 1,204 行</b>
        <span class="ok">已完成</span>
      </div>
      <div class="za-bar za-bar--ok"><i style="width: 100%"></i></div>
    </div>

    <div class="t">
      <div class="t__hd">
        <i class="st st--q"></i>
        <b class="za-ellipsis">数据库全量备份</b>
        <span class="q">排队中</span>
      </div>
      <div class="za-bar"><i style="width: 0"></i></div>
    </div>

    <div class="za-foot">
      <span class="za-ellipsis">pg-boss · 12 队列 · 失败自动重试 3 次</span>
    </div>
  </div>
</template>

<style scoped>
.tasks {
  display: grid;
  gap: 10px;
}

.t__hd {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 5px;
}

.st {
  flex: none;
  display: grid;
  place-items: center;
  width: 15px;
  height: 15px;
  border-radius: 50%;
}

.st .za-ic {
  --s: 9px;
  stroke-width: 2.8;
}

.st--run {
  background: var(--zn-brand-soft);
  color: var(--vp-c-brand-1);
}

.st--ok {
  background: var(--zn-success-soft);
  color: var(--zn-success);
}

.st--q {
  border: 1.5px dashed var(--zn-line-strong);
}

.t__hd b {
  flex: 1;
  font-weight: 500;
}

.t__hd span {
  flex: none;
  font-size: 11px;
  color: var(--zn-text-2);
}

.t__hd .ok { color: var(--zn-success); font-weight: 600; }
.t__hd .q { color: var(--zn-text-3); }
</style>
