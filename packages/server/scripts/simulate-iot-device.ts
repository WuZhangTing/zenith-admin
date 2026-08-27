/**
 * IoT 模拟设备：跑通「WS 接入 → 遥测上报 → 指令即时接收 → 回执」全链路。
 *
 * 用法（默认连演示设备 1 号）：
 *   npx tsx scripts/simulate-iot-device.ts
 *   npx tsx scripts/simulate-iot-device.ts --sn SN-XXX --secret yyy --server http://localhost:3300
 *
 * 行为：WS 在线 + 每 15s 上报一次温湿度；收到 command:exec 帧 2s 后回 ACK 成功。
 * Ctrl+C 断开（管理端在线态随之变为离线）。
 */
import { createHmac } from 'node:crypto';

function arg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

const SERVER = arg('server', 'http://localhost:3300');
const SN = arg('sn', 'SN-DEMO-TH100-0001');
const SECRET = arg('secret', 'demo0001secret0001demo0001secret0001demo0001sec1');

function sign(ts: string, body: string): string {
  return createHmac('sha256', SECRET).update(`${SN}\n${ts}\n${body}`).digest('hex');
}

function buildMetrics() {
  const hour = new Date().getHours() + new Date().getMinutes() / 60;
  const phase = Math.sin(((hour - 14) / 24) * Math.PI * 2);
  return {
    temperature: Math.round((24 + phase * 3 + (Math.random() - 0.5)) * 10) / 10,
    humidity: Math.round(50 - phase * 8 + (Math.random() - 0.5) * 4),
  };
}

const ts = String(Math.floor(Date.now() / 1000));
const wsUrl = `${SERVER.replace(/^http/, 'ws')}/api/iot/ws?sn=${encodeURIComponent(SN)}&ts=${ts}&sign=${sign(ts, '')}`;

console.log(`[sim] 连接 ${wsUrl.slice(0, 60)}...`);
const ws = new WebSocket(wsUrl);

ws.onopen = () => {
  console.log(`[sim] ✅ 已连接，设备 ${SN} 在线`);
  const report = () => {
    const metrics = buildMetrics();
    ws.send(JSON.stringify({ type: 'telemetry', payload: { items: [{ metrics }], firmwareVersion: '1.2.0' } }));
    console.log(`[sim] 📤 上报遥测`, metrics);
  };
  report();
  setInterval(report, 15_000);
  setInterval(() => ws.send(JSON.stringify({ type: 'heartbeat' })), 30_000);
};

ws.onmessage = (evt) => {
  const frame = JSON.parse(String(evt.data)) as { type: string; payload?: { commandId: number; service: string; params: unknown } };
  if (frame.type === 'command:exec' && frame.payload) {
    const { commandId, service, params } = frame.payload;
    console.log(`[sim] 📥 收到指令 #${commandId} ${service}`, params ?? '');
    setTimeout(() => {
      ws.send(JSON.stringify({
        type: 'command:ack',
        payload: { commandId, success: true, response: { executed: service, at: new Date().toISOString() } },
      }));
      console.log(`[sim] ✅ 已回执 #${commandId}`);
    }, 2_000);
  } else if (frame.type === 'heartbeat:ack') {
    console.log('[sim] 💓 心跳确认');
  }
};

ws.onclose = (evt) => {
  console.log(`[sim] 连接关闭 code=${evt.code} reason=${evt.reason}`);
  process.exit(0);
};

ws.onerror = () => console.error('[sim] 连接错误');
