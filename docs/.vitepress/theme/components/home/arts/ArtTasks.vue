<template>
  <div class="tasks">
    <div class="t">
      <div class="t__hd"><b>导出会员名单</b><span>78%</span></div>
      <div class="bar"><i style="width: 78%"></i></div>
    </div>
    <div class="t">
      <div class="t__hd"><b>批量导入用户 · 1,204 行</b><span class="ok">已完成</span></div>
      <div class="bar"><i class="done" style="width: 100%"></i></div>
    </div>
    <div class="t">
      <div class="t__hd"><b>数据库全量备份</b><span class="q">排队中</span></div>
      <div class="bar"><i style="width: 0"></i></div>
    </div>
    <div class="foot">pg-boss · 12 队列 · 失败自动重试 3 次</div>
  </div>
</template>

<style scoped>
.tasks {
  width: 100%;
  display: grid;
  gap: 9px;
  font-size: 12px;
}

.t__hd {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.t__hd b {
  font-weight: 500;
  color: var(--zn-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.t__hd span {
  flex: none;
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  color: var(--zn-text-2);
}

.t__hd .ok { color: var(--zn-success); }
.t__hd .q { color: var(--zn-text-3); }

.bar {
  height: 6px;
  border-radius: 999px;
  background: var(--zn-line);
  overflow: hidden;
}

.bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--vp-c-brand-1);
}

.bar i.done {
  background: var(--zn-success);
}

.foot {
  font-size: 11px;
  color: var(--zn-text-3);
}
</style>
