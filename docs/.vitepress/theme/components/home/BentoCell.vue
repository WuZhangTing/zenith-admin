<script setup lang="ts">
import { withBase } from 'vitepress'

const props = withDefaults(
  defineProps<{
    title: string
    tag: string
    desc: string
    link: string
    cols?: number
    rows?: number
    dark?: boolean
    external?: boolean
  }>(),
  { cols: 3, rows: 1, dark: false, external: false },
)

const href = props.external ? props.link : withBase(props.link)
</script>

<template>
  <article
    class="cell"
    :class="{ 'cell--dark': dark }"
    :style="{ '--c': cols, '--r': rows }"
  >
    <header class="cell__hd">
      <h3><a :href="href" :target="external ? '_blank' : undefined" :rel="external ? 'noreferrer' : undefined">{{ title }}</a></h3>
      <small>{{ tag }}</small>
      <span class="cell__arrow" aria-hidden="true">→</span>
    </header>
    <div class="cell__art" aria-hidden="true">
      <slot />
    </div>
    <p class="cell__desc">{{ desc }}</p>
  </article>
</template>

<style scoped>
.cell {
  position: relative;
  grid-column: span var(--c);
  grid-row: span var(--r);
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--zn-line);
  border-radius: 18px;
  background: var(--zn-card);
  color: var(--zn-text-1);
  overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
}

.cell:hover {
  border-color: var(--zn-line-strong);
  box-shadow: var(--zn-shadow);
  transform: translateY(-2px);
}

.cell__hd {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cell__hd h3 {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.2px;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell__hd h3 a {
  color: inherit;
  text-decoration: none;
}

/* 让整张卡片可点击 */
.cell__hd h3 a::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 3;
}

.cell__hd small {
  flex: none;
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  letter-spacing: 0.2px;
  color: var(--zn-text-3);
  white-space: nowrap;
}

.cell__arrow {
  flex: none;
  font-size: 13px;
  color: var(--vp-c-brand-1);
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 0.2s, transform 0.2s;
}

.cell:hover .cell__arrow {
  opacity: 1;
  transform: none;
}

.cell__art {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cell__desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--zn-text-2);
}

.cell--dark {
  background: var(--zn-dark);
  border-color: var(--zn-dark);
  color: var(--zn-dark-text);
}

.cell--dark:hover {
  border-color: var(--zn-dark-2);
}

.dark .cell--dark,
.dark .cell--dark:hover {
  border-color: var(--zn-line-strong);
}

.cell--dark .cell__hd small {
  color: var(--zn-dark-text-2);
}

.cell--dark .cell__desc {
  color: var(--zn-dark-text-2);
}

@media (max-width: 1080px) {
  .cell {
    grid-column: span 6;
  }
}

@media (max-width: 640px) {
  .cell {
    grid-column: span 12;
    grid-row: span 1;
  }
}
</style>
