import { useEffect } from 'react';
import { Button, Col, Form, Row, SideSheet, Spin, Toast } from '@douyinfe/semi-ui';
import type { AiProvider, AiProviderConfig } from '@zenith/shared/ai';
import type { UserAiConfig } from '@zenith/shared/identity';
import { useAiProviderDetail, useSaveAiProvider, useTestAiProviderConnection, useFetchAiProviderModels, useAiProviderList } from '@/hooks/queries/ai-providers';
import { useSaveAiUserConfig } from '@/hooks/queries/ai-user-config';
import { useEditModal } from '@/hooks/useEditModal';

const PROVIDER_OPTIONS: { value: AiProvider; label: string; disabled?: boolean }[] = [
  { value: 'openai_compatible', label: 'OpenAI Compatible' },
  { value: 'anthropic', label: 'Anthropic（原生 /v1/messages）' },
  { value: 'gemini', label: 'Google Gemini（原生 streamGenerateContent）' },
  { value: 'baidu', label: '百度千帆（暂未支持，请用兼容网关接入）', disabled: true },
];

interface FormValues {
  name: string;
  provider: AiProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  models?: string[] | null;
  capVision?: boolean;
  capTools?: boolean;
  contextWindow?: number | null;
  systemPrompt?: string | null;
  maxTokens: number;
  temperature: string;
  priceInputPerM?: number | null;
  priceOutputPerM?: number | null;
  fallbackConfigId?: number | null;
  maxConcurrent?: number | null;
  isDefault: boolean;
  isEnabled: boolean;
}

const SYSTEM_DEFAULTS: FormValues = {
  name: '',
  provider: 'openai_compatible',
  baseUrl: '',
  apiKey: '',
  model: '',
  models: [],
  capVision: false,
  capTools: false,
  contextWindow: null,
  systemPrompt: null,
  maxTokens: 4096,
  temperature: '0.7',
  priceInputPerM: null,
  priceOutputPerM: null,
  fallbackConfigId: null,
  maxConcurrent: null,
  isDefault: false,
  isEnabled: true,
};

function providerToFormValues(config: AiProviderConfig): FormValues {
  return {
    name: config.name,
    provider: config.provider,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    models: config.models ?? [],
    capVision: config.capabilities?.vision ?? false,
    capTools: config.capabilities?.tools ?? false,
    contextWindow: config.capabilities?.contextWindow ?? null,
    systemPrompt: config.systemPrompt,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
    priceInputPerM: config.priceInputPerM,
    priceOutputPerM: config.priceOutputPerM,
    fallbackConfigId: config.fallbackConfigId,
    maxConcurrent: config.maxConcurrent,
    isDefault: config.isDefault,
    isEnabled: config.isEnabled,
  };
}

function userConfigToFormValues(config: UserAiConfig): FormValues {
  return {
    ...SYSTEM_DEFAULTS,
    name: config.name ?? '',
    provider: config.provider ?? 'openai_compatible',
    baseUrl: config.baseUrl ?? '',
    apiKey: config.apiKey ?? '',
    model: config.model ?? '',
    temperature: config.temperature ?? '0.7',
    maxTokens: config.maxTokens ?? 4096,
    systemPrompt: config.systemPrompt ?? null,
    isEnabled: config.isEnabled,
  };
}

interface BaseProps {
  visible: boolean;
  onClose: () => void;
}

interface SystemModeProps extends BaseProps {
  mode?: 'system';
  editTarget?: AiProviderConfig | null;
  onSaved: () => void;
}

interface UserModeProps extends BaseProps {
  mode: 'user';
  userConfig?: UserAiConfig | null;
  onSaved: (config: UserAiConfig) => void;
}

type AiProviderFormModalProps = SystemModeProps | UserModeProps;

