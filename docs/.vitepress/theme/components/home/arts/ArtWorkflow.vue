<script setup lang="ts">
import ArtIcon from './ArtIcon.vue'
</script>

<template>
  <div class="za wf">
    <div class="wf__flow">
      <div class="node node--start">
        <div class="node__hd">发起人</div>
        <div class="node__bd">所有人<span class="za-tag za-tag--brand">采购申请单</span></div>
      </div>

      <div class="link"><i class="plus"><ArtIcon name="plus" /></i></div>

      <div class="node node--approve">
        <div class="node__hd">审批人</div>
        <div class="node__bd"><span class="avs"><i></i><i></i></span>部门负责人 · 会签</div>
      </div>

      <div class="link link--branch"><i class="plus"><ArtIcon name="plus" /></i></div>

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
            <div class="cond__bd">其他情况通过</div>
          </div>
        </div>
      </div>

      <div class="link"><i class="plus"><ArtIcon name="plus" /></i></div>

      <div class="node node--cc">
        <div class="node__hd">抄送人</div>
        <div class="node__bd">HR · 财务归档</div>
      </div>

      <div class="link link--short"></div>
      <div class="end"><i></i>流程结束</div>
    </div>
  </div>
</template>

<style scoped>
/* 设计器画布：点阵背景铺满整个插画区，流程居中 */
.wf {
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px 12px;
  border: 1px solid var(--zn-line);
  border-radius: 12px;
  background-color: var(--zn-card-2);
  background-image: radial-gradient(circle, var(--zn-line-strong) 0.9px, transparent 1.1px);
  background-size: 14px 14px;
  background-position: 7px 7px;
  font-size: 11.5px;
  line-height: 1.4;
}

.wf__flow {
  width: 100%;
  max-width: 296px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.node {
  position: relative;
  z-index: 1;
  width: 200px;
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
  letter-spacing: 0.2px;
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

.node__bd .za-tag {
  margin-left: auto;
  height: 17px;
  font-size: 10px;
}

.avs {
  display: inline-flex;
  margin-right: 1px;
}

.avs i {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1.5px solid var(--zn-card);
  background: var(--za-g-indigo);
}

.avs i + i {
  margin-left: -6px;
  background: var(--za-g-rose);
}

.link {
  position: relative;
  width: 2px;
  height: 24px;
  background: var(--zn-line-strong);
}

.link--short {
  height: 14px;
}

/* 分支前的连接线加长，让「+」与「添加条件」胶囊各占其位 */
.link--branch {
  height: 40px;
}

.link--branch .plus {
  top: 11px;
}

.plus {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  transform: translate(-50%, -50%);
  border: 1.5px solid var(--vp-c-brand-1);
  border-radius: 50%;
  background: var(--zn-card);
  color: var(--vp-c-brand-1);
}

.plus .za-ic {
  --s: 9px;
  stroke-width: 2.6;
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
  display: inline-flex;
  align-items: center;
  height: 20px;
  transform: translate(-50%, -50%);
  padding: 0 9px;
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
  padding: 18px 6px 14px;
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
  gap: 6px;
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
  white-space: nowrap;
}

.cond__bd {
  margin-top: 2px;
  color: var(--zn-text-2);
}

.gap {
  height: 14px;
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
