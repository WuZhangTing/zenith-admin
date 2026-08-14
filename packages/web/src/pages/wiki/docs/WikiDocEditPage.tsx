import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Banner, Button, Input, Select, Space, Spin, TextArea, Toast, Typography } from '@douyinfe/semi-ui';
import { ArrowLeft, Eye, EyeOff, Save, Send } from 'lucide-react';
import MarkdownPreviewPanel from '@/components/MarkdownPreviewPanel';
import './WikiDocEditPage.css';
import { useAllWikiTags } from '@/hooks/queries/wiki-tags';
import { useAllWikiTemplates } from '@/hooks/queries/wiki-templates';
import { useSaveWikiDoc, useSubmitWikiDoc, useWikiDocDetail } from '@/hooks/queries/wiki-docs';

const { Text } = Typography;

/**
 * 全屏 Markdown 编辑器（搭建器型工作区，保存后不关闭）：
 * 不适用 useEditModal —— 非弹窗表单、双栏实时预览、保存后需原地继续编辑。
 */
export default function WikiDocEditPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id') ? Number(searchParams.get('id')) : undefined;
  const spaceIdParam = searchParams.get('spaceId') ? Number(searchParams.get('spaceId')) : undefined;
  const parentIdParam = searchParams.get('parentId') ? Number(searchParams.get('parentId')) : undefined;

  const detailQuery = useWikiDocDetail(id);
  const saveMutation = useSaveWikiDoc();
  const submitMutation = useSubmitWikiDoc();
  const tagsQuery = useAllWikiTags();
  const templatesQuery = useAllWikiTemplates();

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [changeNote, setChangeNote] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [dirty, setDirty] = useState(false);
  const seededDocId = useRef<number | null>(null);

  // 编辑模式：详情到达后播种一次表单
  useEffect(() => {
    const doc = detailQuery.data;
    if (!doc || seededDocId.current === doc.id) return;
    seededDocId.current = doc.id;
    setTitle(doc.title);
    setSummary(doc.summary ?? '');
    setContent(doc.content ?? '');
    setTagIds(doc.tagIds ?? []);
    setDirty(false);
  }, [detailQuery.data]);

  // 离开未保存提醒
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const loading = !!id && detailQuery.isPending;
  const doc = detailQuery.data;

  function markDirty() {
    if (!dirty) setDirty(true);
  }

  function applyTemplate(templateId: number) {
    const tpl = templatesQuery.data?.find((t) => t.id === templateId);
    if (!tpl) return;
    if (content.trim()) {
      Toast.warning('已有内容，模板将追加到正文末尾');
      setContent((c) => `${c}\n\n${tpl.content}`);
    } else {
      setContent(tpl.content);
    }
    markDirty();
  }

  async function handleSave(): Promise<number | null> {
    if (!title.trim()) {
      Toast.warning('请填写文档标题');
      return null;
    }
    const values = id
      ? { title: title.trim(), summary: summary || null, content, tagIds, changeNote: changeNote || undefined }
      : { spaceId: spaceIdParam, parentId: parentIdParam ?? null, title: title.trim(), summary: summary || undefined, content, tagIds };
    const saved = await saveMutation.mutateAsync({ id, values });
    setDirty(false);
    setChangeNote('');
    if (!id) navigate(`/wiki/docs/edit?id=${saved.id}`, { replace: true });
    return saved.id;
  }

  async function handleSaveOnly() {
    const savedId = await handleSave();
    if (savedId) Toast.success('保存成功');
  }

  async function handleSaveAndSubmit() {
    const savedId = await handleSave();
    if (!savedId) return;
    submitMutation.mutate(savedId, {
      onSuccess: (saved) => {
        Toast.success(saved.status === 'published' ? '已发布' : '已提交审核');
        navigate(-1);
      },
    });
  }

  function handleBack() {
    if (dirty) {
      Toast.warning('有未保存的修改，请先保存或再次点击返回放弃修改');
      setDirty(false);
      return;
    }
    navigate(-1);
  }

  if (!id && spaceIdParam === undefined) {
    return (
      <div className="page-container">
        <Banner type="warning" description="缺少空间参数，请从文档中心进入新建" />
      </div>
    );
  }

  return (
    <div className="page-container page-container--stretch" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 顶栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <Space spacing={8}>
          <Button icon={<ArrowLeft size={14} />} onClick={handleBack}>返回</Button>
          <Input
            style={{ width: 320 }}
            placeholder="文档标题（必填）"
            value={title}
            onChange={(v) => { setTitle(v); markDirty(); }}
            maxLength={200}
          />
          {doc ? <Text type="tertiary" size="small">v{doc.currentVersion} · {doc.spaceName ?? ''}</Text> : null}
        </Space>
        <Space spacing={8}>
          <Select
            placeholder="选用模板"
            style={{ width: 150 }}
            showClear
            optionList={(templatesQuery.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
            onChange={(v) => { if (v !== undefined) applyTemplate(Number(v)); }}
          />
          <Button
            icon={showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
            onClick={() => setShowPreview((s) => !s)}
          >
            {showPreview ? '隐藏预览' : '显示预览'}
          </Button>
          <Button
            icon={<Save size={14} />}
            loading={saveMutation.isPending}
            onClick={() => void handleSaveOnly()}
          >
            保存草稿
          </Button>
          <Button
            theme="solid"
            icon={<Send size={14} />}
            loading={saveMutation.isPending || submitMutation.isPending}
            onClick={() => void handleSaveAndSubmit()}
          >
            保存并提交发布
          </Button>
        </Space>
      </div>

      {/* 元信息行 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Input
          style={{ flex: '1 1 240px' }}
          placeholder="摘要（选填，用于列表与搜索展示）"
          value={summary}
          onChange={(v) => { setSummary(v); markDirty(); }}
          maxLength={500}
        />
        <Select
          multiple
          style={{ flex: '1 1 240px' }}
          placeholder="选择标签"
          value={tagIds}
          onChange={(v) => { setTagIds((v as number[]) ?? []); markDirty(); }}
          optionList={(tagsQuery.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
          maxTagCount={4}
        />
        {id ? (
          <Input
            style={{ flex: '1 1 240px' }}
            placeholder="本次变更说明（选填，记入版本历史）"
            value={changeNote}
            onChange={setChangeNote}
            maxLength={300}
          />
        ) : null}
      </div>

      {/* 编辑器主体（高度链：page-container--stretch → wiki-editor-body → textarea） */}
      <div className="wiki-editor-body">
        {loading ? (
          <div className="wiki-editor-loading"><Spin size="large" /></div>
        ) : (
          <>
            <TextArea
              className="wiki-editor-textarea"
              placeholder={'使用 Markdown 编写文档内容...\n\n# 一级标题\n## 二级标题\n- 列表项\n**加粗** `代码`'}
              value={content}
              onChange={(v) => { setContent(v); markDirty(); }}
            />
            {showPreview ? (
              <div className="wiki-editor-preview">
                <MarkdownPreviewPanel content={content || '*预览区：左侧输入 Markdown 后此处实时渲染*'} />
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