export default function AiProviderFormModal(props: AiProviderFormModalProps) {
  const { visible, onClose } = props;
  const isUser = props.mode === 'user';
  const editTarget = isUser ? undefined : props.editTarget;
  const existingUserConfig = isUser ? (props as { mode: 'user'; userConfig?: UserAiConfig | null }).userConfig ?? null : null;
  const allProvidersQuery = useAiProviderList({}, { enabled: visible && !isUser });
  const saveProviderMutation = useSaveAiProvider();
  const saveUserConfigMutation = useSaveAiUserConfig();
  const testConnectionMutation = useTestAiProviderConnection();
  const fetchModelsMutation = useFetchAiProviderModels();
  const systemModal = useEditModal<AiProviderConfig, FormValues, Partial<AiProviderConfig>>({
    save: saveProviderMutation,
    useDetail: useAiProviderDetail,
    defaults: SYSTEM_DEFAULTS,
    toValues: providerToFormValues,
    beforeSave: (values) => {
      const { capVision, capTools, contextWindow, models, ...rest } = values;
      return {
        ...rest,
        models: models?.filter((m) => m.trim()) ?? null,
        capabilities: {
          vision: capVision ?? false,
          tools: capTools ?? false,
          ...(contextWindow ? { contextWindow } : {}),
        },
        priceInputPerM: values.priceInputPerM ?? null,
        priceOutputPerM: values.priceOutputPerM ?? null,
        fallbackConfigId: values.fallbackConfigId || null,
        maxConcurrent: values.maxConcurrent || null,
      };
    },
    successMessage: ({ isEdit }) => (isEdit ? '修改成功' : '创建成功'),
    // 最长标签「系统提示词」5 字；双列下每列可用宽度减半，不宜再宽
    labelWidth: 92,
    onSaved: () => {
      if (props.mode !== 'user') props.onSaved();
      onClose();
    },
  });
  const userModal = useEditModal<UserAiConfig, FormValues, Partial<UserAiConfig>>({
    save: saveUserConfigMutation,
    defaults: SYSTEM_DEFAULTS,
    toValues: userConfigToFormValues,
    beforeSave: (values) => ({
      name: values.name || null,
      provider: values.provider,
      baseUrl: values.baseUrl || null,
      apiKey: values.apiKey || null,
      model: values.model || null,
      temperature: values.temperature || null,
      maxTokens: values.maxTokens || null,
      systemPrompt: values.systemPrompt || null,
      isEnabled: values.isEnabled,
    }),
    successMessage: () => '保存成功',
    labelWidth: 92,
    onSaved: (saved) => {
      if (props.mode === 'user') props.onSaved(saved);
      onClose();
    },
  });

  useEffect(() => {
    if (!visible) {
      systemModal.close();
      userModal.close();
      return;
    }
    if (isUser) {
      if (existingUserConfig) userModal.openEdit(existingUserConfig);
      else userModal.openCreate();
    } else if (editTarget) {
      systemModal.openEdit(editTarget);
    } else {
      systemModal.openCreate();
    }
  }, [visible, isUser, existingUserConfig, editTarget, systemModal.openCreate, systemModal.openEdit, systemModal.close, userModal.openCreate, userModal.openEdit, userModal.close]);

  const activeModal = isUser ? userModal : systemModal;
  const isEditing = activeModal.isEdit;
  const submitLoading = saveProviderMutation.isPending || saveUserConfigMutation.isPending;
  const detailLoading = !isUser && systemModal.detailLoading;
  const testLoading = testConnectionMutation.isPending;
  let title = '新增服务商';
  if (isUser) title = '我的 AI 配置';
  else if (editTarget) title = '编辑服务商';

  /** 从供应商 API 自动发现模型列表，填充附加模型字段 */
  const handleFetchModels = async () => {
    const formApi = activeModal.formApi.current as ({ getValues: () => FormValues; setValue: (field: string, value: unknown) => void } | null);
    if (!formApi) return;
    const values = formApi.getValues();
    if (!values.baseUrl) {
      Toast.warning('请先填写 API 地址');
      return;
    }
    try {
      const body: { id?: number; provider?: string; baseUrl: string; apiKey?: string } = {
        provider: values.provider ?? 'openai_compatible',
        baseUrl: values.baseUrl,
      };
      const apiKey = values.apiKey ?? '';
      if (editTarget?.id && (!apiKey || apiKey.includes('...') || apiKey === '******')) {
        body.id = editTarget.id;
      } else if (apiKey) {
        body.apiKey = apiKey;
      }
      const models = await fetchModelsMutation.mutateAsync(body);
      if (models.length === 0) {
        Toast.info('未发现可用模型');
        return;
      }
      formApi.setValue('models', models);
      Toast.success(`已获取 ${models.length} 个模型`);
    } catch {
      // handled by request interceptor
    }
  };

  const handleTestConnection = async () => {
    const formApi = activeModal.formApi.current as ({ getValues: () => FormValues } | null);
    if (!formApi) return;
    const values = formApi.getValues();
    if (!values.baseUrl || !values.model) {
      Toast.warning('请先填写 API 地址和模型名称');
      return;
    }
    try {
      const body: {
        id?: number;
        provider?: AiProvider;
        baseUrl: string;
        apiKey?: string;
        model: string;
      } = {
        provider: values.provider ?? 'openai_compatible',
        baseUrl: values.baseUrl,
        model: values.model,
      };
      // 有 id 时（编辑模式），若 apiKey 为空或含脱敏标记，传 id 让后端取真实密钥
      const id = editTarget?.id;
      const apiKey = values.apiKey ?? '';
      if (id && (!apiKey || apiKey.includes('...') || apiKey === '******')) {
        body.id = id;
      } else if (apiKey) {
        body.apiKey = apiKey;
      }

      const res = await testConnectionMutation.mutateAsync(body);
      if (res.success) {
        Toast.success('连接测试成功');
      } else {
        Toast.error(`连接测试失败：${res.message ?? '未知错误'}`);
      }
    } catch {
      // handled by request interceptor
    }
  };

  return (
    <SideSheet
      title={title}
      visible={activeModal.visible}
      onCancel={() => { activeModal.close(); onClose(); }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <Button loading={testLoading} disabled={detailLoading} onClick={() => void handleTestConnection()}>
            测试连接
          </Button>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="tertiary" disabled={submitLoading || testLoading} onClick={() => { activeModal.close(); onClose(); }}>取消</Button>
            <Button type="primary" theme="solid" loading={submitLoading} disabled={detailLoading || testLoading} onClick={() => void activeModal.modalProps.onOk()}>确定</Button>
          </div>
        </div>
      }
      width={720}
      closeOnEsc
    >
      {detailLoading ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <Spin />
        </div>
      ) : (
        <Form
          {...activeModal.formProps}
        >
          <Form.Section text="接入信息">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Input field="name" label="名称" rules={[{ required: true, message: '请输入名称' }]} />
              </Col>
              <Col span={12}>
                <Form.Select field="provider" label="供应商" optionList={PROVIDER_OPTIONS} style={{ width: '100%' }} />
              </Col>
            </Row>
            <Form.Input
              field="baseUrl"
              label="API 地址"
              rules={[{ required: true, message: '请输入 API 地址' }]}
              placeholder="https://api.openai.com/v1"
            />
            <Form.Input
              field="apiKey"
              label="API Key"
              rules={isEditing ? undefined : [{ required: true, message: '请输入 API Key' }]}
              mode="password"
              placeholder={isEditing ? '留空保留原值' : ''}
            />
          </Form.Section>

          <Form.Section text="模型">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Input field="model" label="默认模型" rules={[{ required: true, message: '请输入模型名称' }]} placeholder="gpt-4o" />
              </Col>
              <Col span={12}>
                <Form.Input field="temperature" label="温度" placeholder="0.7" extraText="0–2，越大越发散" />
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.InputNumber field="maxTokens" label="最大 Token" min={1} max={128000} style={{ width: '100%' }} />
              </Col>
              {!isUser && (
                <Col span={12}>
                  <Form.InputNumber field="contextWindow" label="上下文窗口" min={0} placeholder="可选" style={{ width: '100%' }} extraText="单位 Token" />
                </Col>
              )}
            </Row>
            {!isUser && (
              <>
                <Form.TagInput
                  field="models"
                  label="附加模型"
                  placeholder="输入模型名后回车添加，或点击右侧「从 API 获取」"
                  allowDuplicates={false}
                  extraText={(
                    <span>
                      同一服务商的多个模型，聊天时可切换
                      <Button
                        theme="borderless"
                        type="primary"
                        size="small"
                        loading={fetchModelsMutation.isPending}
                        style={{ marginLeft: 4 }}
                        onClick={() => void handleFetchModels()}
                      >
                        从 API 获取
                      </Button>
                    </span>
                  )}
                />
                <Form.Slot label="模型能力">
                  <div style={{ display: 'flex', gap: 24 }}>
                    <Form.Switch field="capVision" noLabel label="图片理解" extraText="支持图片理解" />
                    <Form.Switch field="capTools" noLabel label="函数调用" extraText="支持函数调用" />
                  </div>
                </Form.Slot>
              </>
            )}
          </Form.Section>

          {!isUser && (
            <Form.Section text="成本与可靠性">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.InputNumber field="priceInputPerM" label="输入单价" min={0} placeholder="留空不计成本" style={{ width: '100%' }} extraText="分 / 百万 Token" />
                </Col>
                <Col span={12}>
                  <Form.InputNumber field="priceOutputPerM" label="输出单价" min={0} placeholder="留空不计成本" style={{ width: '100%' }} extraText="分 / 百万 Token" />
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Select
                    field="fallbackConfigId"
                    label="降级配置"
                    placeholder="不启用主备切换"
                    showClear
                    style={{ width: '100%' }}
                    extraText="首字返回前失败时自动切换"
                    optionList={(allProvidersQuery.data ?? [])
                      .filter((pr) => pr.id !== editTarget?.id && pr.isEnabled)
                      .map((pr) => ({ value: pr.id, label: `${pr.name}（${pr.model}）` }))}
                  />
                </Col>
                <Col span={12}>
                  <Form.InputNumber field="maxConcurrent" label="并发上限" min={0} max={1000} placeholder="留空不限制" style={{ width: '100%' }} extraText="同时进行的流式请求数" />
                </Col>
              </Row>
            </Form.Section>
          )}

          <Form.Section text="其他">
            <Form.TextArea
              field="systemPrompt"
              label="系统提示词"
              rows={3}
              placeholder="可选，为空则使用默认提示词"
            />
            <Form.Slot label="状态">
              <div style={{ display: 'flex', gap: 24 }}>
                {!isUser && <Form.Switch field="isDefault" noLabel label="默认" extraText="设为默认服务商" />}
                <Form.Switch field="isEnabled" noLabel label="启用" extraText={isUser ? '启用此配置' : '启用此服务商'} />
              </div>
            </Form.Slot>
          </Form.Section>
        </Form>
      )}
    </SideSheet>
  );
}
