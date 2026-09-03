<script setup lang="ts">
import ArtIcon from './ArtIcon.vue'

const colors = ['#1a6dff', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0891b2']
</script>

<template>
  <div class="za pf">
    <div class="panel za-panel">
      <div class="r">
        <span class="lbl">主题色</span>
        <div class="dots">
          <i v-for="(c, i) in colors" :key="c" :class="{ on: i === 0 }" :style="{ '--c': c }"></i>
          <small>+13</small>
        </div>
      </div>

      <div class="r">
        <span class="lbl">外观</span>
        <div class="seg">
          <span><ArtIcon name="sun" />浅色</span>
          <span><ArtIcon name="moon" />深色</span>
          <span class="on"><ArtIcon name="monitor" />系统</span>
        </div>
      </div>

      <div class="r">
        <span class="lbl">辅助</span>
        <div class="chips">
          <span class="za-chip za-chip--on">灰色模式</span>
          <span class="za-chip">色弱模式</span>
        </div>
      </div>
    </div>

    <div class="plats">
      <ArtIcon name="monitor" />
      <span class="za-ellipsis">PWA · Windows · macOS · Linux</span>
    </div>
  </div>
</template>

<style scoped>
.pf {
  display: grid;
  gap: 8px;
}

.panel {
  display: grid;
  gap: 8px;
  padding: 9px 10px;
}

.r {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 22px;
}

.lbl {
  flex: none;
  width: 36px;
  font-size: 11px;
  color: var(--zn-text-3);
}

.dots {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.dots i {
  flex: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--c);
}

.dots i.on {
  box-shadow: 0 0 0 2px var(--zn-card), 0 0 0 3.5px var(--c);
}

.dots small {
  margin-left: 2px;
  font-size: 10.5px;
  color: var(--zn-text-3);
  white-space: nowrap;
}

/* 分段控件：三段等宽 */
.seg {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--zn-line);
  border-radius: 7px;
  background: var(--zn-card-2);
}

.seg span {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 20px;
  border-radius: 5px;
  color: var(--zn-text-3);
  font-size: 10.5px;
  font-weight: 500;
  white-space: nowrap;
}

.seg .za-ic {
  --s: 11px;
}

.seg span.on {
  background: var(--zn-card);
  color: var(--zn-text-1);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.chips {
  display: flex;
  gap: 5px;
}

.chips .za-chip {
  height: 20px;
}

/* 客户端形态：一条平台栏，窄卡片下省略号收尾，不换行不挤压 */
.plats {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 9px;
  border: 1px solid var(--zn-line);
  border-radius: 8px;
  background: var(--zn-card-2);
}

.plats .za-ic {
  --s: 12px;
  color: var(--zn-text-3);
}

.plats span {
  flex: 1;
  font-size: 10.5px;
  font-weight: 600;
  color: var(--zn-text-2);
}
</style>
