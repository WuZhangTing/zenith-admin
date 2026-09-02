<template>
  <div class="sec">
    <div class="chk"><i></i>JWT 双 Token</div>
    <div class="chk"><i></i>企业 SSO</div>
    <div class="chk"><i></i>IP 访问控制</div>
    <div class="chk"><i></i>数据脱敏</div>
    <div class="chk"><i></i>幂等防重</div>
    <div class="chk"><i></i>接口限流</div>
  </div>
</template>

<style scoped>
.sec {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.chk {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 9px;
  border: 1px solid var(--zn-line);
  border-radius: 9px;
  font-size: 12px;
  font-weight: 500;
  color: var(--zn-text-1);
  white-space: nowrap;
}

.chk i {
  position: relative;
  flex: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--zn-success-soft);
}

.chk i::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 3px;
  width: 4px;
  height: 7px;
  border: solid var(--zn-success);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
</style>
