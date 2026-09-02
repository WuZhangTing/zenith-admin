<template>
  <div class="pf">
    <div class="sw">
      <span class="lbl">主题色</span>
      <i style="--c: #1a6dff" class="on"></i><i style="--c: #7c3aed"></i><i style="--c: #db2777"></i><i style="--c: #ea580c"></i>
      <i style="--c: #16a34a"></i><i style="--c: #0891b2"></i><i style="--c: #4f46e5"></i><i style="--c: #64748b"></i>
      <small>19 种</small>
    </div>
    <div class="modes">
      <span class="on">跟随系统</span><span>亮色</span><span>暗色</span><span>灰色模式</span><span>色弱模式</span>
    </div>
    <div class="plats">
      <span><i class="pwa"></i>PWA</span><span><i class="win"></i>Windows</span><span><i class="mac"></i>macOS</span><span><i class="lnx"></i>Linux</span>
    </div>
    <div class="foot">菜单收藏 · 最近访问 · 拼音搜索 · 路由动画</div>
  </div>
</template>

<style scoped>
.pf {
  width: 100%;
  display: grid;
  gap: 8px;
  font-size: 12px;
}

.sw {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 9px;
  border: 1px solid var(--zn-line);
  border-radius: 10px;
}

.lbl {
  margin-right: 2px;
  font-size: 11px;
  color: var(--zn-text-3);
  white-space: nowrap;
}

.sw i {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--c);
}

.sw i.on {
  box-shadow: 0 0 0 2px var(--zn-card), 0 0 0 3.5px var(--c);
}

.sw small {
  margin-left: auto;
  font-size: 10.5px;
  color: var(--zn-text-3);
  white-space: nowrap;
}

.modes {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.modes span {
  padding: 2px 8px;
  border: 1px solid var(--zn-line);
  border-radius: 999px;
  color: var(--zn-text-3);
  font-size: 10.5px;
  font-weight: 500;
}

.modes span.on {
  border-color: transparent;
  background: var(--zn-brand-soft);
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.plats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
}

.plats span {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 5px 0;
  border: 1px solid var(--zn-line);
  border-radius: 8px;
  font-size: 10.5px;
  font-weight: 600;
  color: var(--zn-text-2);
  white-space: nowrap;
}

.plats i {
  width: 9px;
  height: 9px;
  border-radius: 2px;
}

.pwa { background: #5b9aff; border-radius: 50% !important; }
.win { background: #0ea5e9; }
.mac { background: var(--zn-text-2); border-radius: 50% !important; }
.lnx { background: #f59e0b; }

.foot {
  font-size: 11px;
  color: var(--zn-text-3);
}
</style>
