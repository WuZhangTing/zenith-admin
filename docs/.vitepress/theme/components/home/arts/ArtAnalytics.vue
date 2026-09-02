<template>
  <div class="an">
    <div class="kpis">
      <div><small>今日 PV</small><b>24.8k</b><em>+12.4%</em></div>
      <div><small>UV</small><b>6,210</b><em>+8.1%</em></div>
      <div><small>JS 错误</small><b>3</b><em class="warn">2 新增</em></div>
    </div>
    <svg viewBox="0 0 240 56" preserveAspectRatio="none" aria-hidden="true">
      <polyline class="area" points="0,56 0,40 24,36 48,42 72,30 96,34 120,22 144,26 168,16 192,20 216,10 240,14 240,56" />
      <polyline class="line" points="0,40 24,36 48,42 72,30 96,34 120,22 144,26 168,16 192,20 216,10 240,14" />
      <circle cx="216" cy="10" r="3" />
    </svg>
    <div class="foot"><span>Top 页面 /dashboard · 平均停留 3m 42s</span><span>会话回放 12</span></div>
  </div>
</template>

<style scoped>
.an {
  width: 100%;
  display: grid;
  gap: 8px;
  font-size: 12px;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.kpis div {
  padding: 6px 8px;
  border: 1px solid var(--zn-line);
  border-radius: 8px;
}

.kpis small {
  display: block;
  font-size: 10.5px;
  color: var(--zn-text-3);
}

.kpis b {
  display: block;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.3px;
  color: var(--zn-text-1);
}

.kpis em {
  font-size: 10.5px;
  font-style: normal;
  font-weight: 600;
  color: var(--zn-success);
}

.kpis em.warn {
  color: var(--zn-warn);
}

svg {
  display: block;
  width: 100%;
  height: 52px;
}

.area {
  fill: var(--zn-brand-soft);
  stroke: none;
}

.line {
  fill: none;
  stroke: var(--vp-c-brand-1);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

circle {
  fill: var(--vp-c-brand-1);
}

.foot {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--zn-text-3);
  white-space: nowrap;
  overflow: hidden;
}
</style>
