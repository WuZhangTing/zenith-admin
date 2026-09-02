<template>
  <div class="mp">
    <div class="phone">
      <div class="bubble bubble--me">会员</div>
      <div class="bubble">
        <b>关键词自动回复</b>
        您好，王小明！当前等级 VIP 3，积分 12,480。<span class="lk">查看会员权益 →</span>
      </div>
      <div class="menu"><span>☰</span><span>产品中心</span><span>会员服务</span><span>联系我们</span></div>
    </div>
    <div class="foot">3 个公众号 · 粉丝 48,210 · 今日新增 +312</div>
  </div>
</template>

<style scoped>
.mp {
  width: 100%;
  display: grid;
  gap: 7px;
  font-size: 12px;
}

.phone {
  display: grid;
  gap: 7px;
  padding: 10px 10px 0;
  border: 1px solid var(--zn-line);
  border-radius: 12px;
  background: var(--zn-card-2);
  overflow: hidden;
}

.bubble {
  max-width: 86%;
  padding: 6px 9px;
  border: 1px solid var(--zn-line);
  border-radius: 9px;
  border-top-left-radius: 3px;
  background: var(--zn-card);
  color: var(--zn-text-2);
  font-size: 11px;
  line-height: 1.5;
}

.bubble b {
  display: block;
  font-size: 10.5px;
  font-weight: 600;
  color: var(--zn-text-3);
  margin-bottom: 1px;
}

.bubble--me {
  margin-left: auto;
  border-radius: 9px;
  border-top-right-radius: 3px;
  border-color: #95ec69;
  background: #95ec69;
  color: #111;
}

.dark .bubble--me {
  border-color: #3eb575;
  background: #3eb575;
  color: #fff;
}

.lk {
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.menu {
  display: grid;
  grid-template-columns: 28px repeat(3, 1fr);
  margin: 2px -10px 0;
  border-top: 1px solid var(--zn-line);
  background: var(--zn-card);
  font-size: 11px;
  color: var(--zn-text-1);
}

.menu span {
  padding: 7px 0;
  text-align: center;
  border-right: 1px solid var(--zn-line);
  white-space: nowrap;
}

.menu span:last-child {
  border-right: 0;
}

.menu span:first-child {
  color: var(--zn-text-3);
}

.foot {
  font-size: 11px;
  color: var(--zn-text-3);
}
</style>
