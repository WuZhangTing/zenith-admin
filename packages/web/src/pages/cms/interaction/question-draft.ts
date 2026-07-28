import type {
  CmsInteractionKind,
  CmsInteractionQuestion,
  CmsInteractionQuestionType,
} from '@zenith/shared';

export type QuestionOption = CmsInteractionQuestion['options'][number];

export interface QuestionDraft {
  /** 前端稳定 key（新建题目无后端 id 时用于 React key 与错误定位） */
  key: string;
  /** 后端题目 id，仅编辑既有题目时存在 */
  id?: number;
  label: string;
  type: CmsInteractionQuestionType;
  required: boolean;
  minChoices: number;
  maxChoices: number;
  options: QuestionOption[];
}

let keySeed = 0;
/** 生成进程内唯一的前端 key（题目 / 选项通用） */
export function nextKey(prefix: string): string {
  keySeed += 1;
  return `${prefix}-${Date.now().toString(36)}-${keySeed}`;
}

/** 选项 id 需匹配后端 `^[A-Za-z0-9_-]+$`，此处只生成合规字符 */
function nextOptionId(): string {
  keySeed += 1;
  return `opt-${Date.now().toString(36)}-${keySeed}`;
}

export function createOption(label = ''): QuestionOption {
  const id = nextOptionId();
  return { id, label, value: id };
}

export function createQuestion(type: CmsInteractionQuestionType = 'single'): QuestionDraft {
  return {
    key: nextKey('q'),
    label: '',
    type,
    required: true,
    minChoices: 1,
    maxChoices: 1,
    options: type === 'text' ? [] : [createOption('选项一'), createOption('选项二')],
  };
}

export function questionToDraft(question: CmsInteractionQuestion): QuestionDraft {
  return {
    key: nextKey('q'),
    id: question.id,
    label: question.label,
    type: question.type,
    required: question.required,
    minChoices: question.minChoices,
    maxChoices: question.maxChoices,
    options: (question.options ?? []).map((option) => ({ ...option })),
  };
}

/** 同级上移（dir=-1）/ 下移（dir=1）；越界时原样返回 */
export function moveItem<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** 复制题目：清除后端 id 与选项 id，避免与原题目冲突 */
export function duplicateQuestion(question: QuestionDraft): QuestionDraft {
  return {
    ...question,
    key: nextKey('q'),
    id: undefined,
    label: question.label ? `${question.label}（副本）` : '',
    options: question.options.map((option) => createOption(option.label)),
  };
}

/** 「每行一个」文本 → 选项数组；尽量复用同名旧选项的 id/value，保持答卷口径稳定 */
export function parseOptionsText(text: string, existing: QuestionOption[] = []): QuestionOption[] {
  const pool = new Map<string, QuestionOption[]>();
  existing.forEach((option) => {
    const bucket = pool.get(option.label);
    if (bucket) bucket.push(option);
    else pool.set(option.label, [option]);
  });
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((label) => pool.get(label)?.shift() ?? createOption(label));
}

export function stringifyOptions(options: QuestionOption[]): string {
  return options.map((option) => option.label).join('\n');
}

/** 返回重复出现的选项文案（用于行内重复提示） */
export function duplicateOptionLabels(options: QuestionOption[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  options.forEach((option) => {
    const label = option.label.trim();
    if (!label) return;
    if (seen.has(label)) duplicates.add(label);
    else seen.add(label);
  });
  return duplicates;
}

/** 切换题型时同步收敛选项与选择数量约束 */
export function applyQuestionType(question: QuestionDraft, type: CmsInteractionQuestionType): QuestionDraft {
  if (type === question.type) return question;
  if (type === 'text') {
    return { ...question, type, options: [], minChoices: 0, maxChoices: 1 };
  }
  const options = question.options.length > 0 ? question.options : [createOption('选项一'), createOption('选项二')];
  if (type === 'single') {
    return { ...question, type, options, minChoices: 1, maxChoices: 1 };
  }
  return {
    ...question,
    type,
    options,
    minChoices: Math.max(0, question.minChoices),
    maxChoices: Math.max(question.maxChoices, 1),
  };
}

/** 提交前归一化为后端 payload 结构 */
export function normalizeQuestions(questions: QuestionDraft[]) {
  return questions.map((question, index) => {
    const isText = question.type === 'text';
    const options = isText
      ? []
      : question.options
          .map((option) => ({ ...option, label: option.label.trim() }))
          .filter((option) => option.label);
    return {
      ...(question.id ? { id: question.id } : {}),
      label: question.label.trim(),
      type: question.type,
      required: question.required,
      options,
      minChoices: isText ? 0 : question.minChoices,
      maxChoices: question.type === 'single' ? 1 : question.maxChoices,
      sort: index,
    };
  });
}

/** 逐题校验，返回 `题目 key -> 错误文案`；空 Map 表示全部通过 */
export function validateQuestions(
  questions: QuestionDraft[],
  kind: CmsInteractionKind,
): Map<string, string> {
  const errors = new Map<string, string>();
  questions.forEach((question) => {
    if (!question.label.trim()) {
      errors.set(question.key, '题目不能为空');
      return;
    }
    if (kind === 'poll' && question.type === 'text') {
      errors.set(question.key, '投票不支持文本题');
      return;
    }
    if (question.type === 'text') return;
    const labels = question.options.map((option) => option.label.trim()).filter(Boolean);
    if (labels.length < 2) {
      errors.set(question.key, '选择题至少需要 2 个选项');
      return;
    }
    if (new Set(labels).size !== labels.length) {
      errors.set(question.key, '选项文案不能重复');
      return;
    }
    if (question.type === 'multiple') {
      if (question.minChoices > question.maxChoices) {
        errors.set(question.key, '最少选择数不能大于最多选择数');
        return;
      }
      if (question.maxChoices > labels.length) {
        errors.set(question.key, '最多选择数不能超过选项个数');
      }
    }
  });
  return errors;
}

/** 题目整体结构校验（数量 / 类型约束），返回首条错误文案 */
export function validateQuestionSet(
  questions: QuestionDraft[],
  kind: CmsInteractionKind,
): string | null {
  if (questions.length === 0) return '至少配置一道题目';
  if (kind === 'poll' && questions.length !== 1) return '投票必须且只能包含一道选择题';
  return null;
}
