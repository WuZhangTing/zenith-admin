<template>
  <div class="im">
    <div class="it it--active">
      <i class="av av--on"></i>
      <div><b>产品评审群</b><span>@你 明早 10 点过一下原型</span></div>
      <em class="badge">3</em>
    </div>
    <div class="it">
      <i class="av av--on"></i>
      <div><b>李明</b><span>语音通话 · 02:14</span></div>
      <em class="t">09:41</em>
    </div>
    <div class="it">
      <i class="av"></i>
      <div><b>运维告警</b><span>prod-01 CPU 恢复正常</span></div>
      <em class="t">昨天</em>
    </div>
  </div>
</template>

<style scoped>
.im {
  width: 100%;
  display: grid;
  gap: 4px;
}

.it {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 10px;
}

.it--active {
  background: var(--zn-card-2);
}

.it > div {
  min-width: 0;
}

.av {
  position: relative;
  flex: none;
  width: 26px;
  height: 26px;
  border-radius: 9px;
  background: var(--zn-line);
}

.av--on::after {
  content: '';
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 8px;
  height: 8px;
  border: 2px solid var(--zn-card);
  border-radius: 50%;
  background: var(--zn-success);
}

.it b {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--zn-text-1);
}

.it span {
  display: block;
  font-size: 11px;
  color: var(--zn-text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.it em {
  flex: none;
  margin-left: auto;
  font-style: normal;
}

.badge {
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}

.t {
  font-size: 10.5px;
  color: var(--zn-text-3);
}
</style>
