import type { CmsInteractionKind } from '@zenith/shared';
import { createOption, createQuestion, type QuestionDraft } from './question-draft';

export interface InteractionTemplate {
  key: string;
  name: string;
  /** 模板适用的互动类型；与当前选择不一致时不展示 */
  kind: CmsInteractionKind;
  description: string;
  /** 应用模板时可回填的标题（用户已填写标题则不覆盖） */
  suggestedTitle: string;
  build: () => QuestionDraft[];
}

type Spec =
  | { label: string; type: 'single' | 'multiple'; required?: boolean; options: string[]; minChoices?: number; maxChoices?: number }
  | { label: string; type: 'text'; required?: boolean };

function build(specs: Spec[]): QuestionDraft[] {
  return specs.map((spec) => {
    const base = createQuestion(spec.type);
    if (spec.type === 'text') {
      return { ...base, label: spec.label, required: spec.required ?? false };
    }
    return {
      ...base,
      label: spec.label,
      required: spec.required ?? true,
      options: spec.options.map((label) => createOption(label)),
      minChoices: spec.type === 'single' ? 1 : (spec.minChoices ?? 1),
      maxChoices: spec.type === 'single' ? 1 : (spec.maxChoices ?? spec.options.length),
    };
  });
}

export const INTERACTION_TEMPLATES: InteractionTemplate[] = [
  {
    key: 'satisfaction',
    name: '满意度调查',
    kind: 'survey',
    description: '整体满意度 + 使用场景 + 开放建议，共 3 题',
    suggestedTitle: '产品满意度调查',
    build: () => build([
      { label: '您对我们的整体满意度？', type: 'single', options: ['非常满意', '满意', '一般', '不满意', '非常不满意'] },
      { label: '您最常使用哪些功能？（可多选）', type: 'multiple', required: false, options: ['内容浏览', '搜索', '评论互动', '会员中心', '资源下载'] },
      { label: '还有哪些建议可以帮助我们做得更好？', type: 'text' },
    ]),
  },
  {
    key: 'nps',
    name: 'NPS 净推荐值',
    kind: 'survey',
    description: '0-10 分推荐意愿 + 打分原因，共 2 题',
    suggestedTitle: 'NPS 净推荐值调研',
    build: () => build([
      {
        label: '您有多大可能把我们推荐给朋友或同事？（0 分完全不可能，10 分极有可能）',
        type: 'single',
        options: ['0 分', '1 分', '2 分', '3 分', '4 分', '5 分', '6 分', '7 分', '8 分', '9 分', '10 分'],
      },
      { label: '给出这个分数的主要原因是什么？', type: 'text' },
    ]),
  },
  {
    key: 'signup',
    name: '活动报名',
    kind: 'survey',
    description: '场次选择 + 参与方式 + 备注，共 3 题',
    suggestedTitle: '活动报名登记',
    build: () => build([
      { label: '您希望参加哪个场次？', type: 'single', options: ['上午场（09:30-12:00）', '下午场（14:00-16:30）', '晚间场（19:00-21:00）'] },
      { label: '您计划以何种方式参与？', type: 'single', options: ['线下到场', '线上直播'] },
      { label: '其他备注（餐食忌口、随行人数等）', type: 'text' },
    ]),
  },
  {
    key: 'poll',
    name: '单题投票',
    kind: 'poll',
    description: '投票专用：一道单选题，直接改选项即可',
    suggestedTitle: '大家更喜欢哪一个？',
    build: () => build([
      { label: '请选择您支持的选项', type: 'single', options: ['选项一', '选项二', '选项三'] },
    ]),
  },
];
