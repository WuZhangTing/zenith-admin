<template>
  <div class="st">
    <div class="backs">
      <span class="on">本地</span><span class="on">阿里云 OSS</span><span>腾讯云 COS</span><span>S3</span><span>Azure</span><span>SFTP</span><span>+3</span>
    </div>
    <div class="file">
      <i class="ic">XLS</i>
      <div><b>季度经营报表.xlsx</b><span>2.4 MB · Magic Bytes 校验通过</span></div>
      <em>✓</em>
    </div>
    <div class="up">
      <div class="up__hd"><span>上传 合同扫描件.pdf</span><span>68%</span></div>
      <div class="bar"><i style="width: 68%"></i></div>
    </div>
  </div>
</template>

<style scoped>
.st {
  width: 100%;
  display: grid;
  gap: 8px;
  font-size: 12px;
}

.backs {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.backs span {
  padding: 2px 7px;
  border: 1px solid var(--zn-line);
  border-radius: 6px;
  color: var(--zn-text-3);
  font-size: 10.5px;
  font-weight: 500;
}

.backs span.on {
  border-color: transparent;
  background: var(--zn-brand-soft);
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.file {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  border: 1px solid var(--zn-line);
  border-radius: 10px;
}

.file > div {
  min-width: 0;
}

.ic {
  flex: none;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 7px;
  background: var(--zn-success-soft);
  color: var(--zn-success);
  font-family: var(--vp-font-family-mono);
  font-size: 9px;
  font-style: normal;
  font-weight: 700;
}

.file b {
  display: block;
  font-weight: 600;
  color: var(--zn-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file span {
  display: block;
  font-size: 10.5px;
  color: var(--zn-text-3);
}

.file em {
  margin-left: auto;
  color: var(--zn-success);
  font-style: normal;
  font-weight: 700;
}

.up__hd {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 11px;
  color: var(--zn-text-2);
}

.bar {
  height: 6px;
  border-radius: 999px;
  background: var(--zn-line);
  overflow: hidden;
}

.bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--vp-c-brand-1);
}
</style>
