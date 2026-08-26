---
layout: home
title: Zenith Admin
titleTemplate: false
hero:
  name: Zenith Admin
  text: 简洁、强大、可持续演进的全栈后台底座
  tagline: 基于 Hono + React + Semi Design + Drizzle ORM，内置权限、审计、存储、多租户等后台高频能力，默认开箱可用，同时为 AI 协作开发预留清晰边界。
  actions:
    - theme: brand
      text: 快速开始 →
      link: /guide/getting-started
    - theme: alt
      text: 在线演示 →
      link: https://iwangbowen.github.io/zenith-admin/demo/
    - theme: alt
      text: GitHub
      link: https://github.com/iwangbowen/zenith-admin
features:
  - title: 权限与组织管理
    details: RBAC 角色模型、动态菜单、按钮级鉴权；部门树、岗位、用户组全覆盖，批量导入/启停/重置密码，用户在线状态实时显示。
    link: /iam/
  - title: 工作流引擎
    details: 可视化流程设计器（审批/抄送/条件分支/延迟器/触发器/子流程）、表单库、流程模板、发起工作台、审批代理、定时发起、连接器、流程自动化与事件订阅，支持外部审批、引擎健康巡检与移动审批轻页。
    link: /workflow/
  - title: AI 智能助手
    details: SSE 流式多会话对话、知识库 RAG、自定义智能体、HTTP 工具调用、模型评测与竞技场、提示词模板、模型与服务商配置、个人 AI Key、用量统计与对话审计。
    link: /ai-platform/
  - title: 即时通讯与多渠道通知
    details: 内置 WebSocket 单聊/群聊、WebRTC 音视频通话、站内信、公告推送、消息频道（运营号）与客服工作台；邮件/短信多服务商可插拔，消息模板统一维护。
    link: /chat/
  - title: 支付中心
    details: 多渠道支付配置（微信支付/支付宝等）、订单生命周期（下单/支付/关闭/退款）、预授权与签约代扣、支付链接、对账/资金台账/结算分账、风控与交易投诉，回调日志全链路追踪，内置 outbox 事件防丢失。
    link: /payment/
  - title: 会员中心
    details: 前台 C 端独立 SPA（手机号验证码、手机号/邮箱/用户名密码登录）+ 后台管理双轨隔离；会员看板、等级、积分账户、钱包余额（乐观锁防并发超扣）、充值记录、优惠券、签到与里程碑。
    link: /member/
  - title: 报表中心
    details: 自助式报表平台（对标积木报表）。多源接入（API/MySQL/PG/SQL Server/Excel·CSV）、数据集加工（参数/计算字段/缓存/物化/数据权限）、23 种组件仪表盘、自由画布数据大屏、类 Excel 打印报表（套打/导出）、智能问数(NL2SQL/ChatBI)、指标中心、数据质量、数据填报、数据预警、分享订阅与跨模块嵌入。
    link: /report/
  - title: CMS 内容管理
    details: 多站点与树形栏目、内容模型与富文本编辑、素材中心、可视化页面搭建、静态化发布、全文检索、SEO、评论/广告/表单/问卷、敏感词与采集中心、内容分发与会员订阅。
    link: /cms/
  - title: 微信公众号
    details: 多公众号统一管理、粉丝与标签（会员打通）、自动回复与多客服会话、自定义/个性化菜单、素材与图文草稿、群发与模板消息、带参二维码、网页授权与 JS-SDK、数据统计。
    link: /mp/
  - title: 知识中心
    details: 企业内部 Wiki：空间与角色权限、文档树（拖拽排序/置顶/模板/版本历史）、阅读视图（面包屑/上下篇/大纲）、评论协作、发布审批、治理统计与回收站。
    link: /wiki/
  - title: 规则中心
    details: 统一决策底座：决策表（多命中策略、灰度发布、批量仿真）、决策流编排、评分卡引擎、黑白灰名单库；decide() 统一求值门面与全链路执行留痕，让业务规则与风控脱离硬编码。
    link: /rules/
  - title: 开放平台
    details: 开发者自助应用、生产/沙箱环境、OAuth 2.1（PKCE）、HMAC 签名网关、API Scope 与限流套餐、调用统计与导出、Webhook 签名投递与失败自动停用、在线 API 调试台。
    link: /open-platform/
  - title: 数据分析与错误监控
    details: 行为埋点（PV/UV/停留/点击）多维大盘展示；前端 JS 异常自动上报，错误堆栈一键查看，无需额外 APM 工具。
    link: /analytics/
  - title: 安全防护全链路
    details: JWT 双 Token、身份安全策略与登录风险事件、企业身份源（OIDC/SAML/LDAP/AD）、IP 访问控制、登录锁定、数据脱敏、幂等防重提交、接口限流、文件类型 Magic Bytes 校验。
    link: /backend/security
  - title: 运维与可观测
    details: 仪表盘、服务监控（SSE 实时）、监控告警、定时任务（pg-boss）、任务中心与导出中心、数据库管理与备份、缓存管理、应用版本管理与在线升级；Web SSH 终端、终端录屏、文件管理器、进程管理、Docker、网络诊断、systemd/防火墙/Nginx/SSL 证书管理。
    link: /ops/
  - title: 个性化、PWA 与桌面端
    details: 偏好设置（拼音搜索）、菜单收藏与最近访问、19 种主题色、路由动画、灰色/色弱模式；可选 PWA 支持与 Electron 桌面客户端（应用版本管理 + 双层在线升级）。
