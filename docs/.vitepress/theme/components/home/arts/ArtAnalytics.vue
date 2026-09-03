<template>
  <div class="za an">
    <div class="kpis">
      <div><small>今日 PV</small><b>24.8k</b><em>+12.4%</em></div>
      <div><small>UV</small><b>6,210</b><em>+8.1%</em></div>
      <div><small>JS 错误</small><b>3</b><em class="warn">2 新增</em></div>
    </div>

    <div class="spark">
      <!-- 折线拉伸填满宽度，描边用 non-scaling-stroke 保持 2px；峰值点用 HTML 元素定位，避免被拉成椭圆 -->
      <svg viewBox="0 0 240 56" preserveAspectRatio="none" aria-hidden="true">
        <polygon class="area" points="0,56 0,40 24,36 48,42 72,30 96,34 120,22 144,26 168,16 192,20 216,10 240,14 240,56" />
        <polyline class="line" points="0,40 24,36 48,42 72,30 96,34 120,22 144,26 168,16 192,20 216,10 240,14" />
      </svg>
      <i class="dot" style="left: 90%; top: 17.9%"></i>
    </div>

    <div class="za-foot">
      <span class="za-ellipsis">Top /dashboard · 停留 3m 42s</span>
      <span class="rp">回放 12</span>
    </div>
  </div>
</template>

<style scoped>
.an {
  display: grid;
  gap: 8px;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.kpis div {
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid var(--zn-line);
  border-radius: 8px;
}

.kpis small {
  display: block;
  font-size: 10.5px;
  line-height: 1.3;
  color: var(--zn-text-3);
  white-space: nowrap;
}

.kpis b {
  display: block;
  margin-top: 1px;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.3px;
  line-height: 1.25;
  white-space: nowrap;
}

.kpis em {
  display: block;
  font-size: 10.5px;
  font-style: normal;
  font-weight: 600;
  line-height: 1.3;
  color: var(--zn-success);
  white-space: nowrap;
}

.kpis em.warn {
  color: var(--zn-warn);
}

.spark {
  position: relative;
  height: 56px;
  border-bottom: 1px solid var(--zn-line);
}

svg {
  display: block;
  width: 100%;
  height: 100%;
}

.area {
  fill: var(--zn-brand-soft);
}

.line {
  fill: none;
  stroke: var(--vp-c-brand-1);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

.dot {
  position: absolute;
  width: 8px;
  height: 8px;
  margin: -4px 0 0 -4px;
  border: 2px solid var(--zn-card);
  border-radius: 50%;
  background: var(--vp-c-brand-1);
  box-shadow: 0 0 0 2px var(--zn-brand-soft);
}

.rp {
  flex: none;
  margin-left: auto;
  color: var(--zn-text-2);
  font-weight: 500;
}
</style>
