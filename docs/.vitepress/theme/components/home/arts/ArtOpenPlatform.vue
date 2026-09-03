<script setup lang="ts">
import ArtIcon from './ArtIcon.vue'
</script>

<template>
  <div class="za op">
    <div class="req za-panel za-panel--soft">
      <div class="hd">
        <b class="m">GET</b>
        <span class="url za-mono za-ellipsis">/v1/members?page=1</span>
        <em class="sig"><ArtIcon name="shield" />HMAC</em>
      </div>
      <div class="kv za-mono">
        <span>Authorization</span><span class="za-ellipsis">Bearer eyJhbGciOi…</span>
        <span>X-App-Key</span><span class="za-ellipsis">zk_live_8f3a…</span>
        <span>X-Timestamp</span><span class="za-ellipsis">1756868400</span>
        <span>X-Signature</span><span class="za-ellipsis">sha256=9c1e…</span>
      </div>
      <div class="res za-mono">
        <b>200 OK</b>
        <span>42ms</span>
        <i></i>
        <span class="za-ellipsis">member:read</span>
        <span class="rl">987<small>/1000</small></span>
      </div>
    </div>

    <div class="hook">
      <ArtIcon name="webhook" />
      <span class="za-ellipsis">Webhook <b>order.paid</b></span>
      <em class="za-tag za-tag--ok">已投递 · 200</em>
    </div>
  </div>
</template>

<style scoped>
.op {
  display: grid;
  gap: 8px;
}

.req {
  overflow: hidden;
}

.hd {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 10px;
  border-bottom: 1px solid var(--zn-line);
  background: var(--zn-card);
}

.m {
  flex: none;
  padding: 1px 6px;
  border-radius: 5px;
  background: var(--zn-success-soft);
  color: var(--zn-success);
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.url {
  flex: 1;
  font-size: 11px;
  color: var(--zn-text-1);
}

.sig {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--vp-c-brand-1);
  font-size: 10.5px;
  font-style: normal;
  font-weight: 600;
}

.sig .za-ic {
  --s: 12px;
}

.kv {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  column-gap: 12px;
  row-gap: 3px;
  padding: 8px 10px;
  color: var(--zn-text-3);
}

.kv span:nth-child(even) {
  color: var(--zn-text-2);
}

.res {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-top: 1px dashed var(--zn-line-strong);
  color: var(--zn-text-3);
}

.res b {
  color: var(--zn-success);
  font-weight: 700;
}

.res i {
  width: 1px;
  height: 10px;
  background: var(--zn-line-strong);
}

.rl {
  margin-left: auto;
  color: var(--zn-text-2);
  font-weight: 600;
}

.rl small {
  font-size: inherit;
  font-weight: 400;
  color: var(--zn-text-3);
}

.hook {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 2px;
  font-size: 11px;
  color: var(--zn-text-3);
}

.hook .za-ic {
  --s: 13px;
  color: var(--vp-c-brand-1);
}

.hook span {
  flex: 1;
}

.hook b {
  font-family: var(--vp-font-family-mono);
  font-size: 10.5px;
  font-weight: 600;
  color: var(--zn-text-2);
}
</style>
