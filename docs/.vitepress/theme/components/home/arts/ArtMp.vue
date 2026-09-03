<script setup lang="ts">
import ArtIcon from './ArtIcon.vue'
</script>

<template>
  <div class="za mp">
    <div class="phone za-panel za-panel--soft">
      <div class="bubble bubble--me">会员</div>
      <div class="bubble">
        <b>关键词自动回复</b>
        您好，王小明！当前等级 VIP 3，积分 12,480。
        <span class="lk">查看会员权益 →</span>
      </div>
      <div class="menu">
        <span class="menu__ic"><ArtIcon name="menu" /></span>
        <span>产品中心</span><span>会员服务</span><span>联系我们</span>
      </div>
    </div>

    <div class="za-foot">
      <span class="za-ellipsis">3 个公众号 · 粉丝 48,210 · 今日 +312</span>
    </div>
  </div>
</template>

<style scoped>
.mp {
  display: grid;
  gap: 8px;
}

.phone {
  display: grid;
  gap: 7px;
  padding: 10px 10px 0;
  border-radius: 12px;
  overflow: hidden;
}

.bubble {
  position: relative;
  max-width: 88%;
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
  margin-bottom: 1px;
  font-size: 10.5px;
  font-weight: 600;
  color: var(--zn-text-3);
}

.bubble--me {
  justify-self: end;
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
  display: block;
  margin-top: 1px;
  color: var(--vp-c-brand-1);
  font-weight: 600;
  white-space: nowrap;
}

.menu {
  display: grid;
  grid-template-columns: 30px repeat(3, minmax(0, 1fr));
  margin: 3px -10px 0;
  border-top: 1px solid var(--zn-line);
  background: var(--zn-card);
  font-size: 11px;
}

.menu span {
  display: grid;
  place-items: center;
  height: 30px;
  border-right: 1px solid var(--zn-line);
  white-space: nowrap;
  overflow: hidden;
}

.menu span:last-child {
  border-right: 0;
}

.menu__ic {
  color: var(--zn-text-3);
}

.menu__ic .za-ic {
  --s: 13px;
}
</style>
