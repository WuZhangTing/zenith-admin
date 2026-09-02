<template>
  <div class="chat">
    <div class="msg msg--me">帮我汇总本周待办</div>
    <div class="msg msg--ai">
      本周共 36 条待办，其中 12 条超期，建议优先处理采购审批<span class="cur"></span>
    </div>
    <div class="meta">
      <span>gpt-4.1 · RAG 命中 3 条</span><span>1.2s</span>
    </div>
  </div>
</template>

<style scoped>
.chat {
  width: 100%;
  display: grid;
  gap: 8px;
  font-size: 12px;
  line-height: 1.55;
}

.msg {
  max-width: 88%;
  padding: 7px 10px;
  border: 1px solid var(--zn-line);
  border-radius: 12px;
  background: var(--zn-card);
  color: var(--zn-text-1);
}

.msg--me {
  margin-left: auto;
  border-color: var(--vp-c-brand-1);
  border-bottom-right-radius: 4px;
  background: var(--vp-c-brand-1);
  color: #fff;
}

.msg--ai {
  border-bottom-left-radius: 4px;
  background: var(--zn-card-2);
}

.cur {
  display: inline-block;
  width: 6px;
  height: 12px;
  margin-left: 2px;
  vertical-align: -2px;
  background: var(--vp-c-brand-1);
  animation: blink 1s steps(2) infinite;
}

.meta {
  display: flex;
  justify-content: space-between;
  padding: 0 2px;
  font-family: var(--vp-font-family-mono);
  font-size: 10.5px;
  color: var(--zn-text-3);
}

@keyframes blink {
  to { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .cur { animation: none; }
}
</style>
