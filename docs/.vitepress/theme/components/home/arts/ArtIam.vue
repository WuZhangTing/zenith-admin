<template>
  <div class="roles">
    <div class="role">
      <i class="av"></i><b>管理员</b><span>全部菜单</span><i class="sw"></i>
    </div>
    <div class="role">
      <i class="av av--b"></i><b>运营</b><span>内容 · 会员</span><i class="sw"></i>
    </div>
    <div class="role">
      <i class="av av--c"></i><b>访客</b><span>只读</span><i class="sw sw--off"></i>
    </div>
    <div class="scope">数据范围：<b>本部门及以下</b></div>
  </div>
</template>

<style scoped>
.roles {
  width: 100%;
  display: grid;
  gap: 7px;
  font-size: 12px;
}

.role {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 9px;
  border: 1px solid var(--zn-line);
  border-radius: 10px;
  background: var(--zn-card);
}

.role b {
  font-weight: 600;
  color: var(--zn-text-1);
}

.role span {
  margin-left: auto;
  font-size: 11px;
  color: var(--zn-text-3);
}

.av {
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #c7d2fe;
}

.av--b { background: #bbf7d0; }
.av--c { background: #fde68a; }

.sw {
  position: relative;
  flex: none;
  width: 26px;
  height: 15px;
  border-radius: 999px;
  background: var(--vp-c-brand-1);
}

.sw::after {
  content: '';
  position: absolute;
  top: 2px;
  right: 2px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #fff;
}

.sw--off { background: var(--zn-line-strong); }
.sw--off::after { right: auto; left: 2px; }

.scope {
  padding: 2px 2px 0;
  font-size: 11px;
  color: var(--zn-text-3);
}

.scope b {
  font-weight: 600;
  color: var(--zn-text-2);
}
</style>
