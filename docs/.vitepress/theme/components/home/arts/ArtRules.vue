<template>
  <div class="za rules">
    <div class="hd">
      <b>风控准入 · 决策表</b>
      <em>v3 · 灰度 20%</em>
    </div>

    <table>
      <thead>
        <tr><th>年龄</th><th>信用分</th><th>结果</th></tr>
      </thead>
      <tbody>
        <tr><td>&lt; 18</td><td>—</td><td><span class="za-tag za-tag--danger">拒绝</span></td></tr>
        <tr class="hit"><td>≥ 18</td><td>≥ 650</td><td><span class="za-tag za-tag--ok">通过</span></td></tr>
        <tr><td>≥ 18</td><td>&lt; 650</td><td><span class="za-tag za-tag--warn">人工审核</span></td></tr>
      </tbody>
    </table>

    <div class="za-foot">
      <code>decide()</code>
      <span class="za-ellipsis">→ 通过 · 命中第 2 行 · 3ms</span>
    </div>
  </div>
</template>

<style scoped>
.rules {
  display: grid;
  gap: 8px;
}

.hd {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.hd b {
  font-weight: 600;
  white-space: nowrap;
}

.hd em {
  font-size: 10.5px;
  font-style: normal;
  color: var(--zn-text-3);
  white-space: nowrap;
}

table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid var(--zn-line);
  border-radius: 9px;
  overflow: hidden;
  font-size: 11.5px;
}

th,
td {
  height: 28px;
  padding: 0 9px;
  text-align: left;
  border-bottom: 1px solid var(--zn-line);
  white-space: nowrap;
}

th {
  height: 26px;
  background: var(--zn-card-2);
  color: var(--zn-text-3);
  font-weight: 600;
  font-size: 10.5px;
}

td {
  color: var(--zn-text-2);
  font-variant-numeric: tabular-nums;
}

td:last-child,
th:last-child {
  text-align: right;
}

tr:last-child td {
  border-bottom: 0;
}

/* 命中行：左侧品牌色指示条 + 浅底 */
.hit td {
  background: var(--zn-brand-soft);
  color: var(--zn-text-1);
  font-weight: 600;
}

.hit td:first-child {
  box-shadow: inset 2px 0 0 var(--vp-c-brand-1);
}

code {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--zn-card-2);
  border: 1px solid var(--zn-line);
  font-family: var(--vp-font-family-mono);
  font-size: 10.5px;
  color: var(--vp-c-brand-1);
}
</style>
