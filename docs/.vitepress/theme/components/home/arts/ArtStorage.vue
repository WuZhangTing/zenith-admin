<script setup lang="ts">
import ArtIcon from './ArtIcon.vue'
</script>

<template>
  <div class="za st">
    <div class="backs">
      <span class="za-chip za-chip--on">本地</span>
      <span class="za-chip za-chip--on">阿里云 OSS</span>
      <span class="za-chip">腾讯云 COS</span>
      <span class="za-chip">S3</span>
      <span class="za-chip">Azure</span>
      <span class="za-chip">SFTP</span>
      <span class="za-chip">+3</span>
    </div>

    <div class="file za-panel">
      <i class="ic za-mono">XLS</i>
      <div class="file__bd">
        <b class="za-ellipsis">季度经营报表.xlsx</b>
        <span class="za-ellipsis">2.4 MB · 校验通过</span>
      </div>
      <em class="ok"><ArtIcon name="check" /></em>
    </div>

    <div class="up">
      <div class="up__hd">
        <span class="za-ellipsis"><ArtIcon name="upload" />合同扫描件.pdf</span>
        <b class="za-mono">68%</b>
      </div>
      <div class="za-bar"><i style="width: 68%"></i></div>
    </div>
  </div>
</template>

<style scoped>
.st {
  display: grid;
  gap: 9px;
}

.backs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.backs .za-chip {
  height: 19px;
  padding: 0 7px;
  border-radius: 6px;
  font-size: 10px;
}

.file {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
}

.ic {
  flex: none;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 7px;
  background: var(--zn-success-soft);
  color: var(--zn-success);
  font-size: 9.5px;
  font-style: normal;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.file__bd {
  flex: 1;
  min-width: 0;
}

.file__bd b {
  display: block;
  font-weight: 600;
  line-height: 1.3;
}

.file__bd span {
  display: block;
  margin-top: 1px;
  font-size: 10.5px;
  line-height: 1.3;
  color: var(--zn-text-3);
}

.ok {
  flex: none;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--zn-success-soft);
  color: var(--zn-success);
}

.ok .za-ic {
  --s: 11px;
  stroke-width: 2.6;
}

.up__hd {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
  font-size: 11px;
  color: var(--zn-text-2);
}

.up__hd span {
  display: flex;
  align-items: center;
  gap: 5px;
}

.up__hd .za-ic {
  --s: 12px;
  color: var(--zn-text-3);
}

.up__hd b {
  flex: none;
  font-weight: 600;
  color: var(--zn-text-2);
}
</style>
