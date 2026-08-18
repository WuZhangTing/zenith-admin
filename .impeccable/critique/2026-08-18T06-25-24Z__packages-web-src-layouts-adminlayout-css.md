---
target: 导航栏(vertical 侧边栏为主)
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-18T06-25-24Z
slug: packages-web-src-layouts-adminlayout-css
---
# 导航系统设计评审(vertical 侧边栏为主,含顶栏/double/移动端)

Method: dual-agent (A: nav-design-review · B: nav-detector-scan);浏览器叠加层由父会话在 A 完成后注入。

## Design Health Score

| # | 启发式 | 分数 | 关键问题 |
|---|---|---|---|
| 1 | 系统状态可见性 | 3 | 选中/徽标/折叠反馈齐全;collapsed 下选中项背景被清除 |
| 2 | 符合真实世界 | 2 | 17 个一级项并列,缺任务路径组织 |
| 3 | 用户控制与自由 | 3 | 折叠/搜索/最近访问/布局偏好;控制项本身过多 |
| 4 | 一致性与标准 | 2 | 四种布局+页签的选中态各一套 |
| 5 | 防错 | 2 | overflow/移动端稳;深层导航与图标栏易误点 |
| 6 | 识别优于回忆 | 2 | 折叠态/double rail/深层依赖记忆 |
| 7 | 灵活高效 | 3 | Ctrl+K、最近访问、页签对熟手有利 |
| 8 | 美学与极简 | 2 | 最大短板:线、按钮、徽标、状态过密 |
| 9 | 错误恢复 | 2 | 可回退,但"我在哪个业务域"定位弱 |
| 10 | 帮助与文档 | 1 | 无新手解释/分组说明 |
| **合计** | | **22/40** | 及格线,离"简洁清新"有明确距离 |

## 设计特异性判定

**品类通用外观**。视觉语言 = Semi token + 飞书式浅灰后台壳;Lucide 16px 线性图标统一但通用;17 个一级菜单只是业务名不同。多布局、未读徽标、TopNav overflow 是工程能力而非品牌语言。去掉"Zenith Admin"四个字,没有可识别特征。

**确定性扫描**(detect.mjs,exit 2,5 项):bounce-easing ×2(AdminLayout.css:1643 为动画预览 demo,疑似误报;:1698 真实)、layout-transition ×3(:155 侧边栏宽度 0.28s 过渡、:1713、:1839)。

**浏览器叠加层**(已注入 zenith-local 标签页,16 个标注节点可见):侧边栏整列命中 layout property animation(即 :155);品牌 Logo 区(32×32)命中 low contrast text(白字压主色渐变);全局 banner:inter 字体占 77%、gradient text、side-tab accent border(命中 codeHighlight 主题,对导航为误报);"positioned child clipped" 为后台壳 overflow:hidden 常规模式,噪声。

## 总体印象

工程扎实、功能完备,但视觉上是"所有东西都在说话":17 个一级项、10 个顶栏图标、三处 1px 硬边线、整块填充的选中态、带光晕的渐变 Logo。"不够简洁清新"的根因不是配色,而是**信息架构密度 + 边界线用量 + 状态语言不统一**。

## 做得好的

1. Semi token 接入克制,`--semi-color-*` 语义映射,暗色/分区模式有体系
2. `TopNavWithOverflow` 隐藏探测 Nav + ResizeObserver 的溢出收纳,工程上超出行业均值
3. 图标体系统一(Lucide 16px / strokeWidth 1.5),这是"清爽"的地基

## 优先级问题

### [P1] 一级菜单 17 项并列,权重完全相同
- **伤害**:清新 = 一眼知道去哪;现在所有业务域同时喊话,扫描成本最高
- **修复**:默认露出 8±2 个高频域;低频域合并成组(平台与开放/内容与知识/治理与配置);加 12px/600/text-2 的分区标题,不加分割线
- 命令:/impeccable distill

### [P1] 边界线与选中态过重,"后台模板感"
- **伤害**:`.admin-sidebar` 右边线 + header 底边线 + footer 顶边线(AdminLayout.css:157/365),选中态是整块填充 `!important`(:359-362);硬边界太多,表面层级混乱
- **修复**:边线改 `color-mix(border 55%, transparent)` 或移除 footer 顶线;选中态统一为"浅填充 + 左 2px primary rail";hover 用 fill-0
- 命令:/impeccable quieter + /impeccable layout

### [P2] Header 工具区 10 个等权图标
- **伤害**:顶部成了第二条导航
- **修复**:默认保留搜索/最近/任务/消息/用户 5 个,其余进 MoreDropdown;gap 8→4px;分隔线只留用户菜单前一处
- 命令:/impeccable distill

### [P2] 四种布局选中态不统一
- **伤害**:vertical 整块填充、collapsed 清除背景(:459)、horizontal 胶囊、double rail 另一套、页签 4 种风格;换布局像换产品
- **修复**:统一状态矩阵 default/hover/active/current-group;collapsed 保留选中可见;double rail label 10px→11px+
- 命令:/impeccable polish

### [P3] 品牌区光晕渐变 Logo + 17px 标题
- **伤害**:`box-shadow: 0 2px 6px primary 30%`(:170)的光晕是叠加层实测低对比来源,17px 标题偏重
- **修复**:阴影降到 10% 或移除;标题 17→15px/600;品牌区不加边线
- 命令:/impeccable quieter

## 人物角色红旗

- **高频运营 Alex**:每天穿过 17 个同级菜单;任务/公告/消息三个通知入口分散;页签+最近访问+菜单树三套返回方式心智重复
- **新员工 Jordan**:"系统管理/系统设置/规则中心/工作流引擎"边界不清;折叠后只剩通用线性图标,LayoutGrid 兜底进一步降低可识别性
- **低视力用户**:double rail label 10px 不合格;菜单 13px + text-2 长时间扫描吃力;collapsed 选中项无背景;4px 滚动条难操作

## 次要观察

- 中文菜单上 `letter-spacing: 0.2px`(:306/314)收益为零,显机械
- 侧栏未读用红色数字过抢,建议侧栏红点、数字留给 header
- 大量 `!important` 覆盖 Semi,视觉系统靠高特异性修补,易漂移
- 侧边栏宽度 transition(:155)命中 layout-transition;折叠低频可接受,若追求满分改 transform/grid 方案

## 发人深省的问题

1. 如果默认只展示 8 个一级入口,哪 8 个真正代表 Zenith Admin 的日常?
2. 用户需要 4 种导航布局,还是团队没决定哪种 IA 是对的?
3. 去掉"Zenith Admin"四个字,这套导航还剩什么属于 Zenith?