---

<script setup>
import { withBase } from 'vitepress'
</script>

<section class="zn-section">
  <h2 class="zn-title">技术选型</h2>
  <p class="zn-desc">成熟技术栈组合，兼顾开发效率与运行稳定性。</p>
  <ul class="zn-deflist">
    <li><span class="zn-term">后端</span><span class="zn-def">Hono v4 · Node.js 24 · Drizzle ORM · PostgreSQL · Redis · pg-boss</span></li>
    <li><span class="zn-term">前端</span><span class="zn-def">React 19 · Vite 8 · <a href="https://semi.design/" target="_blank">Semi Design v2</a> · react-router v7 · TanStack Query v5 · lucide-react</span></li>
    <li><span class="zn-term">工程</span><span class="zn-def">npm monorepo · 共享 Zod 校验 · OpenAPI / Swagger · JWT 鉴权 · MSW Demo 模式</span></li>
  </ul>
  <h3 class="zn-subtitle">架构分层</h3>
  <p class="zn-desc">清晰职责分工，让业务迭代与团队协作都更顺畅。</p>
  <div class="zn-arch-grid">
    <article class="zn-arch-card">
      <h3><code>packages/server</code></h3>
      <p>Hono 路由、Drizzle 数据访问、业务服务层与 OpenAPI 文档输出。</p>
    </article>
    <article class="zn-arch-card">
      <h3><code>packages/web</code></h3>
      <p>React 多入口前端：后台管理、前台会员 SPA、移动审批轻页，支持 Demo Mock 模式。</p>
    </article>
    <article class="zn-arch-card">
      <h3><code>packages/shared</code></h3>
      <p>按业务域拆分的共享类型、常量与校验 schema，降低前后端字段漂移风险。</p>
    </article>
    <article class="zn-arch-card">
      <h3><code>packages/analytics-sdk</code></h3>
      <p>行为埋点采集 SDK，为数据分析模块提供 PV/UV、点击与停留时长上报。</p>
    </article>
    <article class="zn-arch-card">
      <h3><code>packages/electron</code></h3>
      <p>桌面客户端封装，将后台打包为 Windows / macOS / Linux 桌面应用。</p>
    </article>
  </div>
</section>

<section class="zn-section">
<h2 class="zn-title">核心能力矩阵</h2>
<FeatureMatrixFlow />
</section>

<section class="zn-section">
  <h2 class="zn-title">推荐阅读路径</h2>
  <ul class="zn-navlist">
    <li><a :href="withBase('/guide/getting-started')">快速开始</a> — 环境准备、安装依赖、启动服务</li>
    <li><a :href="withBase('/guide/project-structure')">项目结构</a> — 目录职责与关键模块定位</li>
    <li><a :href="withBase('/product/features')">功能清单</a> — 已实现能力全景扫描</li>
    <li><a :href="withBase('/backend/api-conventions')">接口规范</a> — 响应结构、错误处理与分页约定</li>
    <li><a :href="withBase('/iam/')">权限与组织</a> — RBAC 角色、动态菜单、数据权限范围</li>
    <li><a :href="withBase('/member/')">会员中心</a> — 前台 C 端 + 后台管理双体系</li>
    <li><a :href="withBase('/report/')">报表中心</a> — 数据源、数据集、仪表盘、大屏与打印报表</li>
    <li><a :href="withBase('/cms/')">CMS 内容管理</a> — 内容管线、页面搭建、静态化与检索</li>
    <li><a :href="withBase('/ops/')">系统运维</a> — Web 终端、进程、Docker、网络诊断</li>
    <li><a :href="withBase('/ai/')">AI 辅助开发</a> — 使用 Zenith Skill 加速模块开发</li>
  </ul>
</section>
