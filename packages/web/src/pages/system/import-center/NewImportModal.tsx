/**
 * 新建导入弹窗：选实体 → 看字段说明 → 下载模板 / 预检 / 上传导入。
 * 需要页面上下文的实体（如 CMS 内容）引导到业务页面操作。
 */
import { useMemo, useRef, useState } from 'react';
import { Banner, Button, Descriptions, Modal, Select, Spin, Tag, Typography } from '@douyinfe/semi-ui';
import { Download, FileSearch, Upload } from 'lucide-react';
import type { ImportEntityMeta } from '@zenith/shared/tasks';
import { useUploadFile } from '@/hooks/queries/files';
import { downloadImportTemplate, useSubmitImportJob } from '@/hooks/queries/import-jobs';

const { Text } = Typography;

interface NewImportModalProps {
  visible: boolean;
  entities: ImportEntityMeta[];
  entitiesLoading: boolean;
  onClose: () => void;
  /** 任务提交成功：调用方关闭本弹窗并打开进度弹窗 */
  onSubmitted: (taskId: number, entityTitle: string) => void;
}

export default function NewImportModal({ visible, entities, entitiesLoading, onClose, onSubmitted }: Readonly<NewImportModalProps>) {
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dryRunRef = useRef(false);

  const uploadMutation = useUploadFile();
  const submitMutation = useSubmitImportJob();
  const submitting = uploadMutation.isPending || submitMutation.isPending;

  const entity = entities.find((e) => e.entity === selectedEntity) ?? null;

  const entityGroups = useMemo(() => {
    const byModule = new Map<string, ImportEntityMeta[]>();
    for (const e of entities) {
      const group = byModule.get(e.module) ?? [];
      group.push(e);
      byModule.set(e.module, group);
    }
    return [...byModule.entries()];
  }, [entities]);

  function pickFile(dryRun: boolean) {
    dryRunRef.current = dryRun;
    fileInputRef.current?.click();
  }

  async function handleFileSelected(file: File) {
    if (!entity) return;
    const formData = new FormData();
    formData.append('file', file);
    const uploaded = await uploadMutation.mutateAsync({ formData });
    const fileId = uploaded[0]?.id;
    if (!fileId) return;
    const row = await submitMutation.mutateAsync({ body: { entity: entity.entity, fileId, dryRun: dryRunRef.current } });
    onSubmitted(row.id, entity.title);
  }

  const requiredColumns = entity?.columns.filter((c) => c.required) ?? [];

  return (
    <Modal
      title="新建导入"
      visible={visible}
      onCancel={onClose}
      footer={null}
      width={560}
      afterClose={() => setSelectedEntity('')}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.csv"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleFileSelected(file);
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 12 }}>
        <Spin spinning={entitiesLoading}>
          <Select
            placeholder="选择要导入的数据类型"
            value={selectedEntity || undefined}
            onChange={(value) => setSelectedEntity((value as string) ?? '')}
            style={{ width: '100%' }}
            filter
          >
            {entityGroups.map(([module, items]) => (
              <Select.OptGroup key={module} label={module}>
                {items.map((e) => <Select.Option key={e.entity} value={e.entity}>{e.title}</Select.Option>)}
              </Select.OptGroup>
            ))}
          </Select>
        </Spin>

        {entity && (
          <>
            <Descriptions
              size="small"
              row
              data={[
                { key: '字段数', value: `${entity.columns.length} 个` },
                { key: '必填字段', value: requiredColumns.length > 0 ? requiredColumns.map((c) => c.header).join('、') : '无' },
                { key: '单次上限', value: `${entity.maxRows} 行` },
              ]}
            />
            {entity.description && <Text type="tertiary" size="small">{entity.description}</Text>}
            <div>
              <Tag color="light-blue" size="small">xlsx</Tag>{' '}
              <Tag color="light-blue" size="small">csv</Tag>{' '}
              <Text type="quaternary" size="small">按模板表头定位列，逐行校验并给出行级成败明细</Text>
            </div>

            {entity.requiresContext ? (
              <Banner
                fullMode={false} type="warning" closeIcon={null}
                description={`「${entity.title}」需要业务页面上下文（如站点/栏目），请到对应模块页面使用「导入」按钮操作。`}
              />
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button
                  icon={<Download size={14} />}
                  onClick={() => void downloadImportTemplate(entity.entity, entity.title)}
                >
                  下载模板
                </Button>
                <Button
                  icon={<FileSearch size={14} />}
                  loading={submitting && dryRunRef.current}
                  onClick={() => pickFile(true)}
                >
                  预检文件
                </Button>
                <Button
                  type="primary"
                  theme="solid"
                  icon={<Upload size={14} />}
                  loading={submitting && !dryRunRef.current}
                  onClick={() => pickFile(false)}
                >
                  上传导入
                </Button>
              </div>
            )}
          </>
        )}
        {!entity && !entitiesLoading && (
          <Text type="tertiary" size="small">
            流程：下载模板 → 填写数据 → 上传提交。预检模式仅校验数据不落库，适合正式导入前试跑。
          </Text>
        )}
      </div>
    </Modal>
  );
}
