<template>
  <div class="tn">
    <div class="sel">
      <i class="logo"></i>
      <div><small>当前租户</small><b>Acme 集团</b></div>
      <em class="plan">企业版</em>
      <span class="caret">▾</span>
    </div>
    <div class="list">
      <div class="row"><b>Acme 集团</b><span>企业版 · 128 用户</span><i class="dot"></i></div>
      <div class="row"><b>星辰科技</b><span>专业版 · 36 用户</span></div>
      <div class="row"><b>演示租户</b><span>体验版 · 到期 30 天</span></div>
    </div>
  </div>
</template>

<style scoped>
.tn {
  width: 100%;
  display: grid;
  gap: 7px;
  font-size: 12px;
}

.sel {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 10px;
  background: var(--zn-card);
}

.logo {
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  background: linear-gradient(135deg, #60a5fa, #1d4ed8);
}

.sel small {
  display: block;
  font-size: 10px;
  color: var(--zn-text-3);
}

.sel b {
  display: block;
  font-weight: 600;
  color: var(--zn-text-1);
}

.plan {
  margin-left: auto;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--zn-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 10.5px;
  font-style: normal;
  font-weight: 600;
}

.caret {
  color: var(--zn-text-3);
  font-size: 11px;
}

.list {
  display: grid;
  gap: 2px;
  padding: 5px;
  border: 1px solid var(--zn-line);
  border-radius: 10px;
  background: var(--zn-card-2);
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 7px;
  border-radius: 6px;
}

.row b {
  font-weight: 500;
  color: var(--zn-text-1);
}

.row span {
  margin-left: auto;
  font-size: 10.5px;
  color: var(--zn-text-3);
  white-space: nowrap;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--vp-c-brand-1);
}
</style>
