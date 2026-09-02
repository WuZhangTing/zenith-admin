<template>
  <div class="rec">
    <div class="l"><span>订单 #20260902-0812</span><em class="pill">已支付</em></div>
    <div class="amt">¥ 1,299.00</div>
    <hr />
    <div class="l"><span>渠道</span><b>微信支付</b></div>
    <div class="l"><span>对账</span><b>已核对 · 无差异</b></div>
    <div class="l"><span>分账</span><b>平台 5% · 商户 95%</b></div>
  </div>
</template>

<style scoped>
.rec {
  width: 100%;
  display: grid;
  gap: 7px;
  padding: 12px 14px;
  border: 1px solid var(--zn-line);
  border-radius: 12px;
  background: var(--zn-card);
  font-size: 12px;
}

.l {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--zn-text-2);
}

.l b {
  font-weight: 600;
  color: var(--zn-text-1);
}

.amt {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.6px;
  color: var(--zn-text-1);
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--zn-success-soft);
  color: var(--zn-success);
  font-size: 11px;
  font-style: normal;
  font-weight: 600;
}

.pill::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

hr {
  margin: 0;
  border: 0;
  border-top: 1px dashed var(--zn-line);
}
</style>
