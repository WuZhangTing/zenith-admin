<template>
  <div class="code">
    <div><span class="k">curl</span> https://api.zenith.dev/v1/members \</div>
    <div>&nbsp;&nbsp;-H <span class="s">"X-App-Key: zk_live_8f3…"</span> \</div>
    <div>&nbsp;&nbsp;-H <span class="s">"X-Signature: HMAC-SHA256 …"</span></div>
    <div class="res">200 OK <span class="d">· 42ms · scope: member:read</span></div>
  </div>
</template>

<style scoped>
.code {
  width: 100%;
  align-self: flex-start;
  padding: 11px 13px;
  border: 1px solid var(--zn-line);
  border-radius: 12px;
  background: var(--zn-card-2);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  line-height: 1.7;
  color: var(--zn-text-2);
  white-space: nowrap;
  overflow: hidden;
}

.k { color: #7c3aed; }
.s { color: #0f766e; }
.d { color: var(--zn-text-3); }

.dark .k { color: #c4b5fd; }
.dark .s { color: #5eead4; }

.res {
  margin-top: 7px;
  padding-top: 7px;
  border-top: 1px dashed var(--zn-line);
  color: var(--zn-success);
  font-weight: 600;
}
</style>
