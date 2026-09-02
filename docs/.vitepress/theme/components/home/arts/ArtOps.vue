<template>
  <div class="term">
    <div><span class="p">➜</span> <span class="c">zenith</span> ssh prod-01</div>
    <div class="d">connected · 12ms · 终端录屏中</div>
    <div><span class="p">➜</span> docker ps --format table</div>
    <div><span class="ok">●</span> zenith-server&nbsp;&nbsp;<span class="d">up 12d</span></div>
    <div><span class="ok">●</span> postgres:17&nbsp;&nbsp;&nbsp;&nbsp;<span class="d">up 12d</span></div>
    <div><span class="w">●</span> redis:7&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="d">restarting</span></div>
  </div>
</template>

<style scoped>
.term {
  width: 100%;
  align-self: flex-start;
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
  line-height: 1.8;
  color: var(--zn-dark-text);
  white-space: nowrap;
  overflow: hidden;
}

.p { color: #34d399; }
.c { color: #93c5fd; }
.d { color: var(--zn-dark-text-2); }
.ok { color: #34d399; }
.w { color: #fbbf24; }
</style>
