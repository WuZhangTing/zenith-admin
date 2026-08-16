# 内容模型与扩展字段

内容模型为站点、栏目与内容提供**自定义结构化字段**（EAV via JSONB）：模型定义字段元数据，值存入宿主对象的 `extend` 列。政府站的「文号/发布机关」、游戏站的「评分/平台/发售日期」、产品站的「价格/规格」都由同一套机制承载。

管理入口：`/cms/models`（权限 `cms:model:*`）。表：`cms_models` / `cms_model_fields`。

## 字段类型

共 12 种（`CMS_FIELD_TYPES`），编辑表单按类型渲染对应控件：

| 类型 | 控件 | 值形态 |
|------|------|--------|
| `text` / `textarea` | 单行 / 多行文本 | string |
| `richtext` | 富文本编辑器 | HTML string |
| `number` | 数字输入 | number |
| `date` / `datetime` | 日期 / 日期时间选择 | `YYYY-MM-DD` / `YYYY-MM-DD HH:mm:ss` |
| `image` / `file` | 媒体库选取 / 上传 | 素材句柄（`cms-res://{id}`） |
| `select` / `radio` | 下拉 / 单选 | 选项 value |
| `checkbox` | 多选 | value[] |
| `switch` | 开关 | boolean |

## 字段配置项

模型编辑器中每个字段可配置：

| 配置 | 作用 |
|------|------|
| 标识 `name` / 名称 `label` | `name` 为 `extend` 的 JSON key（英文），`label` 为表单与前台展示名 |
| 必填 `required` | **发布必填**——见下方「校验分层」 |
| 检索 `searchable` | 值纳入全文检索（权重 C），并开放给 Headless API 的 `extend.{字段}` 过滤 |
| 列表显示 `showInList` | 字段值注入前台**列表项**（卡片角标场景，如评分/平台），后台内容列表同样展示 |
| 详情展示 `showInDetail` | 字段值注入前台**详情页**，由主题渲染（如公文「文件信息」表头） |
| 详情分组 `detailGroup` / 排序 `detailSort` | 详情展示的分组标题与组内顺序；`detailSort` 按模型编辑器行序自动落库 |
| 默认值 `defaultValue` | 新建内容时自动填充（前端初始化 + 服务端创建兜底回填，双保险） |
| 提示文案 `placeholder` | 编辑表单占位提示 |

### 选项来源（select / radio / checkbox）

| 来源 | 配置方式 | 适用 |
|------|---------|------|
| **手工维护**（默认） | 模型编辑器内直接填写，**每行一个选项**，格式 `值\|显示名`（显示名可省略，如 `pc\|PC` 或 `PC`） | 模型专属选项 |
| **引用系统字典** | 只填字典编码，选项在读取模型时实时解析自 `dict_items`（仅启用项，按 sort 排序） | 多模型共用、需统一治理的选项 |

字典维护一处、所有引用它的模型字段自动同步。解析结果经 `resolvedOptions` 统一返回，内容编辑表单与前台翻译均按它渲染；字典编码不存在时解析为空数组，不影响其他字段。引用字典却未填编码在保存时即被拦截。

## 校验分层：草稿宽松、发布严格

扩展字段的服务端校验（`validateCmsModelExtend`）按目标状态分层，编辑器可以随时存草稿、不被半成品数据卡住：

| 时机 | 校验强度 |
|------|---------|
| 保存草稿 / 更新草稿 | **宽松**：仅校验类型合法性与选项 value 合法性，必填不拦截 |
| 提交审核 / 发布 | **严格**：额外校验 `required` 字段非空 |

前端编辑表单不挂 required 规则，改在字段 label 上标注「（发布必填）」提示；创建时 `defaultValue` 自动回填。校验统一挂在创建、更新、提审、发布全部写入口，Headless API 写入同样生效。

## 三级绑定

模型通过宿主对象各自的 `model_id` + `extend` 列绑定到三级：

| 绑定级 | 绑定位置 | 值存放 | 用途 |
|---|---|---|---|
| 站点 | `cms_sites.model_id` | `cms_sites.extend` | 站点级运营元数据（备案号、客服电话等），主题经 `site.extend` 读取 |
| 栏目 | `cms_channels.model_id` | 栏目下内容的 `extend` | 决定该栏目下内容编辑页动态渲染哪些扩展字段 |
| 内容 | `cms_contents.model_id` | `cms_contents.extend` | 由所属栏目继承，换栏目时跟随目标栏目、扩展字段按目标模型解释 |

## 站群归属治理

模型带**归属**（`cms_models.owner_site_id`，创建后不可变更）：

| 归属 | 语义 |
|------|------|
| **平台共享**（`owner_site_id = null`） | 全部站点可见、可绑定；内置模型（文章/产品）属此类 |
| **站点专属** | 仅归属站点可见、可绑定 |

- **可见性过滤**：模型列表与绑定下拉按「平台共享 + 当前站点专属」过滤，A 站的专属模型不会出现在 B 站的任何选择器里
- **跨站绑定拦截**：服务端在站点/栏目/内容绑定模型时校验归属（`assertCmsModelUsableBySite`），越权绑定直接 400
- **引用清单**：`GET /api/cms/models/{id}/refs` 返回模型被哪些站点/栏目/内容绑定，删除前评估影响面
- 后台模型列表展示「归属」列（平台共享 / 站点名徽章），创建时以单选指定，站点过滤器联动

## 前台渲染消费

模型字段值由渲染管线**翻译为展示值**后注入主题上下文（`CmsModelFieldValue[]`）：字典/选项 value 反查 label、`checkbox` 多值以「、」连接、日期格式化、`switch` 转 是/否、`richtext` 输出纯文本摘要（完整渲染由主题自行处理 `rawValue`）。

| 注入位置 | 来源字段 | 典型主题用法 |
|---|---|---|
| `ctx.content.modelFields`（详情页） | `showInDetail` 字段，按 `detailGroup` 分组、`detailSort` 排序 | gov-portal 用共享组件 `ModelFieldTable` 渲染公文「文件信息」双栏键值表；magazine 把 `ratingField` 拆出渲染大评分徽章、其余字段行内标签 |
| `item.modelFields`（列表项） | `showInList` 字段 | magazine / default 卡片角标（「9.5」「PC、PS5」chips） |

列表场景按 modelId **批量预载**字段定义后同步翻译（一页列表通常仅涉及 1-2 个模型），首页区块、栏目列表、标签页与 Theme API 取数结果全部生效。主题侧消费方式见[主题与模板开发](./themes#消费模型字段)。

## 接口

- `GET/POST /api/cms/models`、`GET/PUT/DELETE /api/cms/models/{id}`（列表支持 `siteId` 可见性过滤）
- `GET /api/cms/models/{id}/refs` 引用清单
- 修改模型字段后，存量内容的 `extend` 不迁移——新字段读为空、被删字段成为不再解释的冗余键；如需前台生效需重建静态页
