import type { Menu } from '../../identity/types';
import { SEED_DATE } from '../_base';

/** 知识中心（16000 段） */
export const SEED_MENUS_WIKI: Menu[] = [
  { id: 16000, parentId: 0, title: '知识中心', name: 'WikiCenter', icon: 'BookOpen', type: 'directory', sort: 16, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // ─── 文档中心（主工作台）───────────────────────────────────────────────────
  { id: 16010, parentId: 16000, title: '文档中心', name: 'WikiDocCenter', path: '/wiki/docs', component: 'wiki/docs/WikiDocCenterPage', icon: 'BookOpenText', type: 'menu', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16011, parentId: 16010, title: '查询', type: 'button', permission: 'wiki:doc:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16012, parentId: 16010, title: '新增文档', type: 'button', permission: 'wiki:doc:create', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16013, parentId: 16010, title: '编辑文档', type: 'button', permission: 'wiki:doc:edit', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16014, parentId: 16010, title: '删除文档', type: 'button', permission: 'wiki:doc:delete', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16015, parentId: 16010, title: '提交发布', type: 'button', permission: 'wiki:doc:publish', sort: 4, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16016, parentId: 16010, title: '移动文档', type: 'button', permission: 'wiki:doc:move', sort: 5, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // 全屏编辑页与版本对比页：从文档中心跳转进入，不在侧边栏展示
  { id: 16017, parentId: 16010, title: '文档编辑页', name: 'WikiDocEdit', path: '/wiki/docs/edit', component: 'wiki/docs/WikiDocEditPage', icon: 'FilePen', type: 'menu', sort: 8, status: 'enabled', visible: false, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16018, parentId: 16010, title: '版本对比页', name: 'WikiDocHistory', path: '/wiki/docs/history', component: 'wiki/docs/WikiDocHistoryPage', icon: 'History', type: 'menu', sort: 9, status: 'enabled', visible: false, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // ─── 知识空间 ──────────────────────────────────────────────────────────────
  { id: 16020, parentId: 16000, title: '知识空间', name: 'WikiSpaces', path: '/wiki/spaces', component: 'wiki/spaces/WikiSpacesPage', icon: 'LibraryBig', type: 'menu', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16021, parentId: 16020, title: '查询', type: 'button', permission: 'wiki:space:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16022, parentId: 16020, title: '新增空间', type: 'button', permission: 'wiki:space:create', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16023, parentId: 16020, title: '编辑空间', type: 'button', permission: 'wiki:space:edit', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16024, parentId: 16020, title: '删除空间', type: 'button', permission: 'wiki:space:delete', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16025, parentId: 16020, title: '成员授权', type: 'button', permission: 'wiki:space:grant', sort: 4, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // ─── 发布审核 ──────────────────────────────────────────────────────────────
  { id: 16030, parentId: 16000, title: '发布审核', name: 'WikiApprovals', path: '/wiki/approvals', component: 'wiki/approvals/WikiApprovalsPage', icon: 'FileCheck2', type: 'menu', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16031, parentId: 16030, title: '查询', type: 'button', permission: 'wiki:approval:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16032, parentId: 16030, title: '审核', type: 'button', permission: 'wiki:approval:review', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // ─── 文档模板 ──────────────────────────────────────────────────────────────
  { id: 16040, parentId: 16000, title: '文档模板', name: 'WikiTemplates', path: '/wiki/templates', component: 'wiki/templates/WikiTemplatesPage', icon: 'LayoutTemplate', type: 'menu', sort: 4, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16041, parentId: 16040, title: '查询', type: 'button', permission: 'wiki:template:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16042, parentId: 16040, title: '新增模板', type: 'button', permission: 'wiki:template:create', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16043, parentId: 16040, title: '编辑模板', type: 'button', permission: 'wiki:template:edit', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16044, parentId: 16040, title: '删除模板', type: 'button', permission: 'wiki:template:delete', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // ─── 标签管理 ──────────────────────────────────────────────────────────────
  { id: 16050, parentId: 16000, title: '标签管理', name: 'WikiTags', path: '/wiki/tags', component: 'wiki/tags/WikiTagsPage', icon: 'Tags', type: 'menu', sort: 5, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16051, parentId: 16050, title: '查询', type: 'button', permission: 'wiki:tag:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16052, parentId: 16050, title: '新增标签', type: 'button', permission: 'wiki:tag:create', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16053, parentId: 16050, title: '编辑标签', type: 'button', permission: 'wiki:tag:edit', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16054, parentId: 16050, title: '删除标签', type: 'button', permission: 'wiki:tag:delete', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // ─── 评论管理 ──────────────────────────────────────────────────────────────
  { id: 16060, parentId: 16000, title: '评论管理', name: 'WikiComments', path: '/wiki/comments', component: 'wiki/comments/WikiCommentsPage', icon: 'MessagesSquare', type: 'menu', sort: 6, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16061, parentId: 16060, title: '查询', type: 'button', permission: 'wiki:comment:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16062, parentId: 16060, title: '审核评论', type: 'button', permission: 'wiki:comment:audit', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16063, parentId: 16060, title: '删除评论', type: 'button', permission: 'wiki:comment:delete', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // ─── 回收站 ────────────────────────────────────────────────────────────────
  { id: 16070, parentId: 16000, title: '回收站', name: 'WikiRecycle', path: '/wiki/recycle', component: 'wiki/recycle/WikiRecyclePage', icon: 'Recycle', type: 'menu', sort: 7, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16071, parentId: 16070, title: '查询', type: 'button', permission: 'wiki:recycle:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16072, parentId: 16070, title: '还原文档', type: 'button', permission: 'wiki:recycle:restore', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16073, parentId: 16070, title: '彻底删除', type: 'button', permission: 'wiki:recycle:purge', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // ─── 知识统计 ──────────────────────────────────────────────────────────────
  { id: 16080, parentId: 16000, title: '知识统计', name: 'WikiStats', path: '/wiki/stats', component: 'wiki/stats/WikiStatsPage', icon: 'ChartColumnBig', type: 'menu', sort: 8, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16081, parentId: 16080, title: '查询', type: 'button', permission: 'wiki:stats:view', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // ─── 知识库设置 ────────────────────────────────────────────────────────────
  { id: 16090, parentId: 16000, title: '知识库设置', name: 'WikiSettings', path: '/wiki/settings', component: 'wiki/settings/WikiSettingsPage', icon: 'Settings', type: 'menu', sort: 9, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16091, parentId: 16090, title: '查询', type: 'button', permission: 'wiki:setting:view', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16092, parentId: 16090, title: '编辑设置', type: 'button', permission: 'wiki:setting:edit', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
];
