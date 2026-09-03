<script setup lang="ts">
const bars = [34, 46, 40, 52, 48, 62, 56, 70, 64, 58, 74, 82, 76, 88, 84, 100]
</script>

<template>
  <div class="za rp">
    <div class="kpi">
      <div>
        <small>本月 GMV</small>
        <b>¥ 1.28M</b>
      </div>
      <span class="za-tag za-tag--ok">↑ 18.2%</span>
    </div>

    <div class="chart">
      <div class="bars">
        <i
          v-for="(h, i) in bars"
          :key="i"
          :class="{ on: i === bars.length - 1 }"
          :style="{ '--h': h + '%' }"
        ></i>
      </div>
      <span class="tip za-mono">¥ 212k</span>
    </div>

    <div class="axis za-mono">
      <span>9/1</span><span>9/8</span><span>9/15</span><span>9/22</span><span>9/30</span>
    </div>
  </div>
</template>

<style scoped>
.rp {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
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
  margin-top: 1px;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.5px;
  line-height: 1.15;
}

.chart {
  position: relative;
  flex: 1;
  min-height: 76px;
  /* 四条基准网格线 */
  background-image: linear-gradient(var(--zn-line) 1px, transparent 1px);
  background-size: 100% 25%;
  background-repeat: repeat-y;
  border-bottom: 1px solid var(--zn-line-strong);
}

.bars {
  position: absolute;
  inset: 16px 0 0;
  display: flex;
  align-items: flex-end;
  gap: 4px;
}

.bars i {
  flex: 1;
  min-width: 0;
  height: var(--h);
  border-radius: 3px 3px 0 0;
  background: var(--zn-brand-soft);
}

.bars i.on {
  background: var(--vp-c-brand-1);
}

.tip {
  position: absolute;
  top: -8px;
  right: 0;
  padding: 2px 6px;
  border-radius: 5px;
  background: var(--zn-text-1);
  color: var(--zn-card);
  font-weight: 600;
  line-height: 1.3;
}

.tip::after {
  content: '';
  position: absolute;
  bottom: -3px;
  right: 10px;
  width: 6px;
  height: 6px;
  transform: rotate(45deg);
  background: inherit;
}

.axis {
  display: flex;
  justify-content: space-between;
  color: var(--zn-text-3);
}
</style>
