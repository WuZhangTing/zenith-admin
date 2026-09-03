<script setup lang="ts">
import ArtIcon from './ArtIcon.vue'
</script>

<template>
  <div class="za im">
    <div class="it it--active">
      <i class="za-avatar za-avatar--sq on" style="--za-av: var(--za-g-indigo)">产</i>
      <div class="it__bd">
        <b>产品评审群</b>
        <span class="za-ellipsis"><em>@你</em> 明早 10 点过一下原型</span>
      </div>
      <div class="it__rt">
        <small>09:52</small>
        <i class="badge">3</i>
      </div>
    </div>
    <div class="it">
      <i class="za-avatar za-avatar--sq on" style="--za-av: var(--za-g-emerald)">李</i>
      <div class="it__bd">
        <b>李明</b>
        <span class="za-ellipsis"><ArtIcon name="call" class="ic" />语音通话 · 02:14</span>
      </div>
      <div class="it__rt"><small>09:41</small></div>
    </div>
    <div class="it">
      <i class="za-avatar za-avatar--sq" style="--za-av: var(--za-g-slate)"><ArtIcon name="bot" /></i>
      <div class="it__bd">
        <b>运维告警</b>
        <span class="za-ellipsis">prod-01 CPU 恢复正常</span>
      </div>
      <div class="it__rt"><small>昨天</small></div>
    </div>
  </div>
</template>

<style scoped>
.im {
  display: grid;
  gap: 3px;
}

.it {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 50px;
  padding: 0 9px;
  border-radius: 10px;
}

.it--active {
  background: var(--zn-card-2);
  box-shadow: inset 0 0 0 1px var(--zn-line);
}

.za-avatar {
  position: relative;
  width: 28px;
  height: 28px;
  font-size: 11.5px;
}

.za-avatar .za-ic {
  --s: 15px;
}

.za-avatar.on::after {
  content: '';
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 8px;
  height: 8px;
  border: 2px solid var(--zn-card);
  border-radius: 50%;
  background: var(--zn-success);
}

.it--active .za-avatar.on::after {
  border-color: var(--zn-card-2);
}

.it__bd {
  flex: 1;
  min-width: 0;
}

.it__bd b {
  display: block;
  font-weight: 600;
  line-height: 1.3;
}

.it__bd span {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  font-size: 11px;
  line-height: 1.3;
  color: var(--zn-text-3);
}

.it__bd em {
  font-style: normal;
  color: var(--vp-c-brand-1);
}

.ic {
  --s: 11px;
}

.it__rt {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.it__rt small {
  font-size: 10.5px;
  line-height: 1;
  color: var(--zn-text-3);
}

.badge {
  display: grid;
  place-items: center;
  min-width: 16px;
  height: 16px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
  line-height: 1;
}
</style>
