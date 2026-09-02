<script setup lang="ts">
import HomeHero from './HomeHero.vue'
import HomeBento from './HomeBento.vue'
import HomeStats from './HomeStats.vue'
import HomeQuickStart from './HomeQuickStart.vue'
import HomeStack from './HomeStack.vue'
import HomeCta from './HomeCta.vue'
</script>

<template>
  <div class="zn-home">
    <HomeHero />
    <HomeBento />
    <HomeStats />
    <HomeQuickStart />
    <HomeStack />
    <HomeCta />
  </div>
</template>

<style>
/* 首页共享样式（非 scoped，供各 section 复用） */
.zn-home {
  font-family: var(--vp-font-family-base);
  -webkit-font-smoothing: antialiased;
}

.zn-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 20px;
  border: 1px solid transparent;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.18s, border-color 0.18s, color 0.18s;
}

.zn-btn--primary {
  background: var(--zn-text-1);
  color: var(--zn-card);
}

.zn-btn--primary:hover {
  background: var(--vp-c-brand-1);
  color: #fff;
}

.zn-btn--ghost {
  border-color: var(--zn-line-strong);
  background: var(--zn-card);
  color: var(--zn-text-1);
}

.zn-btn--ghost:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.zn-section-head {
  max-width: 640px;
}

.zn-eyebrow {
  display: block;
  margin-bottom: 10px;
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: var(--vp-c-brand-1);
}

.zn-h2 {
  margin: 0;
  font-size: 32px;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.8px;
  color: var(--zn-text-1);
}

.zn-sub {
  margin: 12px 0 0;
  font-size: 15.5px;
  line-height: 1.7;
  color: var(--zn-text-2);
}

.zn-sub code {
  padding: 1px 6px;
  border-radius: 5px;
  background: var(--zn-brand-soft);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  color: var(--vp-c-brand-1);
}

@media (max-width: 640px) {
  .zn-h2 {
    font-size: 26px;
    letter-spacing: -0.5px;
  }

  .zn-sub {
    font-size: 14.5px;
  }
}
</style>
