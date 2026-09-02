<template>
  <div class="ntf">
    <div class="chs">
      <span class="on">站内信</span><span class="on">邮件</span><span>短信</span><span class="on">App 推送</span><span class="on">Webhook</span>
    </div>
    <div class="card">
      <i class="ic"></i>
      <div><b>审批提醒</b><span>「采购申请单」等待你审批，剩余 6 小时</span></div>
      <em>刚刚</em>
    </div>
    <div class="foot"><span>免打扰 22:00 – 08:00</span><i class="sw"></i></div>
  </div>
</template>

<style scoped>
.ntf {
  width: 100%;
  display: grid;
  gap: 8px;
  font-size: 12px;
}

.chs {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.chs span {
  padding: 2px 8px;
  border: 1px solid var(--zn-line);
  border-radius: 999px;
  color: var(--zn-text-3);
  font-size: 10.5px;
  font-weight: 500;
}

.chs span.on {
  border-color: transparent;
  background: var(--zn-brand-soft);
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.card {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 9px 10px;
  border: 1px solid var(--zn-line);
  border-radius: 10px;
  background: var(--zn-card);
}

.card > div {
  min-width: 0;
}

.ic {
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  background: var(--zn-warn-soft);
  position: relative;
}

.ic::after {
  content: '';
  position: absolute;
  inset: 7px 8px;
  border: 2px solid var(--zn-warn);
  border-radius: 4px 4px 6px 6px;
}

.card b {
  display: block;
  font-weight: 600;
  color: var(--zn-text-1);
}

.card span {
  display: block;
  font-size: 11px;
  line-height: 1.5;
  color: var(--zn-text-2);
}

.card em {
  margin-left: auto;
  flex: none;
  font-size: 10.5px;
  font-style: normal;
  color: var(--zn-text-3);
}

.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px;
  font-size: 11px;
  color: var(--zn-text-3);
}

.sw {
  position: relative;
  width: 24px;
  height: 14px;
  border-radius: 999px;
  background: var(--vp-c-brand-1);
}

.sw::after {
  content: '';
  position: absolute;
  top: 2px;
  right: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #fff;
}
</style>
