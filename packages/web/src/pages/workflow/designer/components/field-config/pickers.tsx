// ─── 数据字典 / 关联审批单绑定选择器（拆分自 FieldConfigPanel.tsx）───
import { Select } from '@douyinfe/semi-ui';
import { useWorkflowDesignerDictOptions } from '@/hooks/queries/workflow-designer';
import { usePublishedWorkflowDefinitions } from '@/hooks/queries/workflow-definitions';
import { LOOKUP_STALE_TIME } from '@/lib/query';

// ─── 关联流程选择器（设计态：限制可关联哪个审批流） ──────────────────

export function RelationDefinitionPicker({
  value,
  onChange,
}: Readonly<{ value?: number; onChange: (id: number | undefined) => void }>) {
  // 与启动列表共用一份缓存：曾自建 key，导致新发布的流程在此下拉里最长 5 分钟不出现
  const definitionsQuery = usePublishedWorkflowDefinitions({ staleTime: LOOKUP_STALE_TIME });
  const definitions = definitionsQuery.data ?? [];
  const loading = definitionsQuery.isFetching;

  return (
    <Select
      value={value === undefined ? '' : String(value)}
      onChange={(v) => onChange(v === '' || v === undefined || v === null ? undefined : Number(v))}
      placeholder={loading ? '加载中...' : '请选择关联流程'}
      filter
      showClear
      disabled={loading}
      style={{ width: '100%' }}
      optionList={[
        { value: '', label: '任意流程' },
        ...definitions.map((d) => ({ value: String(d.id), label: d.name })),
      ]}
    />
  );
}

// ─── 数据字典选择器（设计态：选择绑定哪个字典 code） ──────────────────

interface DictOption { code: string; name: string }

export function DictCodePicker({
  value,
  onChange,
}: Readonly<{ value?: string; onChange: (code: string | undefined) => void }>) {
  const dictsQuery = useWorkflowDesignerDictOptions();
  const dicts: DictOption[] = dictsQuery.data ?? [];
  const loading = dictsQuery.isFetching;

  return (
    <Select
      value={value || undefined}
      onChange={(v) => onChange(v as string | undefined)}
      placeholder={loading ? '加载中...' : '请选择数据字典'}
      filter
      showClear
      disabled={loading}
      style={{ width: '100%' }}
      optionList={dicts.map((d) => ({ value: d.code, label: `${d.name}（${d.code}）` }))}
    />
  );
}
