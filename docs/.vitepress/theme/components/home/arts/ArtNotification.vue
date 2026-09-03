<script setup lang="ts">
import ArtIcon from './ArtIcon.vue'

const channels = [
  { icon: 'bell', label: '站内信', on: true },
  { icon: 'mail', label: '邮件', on: true },
  { icon: 'sms', label: '短信', on: false },
  { icon: 'phone', label: '推送', on: true },
  { icon: 'webhook', label: 'Webhook', on: true },
] as const
</script>

<template>
  <div class="za ntf">
    <div class="chs">
      <div v-for="c in channels" :key="c.label" class="ch" :class="{ on: c.on }">
        <i><ArtIcon :name="c.icon" /></i>
        <span>{{ c.label }}</span>
      </div>
    </div>

    <div class="card za-panel">
      <i class="ic"><ArtIcon name="bell" /></i>
      <div class="card__bd">
        <b>审批提醒<em>刚刚</em></b>
        <span>「采购申请单」等待你审批，剩余 6 小时</span>
      </div>
    </div>

    <div class="foot">
      <ArtIcon name="moon" />
      <span>免打扰 22:00 – 08:00</span>
      <i class="za-switch"></i>
    </div>
  </div>
</template>

<style scoped>
.ntf {
  display: grid;
  gap: 9px;
}

/* 五个渠道按内容宽度两端分布，图标 + 标签，未启用渠道置灰 */
.chs {
  display: flex;
  justify-content: space-between;
  padding: 0 4px;
}

.ch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.ch i {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 1px solid var(--zn-line);
  border-radius: 8px;
  color: var(--zn-text-3);
  background: var(--zn-card-2);
}

.ch .za-ic {
  --s: 13px;
}

.ch span {
  font-size: 10px;
  line-height: 1;
  color: var(--zn-text-3);
  white-space: nowrap;
}

.ch.on i {
  border-color: transparent;
  background: var(--zn-brand-soft);
  color: var(--vp-c-brand-1);
}

.ch.on span {
  color: var(--zn-text-2);
  font-weight: 500;
}

.card {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 9px 10px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
}

.ic {
  flex: none;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: var(--zn-warn-soft);
  color: var(--zn-warn);
}

.ic .za-ic {
  --s: 14px;
}

.card__bd {
  min-width: 0;
  flex: 1;
}

.card__bd b {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-weight: 600;
  line-height: 1.3;
}

.card__bd em {
  flex: none;
  font-size: 10.5px;
  font-style: normal;
  font-weight: 400;
  color: var(--zn-text-3);
}

.card__bd span {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--zn-text-2);
}

.foot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 2px;
  font-size: 11px;
  color: var(--zn-text-3);
}

.foot .za-ic {
  --s: 12px;
}

.foot span {
  flex: 1;
}
</style>
