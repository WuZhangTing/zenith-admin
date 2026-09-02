<template>
  <div class="mem">
    <div class="top">
      <i class="av"></i>
      <div><b>王小明</b><span>138****8888</span></div>
      <em class="lv">VIP 3</em>
    </div>
    <div class="nums">
      <div><small>积分</small><b>12,480</b></div>
      <div><small>钱包余额</small><b>¥ 320.00</b></div>
      <div><small>优惠券</small><b>4</b></div>
    </div>
    <div class="prog"><i style="width: 62%"></i></div>
    <div class="hint">距 VIP 4 还需 1,520 分 · 连续签到 5 天</div>
  </div>
</template>

<style scoped>
.mem {
  width: 100%;
  display: grid;
  gap: 9px;
  font-size: 12px;
}

.top {
  display: flex;
  align-items: center;
  gap: 9px;
}

.av {
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: linear-gradient(135deg, #a5b4fc, #60a5fa);
}

.top b {
  display: block;
  font-weight: 600;
  color: var(--zn-text-1);
}

.top span {
  display: block;
  font-size: 11px;
  color: var(--zn-text-3);
}

.lv {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--zn-warn-soft);
  color: var(--zn-warn);
  font-size: 11px;
  font-style: normal;
  font-weight: 700;
}

.nums {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.nums div {
  padding: 6px 8px;
  border: 1px solid var(--zn-line);
  border-radius: 8px;
  background: var(--zn-card-2);
}

.nums small {
  display: block;
  font-size: 10.5px;
  color: var(--zn-text-3);
}

.nums b {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: var(--zn-text-1);
  white-space: nowrap;
}

.prog {
  height: 6px;
  border-radius: 999px;
  background: var(--zn-line);
  overflow: hidden;
}

.prog i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--vp-c-brand-1);
}

.hint {
  font-size: 11px;
  color: var(--zn-text-3);
}
</style>
