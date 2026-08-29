<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter, withBase } from 'vitepress'
import { gsap } from 'gsap'

const baseItems = [
  '用户 / 角色 / 菜单权限',
  '按钮级鉴权',
  '部门与岗位管理',
  '用户组',
  '字典与字典项',
  '地区管理（省 / 市 / 区）',
  '标签管理',
  '意见反馈',
  '公告通知',
  '通知中心收件箱',
  '站内信管理 / 模板',
  '消息频道（运营号）',
  '客服工作台与绩效统计',
  '消息中心（单聊 / 群聊）',
  '群管理与成员维护',
  '消息回复 / 转发 / 撤回 / 编辑',
  '投票 / @提及 / 表情回应',
  '语音消息与 WebRTC 音视频通话',
  '会话置顶与收藏',
  '消息搜索与上下文定位',
  'WebSocket 实时收发',
  '快捷聊天浮动按钮',
  'Webhook 聊天机器人',
  '登录日志',
  '操作日志（含变更 Diff）',
  '在线会话管理',
  'Redis 会话持久化',
  '强制下线黑名单',
  'JWT 双 Token 鉴权',
  '多账号切换（停靠免密秒切）',
  '身份安全策略与风险事件',
  '企业身份源（OIDC / SAML / LDAP / AD）',
  'IP 访问控制（白 / 黑名单）',
  '系统配置中心',
  '定时任务（pg-boss）',
  '系统调度面板',
  '任务中心（异步任务）',
  '导出中心',
  '接口限流防护（可视化配置）',
  '幂等防重复提交',
  '数据脱敏配置',
  '数据库备份',
  '数据库管理（SQL / ER 图 / 查询收藏）',
  '文件管理',
  '存储后端切换（9 种：本地 / OSS / S3 / COS 等）',
  'OAuth 登录配置（GitHub / 钉钉 / 企微）',
  'API Token',
  '邮件配置 / 模板 / 发送日志',
  '短信配置 / 模板 / 发送日志',
  '流程定义与版本管理',
  '可视化流程设计器',
  '表单库与远程数据源',
  '发起工作台',
  '我的申请 / 待我审批 / 我已办',
  '审批代理与定时发起',
  '流程监控与健康巡检',
  '流程自动化与连接器',
  '事件总线与 Webhook 订阅',
  '移动审批轻页',
  '决策表（命中策略 / 影子运行）',
  '决策表灰度发布 / 批量仿真',
  '决策流编排',
  '评分卡引擎',
  '黑白灰名单库',
  '决策执行记录',
  'decide() 统一求值门面',
  'OpenAPI 文档',
  '仪表盘统计',
  '服务监控（SSE 实时推送）',
  '监控告警（19 项指标）',
  '缓存管理',
  '维护模式',
  '日志文件查看',
  '可选多租户隔离',
  '租户套餐与视角切换',
  '主题切换（亮 / 暗 / 跟随系统）',
  '页面水印',
  'AI 智能对话（SSE 流式）',
  '知识库 RAG（向量检索）',
  '自定义智能体',
  'AI 工具（函数调用）',
  '模型评测与竞技场',
  'AI 服务商管理',
  '提示词模板',
  'AI 用量统计与对话审计',
  'Web 终端（多分屏 SSH）',
  '终端录屏与回放',
  'SSH 配置与 SFTP',
  '服务器文件管理器',
  '进程管理与端口监听',
  'Docker 容器管理',
  '网络诊断（ping / traceroute / DNS）',
  'systemd 服务管理',
  '防火墙 / Nginx / SSL 证书',
  '日志查看器（实时流式）',
  '行为分析（PV / UV / 埋点指标）',
  '前端错误监控',
  '报表数据源与数据集',
  '仪表盘设计器（23 种组件）',
  '自由画布数据大屏',
  '类 Excel 打印报表（套打）',
  '智能问数（NL2SQL / ChatBI）',
  '指标中心与数据质量',
  '数据填报与数据预警',
  '报表分享 / 订阅 / 嵌入',
  '支付渠道配置（微信支付 / 支付宝）',
  '支付订单生命周期管理',
  '退款 / 回调日志 / 支付事件',
  '对账中心与资金台账',
  '费率 / 结算 / 分账 / 转账',
  '预授权 / 签约代扣 / 支付链接',
  '支付风控与交易投诉',
  '会员看板与会员管理',
  '会员等级与积分账户',
  '钱包余额与充值记录',
  '优惠券模板与发券记录',
  '会员签到与里程碑',
  '前台 C 端（多方式登录 / 会员自助）',
  '公众号多账号管理',
  '粉丝 / 标签 / 自动回复',
  '公众号多客服与群发',
  'CMS 多站点与栏目',
  '内容模型与富文本编辑',
  '可视化页面搭建',
  '静态化发布与全文检索',
  'SEO / 评论 / 广告 / 问卷',
  '敏感词库与采集中心',
  '知识中心（Wiki 空间与文档树）',
  '文档版本历史与发布审批',
  '知识治理、统计与回收站',
  '开放平台应用（OAuth 2.1 / PKCE）',
  'HMAC 签名网关',
  'API Scope 与限流套餐',
  'Webhook 订阅与 API 调试台',
  '应用版本管理与在线升级',
  'PWA 支持',
  'Electron 桌面客户端',
  '统一响应结构',
]

