<template>
  <div class="wf">
    <div class="node node--start">
      <div class="node__hd">发起人</div>
      <div class="node__bd">所有人<span class="chip">采购申请单</span></div>
    </div>

    <div class="link"><i class="plus">+</i></div>

    <div class="node node--approve">
      <div class="node__hd">审批人</div>
      <div class="node__bd"><span class="avs"><i></i><i></i></span>部门负责人 · 会签</div>
    </div>

    <div class="link link--branch"><i class="plus">+</i></div>

    <div class="branch">
      <span class="branch__add">添加条件</span>
      <div class="col">
        <div class="cond">
          <div class="cond__hd">条件 1<small>优先级 1</small></div>
          <div class="cond__bd">金额 ≥ 5,000</div>
        </div>
        <div class="gap"></div>
        <div class="node node--approve node--fill">
          <div class="node__hd">审批人</div>
          <div class="node__bd">财务经理 · 或签</div>
        </div>
      </div>
      <div class="col">
        <div class="cond">
          <div class="cond__hd cond__hd--default">默认条件</div>
          <div class="cond__bd">其他情况直接通过</div>
        </div>
      </div>
    </div>

    <div class="link"><i class="plus">+</i></div>

    <div class="node node--cc">
      <div class="node__hd">抄送人</div>
      <div class="node__bd">HR · 财务归档</div>
    </div>

    <div class="link link--short"></div>
    <div class="end"><i></i>流程结束</div>
  </div>
</template>

<style scoped>
.wf {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 11.5px;
  line-height: 1.4;
}

.node {
  position: relative;
  z-index: 1;
  width: 208px;
  max-width: 100%;
  border: 1px solid var(--zn-line);
  border-radius: 8px;
  background: var(--zn-card);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  overflow: hidden;
}

.node--fill {
  width: 100%;
}

.node__hd {
  display: flex;
  align-items: center;
  height: 22px;
  padding: 0 9px;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
}

.node--start .node__hd { background: #64748b; }
.node--approve .node__hd { background: #f59e0b; }
.node--cc .node__hd { background: #0ea5e9; }

.node__bd {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 5px 9px;
  color: var(--zn-text-2);
}

.chip {
  margin-left: auto;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--zn-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}

.avs {
  display: inline-flex;
  margin-right: 2px;
}

.avs i {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1.5px solid var(--zn-card);
  background: #c7d2fe;
}

.avs i + i {
  margin-left: -6px;
  background: #fbcfe8;
}

.link {
  position: relative;
  width: 2px;
  height: 22px;
  background: var(--zn-line-strong);
}

.link--short {
  height: 14px;
}

/* 分支前的连接线加长，让「+」不被「添加条件」胶囊遮住 */
.link--branch {
  height: 36px;
}

.link--branch .plus {
  top: 10px;
}

.plus {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 16px;
  height: 16px;
  transform: translate(-50%, -50%);
  border: 1.5px solid var(--vp-c-brand-1);
  border-radius: 50%;
  background: var(--zn-card);
  color: var(--vp-c-brand-1);
  font-size: 12px;
  font-style: normal;
  font-weight: 700;
  line-height: 12px;
  text-align: center;
}

/* 条件分支：两列，顶部与底部各一条横线把分支合并回主干 */
.branch {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: 100%;
}

.branch::before,
.branch::after {
  content: '';
  position: absolute;
  left: 25%;
  right: 25%;
  height: 2px;
  background: var(--zn-line-strong);
}

.branch::before { top: 0; }
.branch::after { bottom: 0; }

.branch__add {
  position: absolute;
  top: 0;
  left: 50%;
  z-index: 2;
  transform: translate(-50%, -50%);
  padding: 2px 9px;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 999px;
  background: var(--zn-card);
  color: var(--vp-c-brand-1);
  font-size: 10.5px;
  font-weight: 600;
  white-space: nowrap;
}

.col {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 5px 12px;
}

.col::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  margin-left: -1px;
  background: var(--zn-line-strong);
}

.cond {
  position: relative;
  z-index: 1;
  width: 100%;
  padding: 6px 9px;
  border: 1px solid var(--zn-line);
  border-radius: 8px;
  background: var(--zn-card);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.cond__hd {
  display: flex;
  justify-content: space-between;
  color: var(--zn-success);
  font-weight: 600;
}

.cond__hd--default {
  color: var(--zn-text-3);
}

.cond__hd small {
  font-size: 10px;
  font-weight: 500;
  color: var(--zn-text-3);
}

.cond__bd {
  margin-top: 2px;
  color: var(--zn-text-2);
}

.gap {
  height: 12px;
}

.end {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  color: var(--zn-text-3);
  font-size: 11px;
}

.end i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--zn-line-strong);
}
</style>
