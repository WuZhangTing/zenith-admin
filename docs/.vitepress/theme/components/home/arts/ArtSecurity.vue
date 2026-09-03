<script setup lang="ts">
import ArtIcon from './ArtIcon.vue'

const items = ['JWT 鉴权', '企业 SSO', 'IP 白名单', '数据脱敏', '幂等防重', '接口限流']
</script>

<template>
  <div class="za sec">
    <div class="hd za-panel">
      <i class="sh"><ArtIcon name="shield" /></i>
      <div class="hd__bd">
        <b>12 项策略已启用</b>
        <span>登录风险事件 · 今日 0</span>
      </div>
      <em class="za-tag za-tag--ok">A+</em>
    </div>

    <div class="grid">
      <div v-for="it in items" :key="it" class="chk">
        <i><ArtIcon name="check" /></i>
        <span class="za-ellipsis">{{ it }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sec {
  display: grid;
  gap: 8px;
}

.hd {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
}

.sh {
  flex: none;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--zn-success-soft);
  color: var(--zn-success);
}

.sh .za-ic {
  --s: 15px;
}

.hd__bd {
  flex: 1;
  min-width: 0;
}

.hd__bd b {
  display: block;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hd__bd span {
  display: block;
  margin-top: 1px;
  font-size: 10.5px;
  line-height: 1.3;
  color: var(--zn-text-3);
  white-space: nowrap;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.chk {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  padding: 0 9px;
  border: 1px solid var(--zn-line);
  border-radius: 8px;
  font-size: 11.5px;
  font-weight: 500;
}

.chk i {
  flex: none;
  display: grid;
  place-items: center;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--zn-success-soft);
  color: var(--zn-success);
}

.chk .za-ic {
  --s: 9px;
  stroke-width: 3;
}
</style>
