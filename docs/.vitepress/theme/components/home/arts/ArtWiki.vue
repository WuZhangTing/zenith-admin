<template>
  <div class="wiki">
    <div class="sp"><i></i>产品空间 <small>12 人 · 可编辑</small></div>
    <div class="tree">
      <div class="n n--dir">▾ 需求文档</div>
      <div class="n n--doc n--on">PRD · 会员体系 v2 <em>v12</em></div>
      <div class="n n--doc">竞品分析 · 2026Q3</div>
      <div class="n n--dir">▾ 会议纪要</div>
      <div class="n n--doc">9 月产品周会</div>
    </div>
    <div class="foot"><span class="ok">已发布</span>审批人 张伟 · 3 条评论</div>
  </div>
</template>

<style scoped>
.wiki {
  width: 100%;
  display: grid;
  gap: 6px;
  font-size: 12px;
}

.sp {
  display: flex;
  align-items: center;
  gap: 7px;
  font-weight: 600;
  color: var(--zn-text-1);
}

.sp i {
  width: 16px;
  height: 16px;
  border-radius: 5px;
  background: linear-gradient(135deg, #60a5fa, #1d4ed8);
}

.sp small {
  margin-left: auto;
  font-size: 10.5px;
  font-weight: 500;
  color: var(--zn-text-3);
}

.tree {
  display: grid;
  gap: 2px;
  padding: 6px;
  border: 1px solid var(--zn-line);
  border-radius: 10px;
  background: var(--zn-card-2);
}

.n {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 7px;
  border-radius: 6px;
  color: var(--zn-text-2);
  white-space: nowrap;
  overflow: hidden;
}

.n--dir {
  font-weight: 600;
  color: var(--zn-text-1);
}

.n--doc {
  padding-left: 22px;
}

.n--doc::before {
  content: '';
  width: 8px;
  height: 10px;
  border: 1.5px solid var(--zn-text-3);
  border-radius: 2px;
  flex: none;
}

.n--on {
  background: var(--zn-card);
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.n em {
  margin-left: auto;
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
  font-style: normal;
  color: var(--zn-text-3);
}

.foot {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--zn-text-3);
}

.ok {
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--zn-success-soft);
  color: var(--zn-success);
  font-weight: 600;
}
</style>
