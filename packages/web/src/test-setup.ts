import '@testing-library/jest-dom/vitest';

// Mock Canvas for Semi-UI lottie
const getContextMock = () => {
  return {
    fillStyle: '',
    fillRect: Object,
    clearRect: Object,
    getImageData: Object,
    putImageData: Object,
    createImageData: Object,
    setTransform: Object,
    drawImage: Object,
    save: Object,
    fillText: Object,
    restore: Object,
    beginPath: Object,
    moveTo: Object,
    lineTo: Object,
    closePath: Object,
    stroke: Object,
    translate: Object,
    scale: Object,
    rotate: Object,
    arc: Object,
    fill: Object,
    measureText: () => ({ width: 0 }),
    transform: Object,
    rect: Object,
    clip: Object,
  } as unknown as CanvasRenderingContext2D;
};

HTMLCanvasElement.prototype.getContext = getContextMock as unknown as typeof HTMLCanvasElement.prototype.getContext;

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock ResizeObserver
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver;

// jsdom 未实现 Web Worker，Semi JsonViewer 的语言服务（校验 / 格式化）会在挂载时构造 Worker，
// 缺失会直接抛 ReferenceError 导致整个用例挂掉。语言服务不参与文本渲染，故空实现即可。
class WorkerStub implements Partial<Worker> {
  onmessage = null;
  onmessageerror = null;
  onerror = null;
  postMessage() {}
  terminate() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return false; }
}
window.Worker = WorkerStub as unknown as typeof Worker;
if (!URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:stub';
  URL.revokeObjectURL = () => {};
}

// jsdom 未实现 Range.getBoundingClientRect/getClientRects，Semi Typography 的 ellipsis 测量逻辑依赖它们
// （异步 rAF/microtask 中调用，测试卸载后仍可能触发，未 polyfill 会产生 unhandled rejection 噪音）。
Range.prototype.getBoundingClientRect = () => ({
  x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0, toJSON: () => ({}),
});
Range.prototype.getClientRects = () => ({
  length: 0,
  item: () => null,
  [Symbol.iterator]: function* () {},
}) as unknown as DOMRectList;
