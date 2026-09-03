<template>
  <div class="za pay za-panel">
    <div class="hd">
      <span class="za-mono">#20260902-0812</span>
      <em class="za-tag za-tag--ok za-tag--dot">已支付</em>
    </div>
    <div class="amt">¥ 1,299.00</div>

    <div class="rows">
      <div class="l"><span>渠道</span><b><i class="wx"></i>微信支付</b></div>
      <div class="l"><span>对账</span><b>已核对 · 无差异</b></div>
      <div class="l"><span>分账</span><b>平台 5% · 商户 95%</b></div>
    </div>

    <div class="steps">
      <div class="step done"><i></i><span>创建</span></div>
      <div class="step done"><i></i><span>支付</span></div>
      <div class="step done"><i></i><span>对账</span></div>
      <div class="step now"><i></i><span>分账</span></div>
    </div>
  </div>
</template>

<style scoped>
.pay {
  display: grid;
  gap: 10px;
  padding: 12px 14px 13px;
  border-radius: 12px;
}

.hd {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--zn-text-3);
}

.amt {
  margin-top: -4px;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.5px;
  line-height: 1.15;
}

.rows {
  display: grid;
  gap: 7px;
  padding-top: 9px;
  border-top: 1px dashed var(--zn-line-strong);
}

.l {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--zn-text-3);
}

.l b {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: 600;
  color: var(--zn-text-1);
}

.wx {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #07c160;
  box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.35);
}

/* 订单生命周期：四个节点，最后一个为当前 */
.steps {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin-top: 1px;
  padding-top: 9px;
  border-top: 1px dashed var(--zn-line-strong);
}

.step {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  color: var(--zn-text-3);
}

.step i {
  position: relative;
  z-index: 1;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--zn-line-strong);
  box-shadow: 0 0 0 2px var(--zn-card);
}

/* 节点之间的连线 */
.step:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 3.5px;
  left: 50%;
  width: 100%;
  height: 1.5px;
  background: var(--zn-line);
}

.step.done i { background: var(--zn-success); }
.step.done::after { background: var(--zn-success); }
.step.done span { color: var(--zn-text-2); }

.step.now i {
  background: var(--vp-c-brand-1);
  box-shadow: 0 0 0 2px var(--zn-card), 0 0 0 3.5px var(--zn-brand-soft);
}

.step.now span {
  color: var(--vp-c-brand-1);
  font-weight: 600;
}
</style>
