<template>
  <div class="cms">
    <div class="tabs"><span class="on">官网</span><span>帮助中心</span><span>活动站</span></div>
    <div class="row"><b>2026 秋季新品发布</b><em class="st st--pub">已发布</em></div>
    <div class="row"><b>企业服务白皮书 v3</b><em class="st st--rev">待审核</em></div>
    <div class="row"><b>渠道合作伙伴招募</b><em class="st st--draft">草稿</em></div>
    <div class="foot"><i></i>静态化发布 · 3 站点 · 2 分钟前</div>
  </div>
</template>

<style scoped>
.cms {
  width: 100%;
  display: grid;
  gap: 6px;
  font-size: 12px;
}

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 2px;
}

.tabs span {
  padding: 3px 9px;
  border-radius: 6px;
  color: var(--zn-text-3);
  font-size: 11px;
  font-weight: 500;
}

.tabs span.on {
  background: var(--zn-brand-soft);
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 9px;
  border: 1px solid var(--zn-line);
  border-radius: 9px;
}

.row b {
  font-weight: 500;
  color: var(--zn-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.st {
  flex: none;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 10.5px;
  font-style: normal;
  font-weight: 600;
}

.st--pub { background: var(--zn-success-soft); color: var(--zn-success); }
.st--rev { background: var(--zn-warn-soft); color: var(--zn-warn); }
.st--draft { background: var(--zn-card-2); color: var(--zn-text-3); border: 1px solid var(--zn-line); }

.foot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 2px 0;
  font-size: 11px;
  color: var(--zn-text-3);
}

.foot i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--zn-success);
}
</style>
