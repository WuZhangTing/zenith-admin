<script setup lang="ts">
import ArtIcon from './ArtIcon.vue'
</script>

<template>
  <div class="za ai">
    <div class="msg msg--me">帮我汇总本周待办</div>

    <div class="turn">
      <i class="bot"><ArtIcon name="sparkles" /></i>
      <div class="turn__bd">
        <div class="tool">
          <ArtIcon name="search" />
          <span>检索知识库</span>
          <em>命中 3 条</em>
          <ArtIcon name="check" class="tool__ok" />
        </div>
        <div class="msg msg--ai">
          本周共 36 条待办，其中 12 条超期，建议优先处理采购审批<i class="cur za-blink"></i>
        </div>
      </div>
    </div>

    <div class="meta za-mono">
      <span>gpt-4.1</span><i></i><span>RAG</span><i></i><span>tools ×1</span>
      <span class="ms">1.2s</span>
    </div>
  </div>
</template>

<style scoped>
.ai {
  display: grid;
  gap: 8px;
  line-height: 1.55;
}

.msg {
  max-width: 88%;
  padding: 7px 10px;
  border: 1px solid var(--zn-line);
  border-radius: 12px;
  background: var(--zn-card);
}

.msg--me {
  justify-self: end;
  margin-right: 2px;
  border-color: var(--vp-c-brand-1);
  border-bottom-right-radius: 4px;
  background: var(--vp-c-brand-1);
  color: #fff;
}

.turn {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.bot {
  flex: none;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  margin-top: 1px;
  border-radius: 8px;
  background: var(--za-g-indigo);
  color: #fff;
}

.bot .za-ic {
  --s: 13px;
}

.turn__bd {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.tool {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  justify-self: start;
  height: 22px;
  padding: 0 8px 0 7px;
  border: 1px dashed var(--zn-line-strong);
  border-radius: 999px;
  color: var(--zn-text-2);
  font-size: 10.5px;
  font-weight: 500;
}

.tool .za-ic {
  --s: 11px;
  color: var(--zn-text-3);
}

.tool em {
  font-style: normal;
  color: var(--zn-text-3);
}

.tool .tool__ok {
  color: var(--zn-success);
  stroke-width: 2.5;
}

.msg--ai {
  max-width: none;
  border-top-left-radius: 4px;
  background: var(--zn-card-2);
}

.cur {
  display: inline-block;
  width: 2px;
  height: 12px;
  margin-left: 2px;
  vertical-align: -2px;
  border-radius: 1px;
  background: var(--vp-c-brand-1);
}

.meta {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 2px;
  color: var(--zn-text-3);
}

.meta i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--zn-line-strong);
}

.ms {
  margin-left: auto;
}
</style>
