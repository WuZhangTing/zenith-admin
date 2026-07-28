import { CMS_INTERACTION_KIND_LABELS, type CmsInteractionKind } from '@zenith/shared';
import type { QuestionDraft } from './question-draft';

interface InteractionPreviewProps {
  kind: CmsInteractionKind;
  title: string;
  description?: string;
  questions: QuestionDraft[];
  participantScope: 'anonymous' | 'member';
  thankYouMessage: string;
}

/**
 * 前台样式仿真预览：结构对齐 default 主题 `InteractionTemplate` 渲染的
 * `.survey-question / .survey-options / .survey-option` 标记，仅用于所见即所得，
 * 所有控件均禁用，不产生任何提交。
 */
export default function InteractionPreview({
  kind,
  title,
  description,
  questions,
  participantScope,
  thankYouMessage,
}: Readonly<InteractionPreviewProps>) {
  return (
    <div className="interaction-preview">
      <div className="interaction-preview__bar">
        前台预览 · {CMS_INTERACTION_KIND_LABELS[kind]}
      </div>
      <div className="interaction-preview__page">
        <h1>{title.trim() || '未命名互动'}</h1>
        {description?.trim() ? <p className="interaction-preview__desc">{description}</p> : null}
        {participantScope === 'member' ? <p className="interaction-preview__hint">本互动仅限登录会员参与</p> : null}

        {questions.length === 0 ? (
          <p className="interaction-preview__hint">尚未添加题目</p>
        ) : questions.map((question, index) => (
          <fieldset key={question.key} className="interaction-preview__question">
            <legend>
              {index + 1}. {question.label.trim() || '未填写题干'}
              {question.required ? <span className="interaction-preview__req"> *</span> : null}
            </legend>
            {question.type === 'text' ? (
              <textarea disabled rows={3} placeholder="请输入…" />
            ) : (
              <div className="interaction-preview__options">
                {question.options.length === 0 ? (
                  <span className="interaction-preview__hint">尚未添加选项</span>
                ) : question.options.map((option) => (
                  <label key={option.id} className="interaction-preview__option">
                    <input type={question.type === 'multiple' ? 'checkbox' : 'radio'} disabled />
                    {option.label.trim() || '未填写选项'}
                  </label>
                ))}
              </div>
            )}
            {question.type === 'multiple' ? (
              <span className="interaction-preview__limits">
                可选 {question.minChoices} ~ {question.maxChoices} 项
              </span>
            ) : null}
          </fieldset>
        ))}

        <button type="button" className="interaction-preview__submit" disabled>提交</button>
        <p className="interaction-preview__thanks">提交后提示：{thankYouMessage.trim() || '感谢您的参与！'}</p>
      </div>
    </div>
  );
}
