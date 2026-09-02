<template>
  <div class="chart">
    <div class="kpi">
      <div><small>本月 GMV</small><b>¥ 1.28M</b></div>
      <em>+18.2%</em>
    </div>
    <div class="bars">
      <i style="--h: 38%"></i><i style="--h: 52%"></i><i style="--h: 46%"></i><i style="--h: 70%"></i>
      <i style="--h: 62%"></i><i style="--h: 84%"></i><i class="on" style="--h: 100%"></i>
    </div>
    <div class="axis"><span>周一</span><span>周日</span></div>
  </div>
</template>

<style scoped>
.chart {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kpi {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.kpi small {
  display: block;
  font-size: 11px;
  color: var(--zn-text-3);
}

.kpi b {
  display: block;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.4px;
  color: var(--zn-text-1);
}

.kpi em {
  font-style: normal;
  font-size: 12px;
  font-weight: 600;
  color: var(--zn-success);
}

.bars {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 6px;
  min-height: 64px;
}

.bars i {
  flex: 1;
  height: var(--h);
  border-radius: 4px 4px 2px 2px;
  background: var(--zn-brand-soft);
}

.bars i.on {
  background: var(--vp-c-brand-1);
}

.axis {
  display: flex;
  justify-content: space-between;
  font-size: 10.5px;
  color: var(--zn-text-3);
}
</style>
