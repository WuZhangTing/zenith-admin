<script setup lang="ts">
import ArtIcon from './ArtIcon.vue'
</script>

<template>
  <div class="za mem">
    <div class="top">
      <i class="za-avatar" style="--za-av: var(--za-g-sky)">王</i>
      <div class="who">
        <b>王小明</b>
        <span>138****8888</span>
      </div>
      <em class="lv"><ArtIcon name="star" />VIP 3</em>
    </div>

    <div class="nums">
      <div><small>积分</small><b>12,480</b></div>
      <div><small>钱包余额</small><b>¥ 320</b></div>
      <div><small>优惠券</small><b>4</b></div>
    </div>

    <div class="grow">
      <div class="grow__hd"><span>距 VIP 4 还需 1,520 分</span><span>62%</span></div>
      <div class="za-bar"><i style="width: 62%"></i></div>
    </div>

    <div class="sign">
      <span class="lbl">连续签到 5 天</span>
      <i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i></i><i></i>
    </div>
  </div>
</template>

<style scoped>
.mem {
  display: grid;
  gap: 9px;
}

.top {
  display: flex;
  align-items: center;
  gap: 9px;
}

.top .za-avatar {
  width: 30px;
  height: 30px;
  font-size: 12px;
}

.who {
  min-width: 0;
}

.who b {
  display: block;
  font-weight: 600;
  line-height: 1.3;
}

.who span {
  display: block;
  font-size: 11px;
  line-height: 1.3;
  color: var(--zn-text-3);
}

.lv {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: auto;
  height: 20px;
  padding: 0 8px 0 6px;
  border-radius: 999px;
  background: linear-gradient(135deg, #fde68a, #f59e0b);
  color: #78350f;
  font-size: 10.5px;
  font-style: normal;
  font-weight: 700;
}

.lv .za-ic {
  --s: 10px;
  fill: currentColor;
  stroke-width: 0;
}

.nums {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.nums div {
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid var(--zn-line);
  border-radius: 8px;
  background: var(--zn-card-2);
}

.nums small {
  display: block;
  font-size: 10.5px;
  line-height: 1.3;
  color: var(--zn-text-3);
}

.nums b {
  display: block;
  margin-top: 1px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.grow__hd {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  font-size: 11px;
  color: var(--zn-text-3);
}

.sign {
  display: flex;
  align-items: center;
  gap: 5px;
}

.lbl {
  margin-right: auto;
  font-size: 11px;
  color: var(--zn-text-3);
}

.sign i {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1.5px dashed var(--zn-line-strong);
}

.sign i.on {
  position: relative;
  border: 0;
  background: var(--zn-success);
}

.sign i.on::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 2px;
  width: 3px;
  height: 6px;
  border: solid #fff;
  border-width: 0 1.5px 1.5px 0;
  transform: rotate(45deg);
}
</style>
