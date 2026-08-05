import type { AiPromptScope, AiPromptTemplate, CreateAiPromptTemplateInput } from '@zenith/shared/ai';
import { request } from '@/utils/request';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface AiPromptListParams extends CrudListParams {
  keyword?: string;
  scope?: AiPromptScope;
}

const crud = createCrudQueries<AiPromptTemplate, AiPromptListParams, CreateAiPromptTemplateInput>({
  resource: 'ai-prompts',
  path: '/api/ai/prompt-templates',
  // 可用模板列表（对话角色选择器用）由模板集合派生，保存/删除后一并失效
  lookup: 'available',
  // 服务端未提供 DELETE /batch
  deleteMode: 'single',
});

export const aiPromptKeys = { ...crud.keys, available: crud.keys.lookup };

export const useAiPromptList = crud.useList;
export const useAiPromptDetail = crud.useDetail;
export const useSaveAiPrompt = crud.useSave;
export const useDeleteAiPrompts = crud.useDelete;
export const useAvailableAiPrompts = crud.useLookup;

/** 记录模板被应用为对话角色一次（使用统计，fire-and-forget 场景静默失败） */
export function recordAiPromptUse(id: number) {
  return request.post<null>(`/api/ai/prompt-templates/${id}/use`, {}, { silent: true }).catch(() => {});
}
