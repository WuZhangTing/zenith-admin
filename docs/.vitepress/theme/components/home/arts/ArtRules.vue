<template>
  <div class="rules">
    <div class="hd">风控准入 · 决策表 <em>v3 · 灰度 20%</em></div>
    <table>
      <thead><tr><th>年龄</th><th>信用分</th><th>结果</th></tr></thead>
      <tbody>
        <tr><td>&lt; 18</td><td>—</td><td><span class="r r--no">拒绝</span></td></tr>
        <tr class="hit"><td>≥ 18</td><td>≥ 650</td><td><span class="r r--ok">通过</span></td></tr>
        <tr><td>≥ 18</td><td>&lt; 650</td><td><span class="r r--man">人工审核</span></td></tr>
      </tbody>
    </table>
    <div class="foot"><code>decide()</code> → 通过 · 命中第 2 行 · 3ms</div>
  </div>
</template>

<style scoped>
.rules {
  width: 100%;
  display: grid;
  gap: 7px;
  font-size: 12px;
}

.hd {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-weight: 600;
  color: var(--zn-text-1);
}

.hd em {
  font-size: 10.5px;
  font-style: normal;
  font-weight: 500;
  color: var(--zn-text-3);
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
  padding: 5px 8px;
  text-align: left;
  border-bottom: 1px solid var(--zn-line);
}

th {
  background: var(--zn-card-2);
  color: var(--zn-text-3);
  font-weight: 600;
  font-size: 10.5px;
}

td {
  color: var(--zn-text-2);
}

tr:last-child td {
  border-bottom: 0;
}

.hit td {
  background: var(--zn-brand-soft);
  color: var(--zn-text-1);
  font-weight: 600;
}

.r {
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 600;
}

.r--ok { background: var(--zn-success-soft); color: var(--zn-success); }
.r--no { background: rgba(239, 68, 68, 0.12); color: var(--zn-danger); }
.r--man { background: var(--zn-warn-soft); color: var(--zn-warn); }

.foot {
  font-size: 11px;
  color: var(--zn-text-3);
}

.foot code {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--zn-card-2);
  border: 1px solid var(--zn-line);
  font-family: var(--vp-font-family-mono);
  font-size: 10.5px;
  color: var(--vp-c-brand-1);
}
</style>