// 每车道滚动速度（px/s）。速度与条目数解耦：
// 之前固定时长（秒）时，移动端合并为单车道后滚动距离翻倍，速度也随之翻倍
const laneSpeeds = [100, 86, 93]
const laneOffsets = [0, 14, 28]
const ITEM_STEP = 46

const laneCount = ref(3)

const laneItems = computed(() => {
  const lanes = Array.from({ length: laneCount.value }, () => [] as string[])
  for (let i = 0; i < baseItems.length; i += 1) {
    lanes[i % laneCount.value].push(baseItems[i])
  }
  return lanes
})

const loopLaneItems = computed(() => laneItems.value.map((lane) => [...lane, ...lane]))
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${laneCount.value}, minmax(0, 1fr))`,
}))

const viewportRef = ref<HTMLElement | null>(null)
const laneRefs = ref<HTMLElement[]>([])
const lineRefs = ref<HTMLElement[][]>([])

interface LaneRuntime {
  laneIndex: number
  lines: HTMLElement[]
  setters: ((props: { y: number; scale: number; opacity: number }) => void)[]
  baseYs: number[]
  visible: boolean[]
  proxy: { shift: number }
  laneHeight: number
  itemHeight: number
  singleLength: number
  totalLength: number
}

let ctx: gsap.Context | null = null
let tweens: gsap.core.Tween[] = []
let laneRuntimes: LaneRuntime[] = []
let resizeObserver: ResizeObserver | null = null
let intersectionObserver: IntersectionObserver | null = null
let reducedMotionQuery: MediaQueryList | null = null
let inView = true
const hoverPausedLanes = new Set<number>()

const setLaneRef = (el: Element | null, laneIndex: number) => {
  if (!el) return
  laneRefs.value[laneIndex] = el as HTMLElement
}

const setLineRef = (el: Element | null, laneIndex: number, lineIndex: number) => {
  if (!el) return
  if (!lineRefs.value[laneIndex]) {
    lineRefs.value[laneIndex] = []
  }
  lineRefs.value[laneIndex][lineIndex] = el as HTMLElement
}

// 纯数学推导每行位置与视觉状态，避免每帧 getBoundingClientRect 强制布局；
// 视口外的行只在进出边界时写一次样式，滚动中逐帧更新的仅是可见的少数行
const renderLane = (runtime: LaneRuntime, force = false) => {
  const { lines, setters, baseYs, visible, proxy, laneHeight, itemHeight, singleLength, totalLength } = runtime
  const centerY = laneHeight / 2
  for (let i = 0; i < lines.length; i += 1) {
    const y = ((baseYs[i] + proxy.shift + totalLength) % totalLength) - singleLength
    const inBand = y > -itemHeight && y < laneHeight
    if (inBand) {
      const ratio = Math.min(Math.abs(y + itemHeight / 2 - centerY) / centerY, 1)
      setters[i]({ y, scale: 1.15 - ratio * 0.43, opacity: 0.98 - ratio * 0.52 })
      visible[i] = true
    } else if (force || visible[i]) {
      setters[i]({ y, scale: 0.72, opacity: 0 })
      visible[i] = false
    }
  }
}

const remeasureLanes = () => {
  for (const runtime of laneRuntimes) {
    if (!runtime) continue
    const lane = laneRefs.value[runtime.laneIndex]
    if (!lane) continue
    runtime.laneHeight = lane.clientHeight
    runtime.itemHeight = runtime.lines[0]?.offsetHeight || runtime.itemHeight
    renderLane(runtime, true)
  }
}

const applyPlayState = () => {
  tweens.forEach((tween, laneIndex) => {
    if (!tween) return
    if (inView && !hoverPausedLanes.has(laneIndex)) {
      tween.resume()
    } else {
      tween.pause()
    }
  })
}

const resolveLaneCount = (width: number) => {
  const minLaneWidth = 260
  const laneGap = 10
  const next = Math.floor((width + laneGap) / (minLaneWidth + laneGap))
  return Math.max(1, Math.min(3, next))
}

const updateLaneCountByWidth = (width: number) => {
  const next = resolveLaneCount(width)
  if (next === laneCount.value) {
    remeasureLanes()
    return
  }

  laneCount.value = next
}

const pauseLane = (laneIndex: number) => {
  hoverPausedLanes.add(laneIndex)
  applyPlayState()
}

const resumeLane = (laneIndex: number) => {
  hoverPausedLanes.delete(laneIndex)
  applyPlayState()
}

const router = useRouter()

const goToFeaturesPage = () => {
  router.go(withBase('/product/features'))
}

const initAnimation = () => {
  const viewport = viewportRef.value
  if (!viewport) return

  ctx?.revert()
  tweens.forEach((tween) => tween.kill())
  tweens = []
  laneRuntimes = []

  ctx = gsap.context(() => {
    lineRefs.value = Array.from({ length: laneCount.value }, (_unused, laneIndex) => lineRefs.value[laneIndex] ?? [])

    for (let laneIndex = 0; laneIndex < laneCount.value; laneIndex += 1) {
      const lane = laneRefs.value[laneIndex]
      const lines = lineRefs.value[laneIndex]
      const sourceLength = laneItems.value[laneIndex]?.length ?? 0
      if (!lane || !lines || lines.length === 0 || sourceLength === 0) continue

      const singleLength = ITEM_STEP * sourceLength
      const offset = laneOffsets[laneIndex % laneOffsets.length]

      const runtime: LaneRuntime = {
        laneIndex,
        lines,
        setters: lines.map((el) => {
          const style = el.style
          return ({ y, scale, opacity }) => {
            style.transform = `translate3d(0, ${y}px, 0) scale(${scale})`
            style.opacity = String(opacity)
          }
        }),
        baseYs: lines.map((_el, lineIndex) => lineIndex * ITEM_STEP + offset),
        visible: lines.map(() => false),
        proxy: { shift: 0 },
        laneHeight: lane.clientHeight,
        itemHeight: lines[0]?.offsetHeight || 20,
        singleLength,
        totalLength: singleLength * 2,
      }

      laneRuntimes[laneIndex] = runtime
      renderLane(runtime, true)

      const speed = laneSpeeds[laneIndex % laneSpeeds.length]
      tweens[laneIndex] = gsap.to(runtime.proxy, {
        shift: singleLength,
        duration: singleLength / speed,
        ease: 'none',
        repeat: -1,
        paused: true,
        onUpdate: () => renderLane(runtime),
      })
    }

    applyPlayState()
  }, viewport)
}

onMounted(async () => {
  await nextTick()

  const viewport = viewportRef.value
  if (!viewport) return

  reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

  updateLaneCountByWidth(viewport.clientWidth)
  await nextTick()

  if (!reducedMotionQuery.matches) {
    initAnimation()

    // 离开视口时暂停滚动，避免首页其他区域滚动时后台空转
    intersectionObserver = new IntersectionObserver((entries) => {
      const first = entries[0]
      if (!first) return
      inView = first.isIntersecting
      applyPlayState()
    })
    intersectionObserver.observe(viewport)
  }

  resizeObserver = new ResizeObserver((entries) => {
    const first = entries[0]
    if (!first) return
    updateLaneCountByWidth(first.contentRect.width)
  })
  resizeObserver.observe(viewport)
})

watch(laneCount, async () => {
  laneRefs.value = []
  lineRefs.value = []
  await nextTick()
  if (!reducedMotionQuery?.matches) {
    initAnimation()
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  intersectionObserver?.disconnect()
  intersectionObserver = null
  reducedMotionQuery = null
  hoverPausedLanes.clear()
  tweens.forEach((tween) => tween.kill())
  tweens = []
  laneRuntimes = []
  ctx?.revert()
  ctx = null
})
</script>

<template>
  <div
    class="zn-feature-flow"
    ref="viewportRef"
    aria-label="核心能力滚动列表，点击跳转到功能模块"
    role="link"
    tabindex="0"
    @click="goToFeaturesPage"
    @keydown.enter.prevent="goToFeaturesPage"
    @keydown.space.prevent="goToFeaturesPage"
  >
    <div class="zn-feature-flow__grid" :style="gridStyle">
      <div
        v-for="(lane, laneIndex) in loopLaneItems"
        :key="`lane-${laneIndex}`"
        class="zn-feature-flow__lane"
        :ref="(el) => setLaneRef(el, laneIndex)"
        @mouseenter="pauseLane(laneIndex)"
        @mouseleave="resumeLane(laneIndex)"
      >
        <div class="zn-feature-flow__mask" />
        <div
          v-for="(item, lineIndex) in lane"
          :key="`${item}-${laneIndex}-${lineIndex}`"
          class="zn-feature-flow__item"
          :ref="(el) => setLineRef(el, laneIndex, lineIndex)"
          :aria-hidden="lineIndex >= laneItems[laneIndex].length"
        >
          {{ item }}
        </div>
      </div>
    </div>
    <div class="zn-feature-flow__hint" aria-hidden="true">点击查看功能模块 →</div>
  </div>
</template>

<style scoped>
.zn-feature-flow {
  border: 1px solid var(--zn-border);
  border-radius: 14px;
  background: var(--vp-c-bg-soft);
  padding: 14px;
  cursor: pointer;
}

.zn-feature-flow:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--vp-c-brand-1) 65%, transparent);
  outline-offset: 3px;
}

.dark .zn-feature-flow {
  background: var(--zn-bg-alt);
}

.zn-feature-flow__grid {
  display: grid;
  gap: 10px;
}

.zn-feature-flow__lane {
  position: relative;
  overflow: hidden;
  height: 300px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--vp-c-bg-soft) 85%, var(--vp-c-bg));
  contain: layout paint;
}

.dark .zn-feature-flow__lane {
  background: color-mix(in srgb, var(--zn-bg-alt) 84%, #000);
}

.zn-feature-flow__item {
  position: absolute;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--zn-text-1);
  letter-spacing: 0.1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-inline: 8px;
}

.zn-feature-flow__hint {
  margin-top: 8px;
  text-align: right;
  font-size: 12px;
  color: var(--zn-text-2);
}

.zn-feature-flow__mask {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  background: linear-gradient(
    180deg,
    var(--vp-c-bg-soft) 0%,
    color-mix(in srgb, var(--vp-c-bg-soft) 40%, transparent) 12%,
    transparent 30%,
    transparent 70%,
    color-mix(in srgb, var(--vp-c-bg-soft) 40%, transparent) 88%,
    var(--vp-c-bg-soft) 100%
  );
}

.dark .zn-feature-flow__mask {
  background: linear-gradient(
    180deg,
    var(--zn-bg-alt) 0%,
    color-mix(in srgb, var(--zn-bg-alt) 42%, transparent) 12%,
    transparent 30%,
    transparent 70%,
    color-mix(in srgb, var(--zn-bg-alt) 42%, transparent) 88%,
    var(--zn-bg-alt) 100%
  );
}

@media (max-width: 640px) {
  .zn-feature-flow {
    padding: 10px;
  }

  .zn-feature-flow__lane {
    height: 230px;
  }

  .zn-feature-flow__item {
    font-size: 13px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .zn-feature-flow__lane {
    height: auto;
    max-height: 280px;
    overflow: auto;
  }

  .zn-feature-flow__item {
    position: static;
    opacity: 1 !important;
    filter: none !important;
    transform: none !important;
    padding-block: 4px;
  }

  .zn-feature-flow__mask {
    display: none;
  }
}
</style>
