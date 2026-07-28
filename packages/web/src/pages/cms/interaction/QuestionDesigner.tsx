import { useState } from 'react';
import { Button, Input, InputNumber, Modal, Select, Switch, TextArea, Tooltip, Typography } from '@douyinfe/semi-ui';
import { ArrowDown, ArrowUp, ClipboardPaste, Copy, Plus, Trash2 } from 'lucide-react';
import { CMS_INTERACTION_QUESTION_TYPE_LABELS, type CmsInteractionKind, type CmsInteractionQuestionType } from '@zenith/shared';
import {
  applyQuestionType,
  createOption,
  createQuestion,
  duplicateOptionLabels,
  duplicateQuestion,
  moveItem,
  parseOptionsText,
  stringifyOptions,
  type QuestionDraft,
} from './question-draft';

interface QuestionDesignerProps {
  questions: QuestionDraft[];
  onChange: (next: QuestionDraft[]) => void;
  kind: CmsInteractionKind;
  /** 已收集答卷后题目结构锁定，全部只读 */
  locked: boolean;
  /** 题目 key → 错误文案 */
  errors: Map<string, string>;
}

/** 批量编辑选项：每行一个，确定后按文案回填（同名选项复用原 id，避免答卷口径漂移） */
function BulkOptionsModal({ visible, initial, onCancel, onOk }: Readonly<{
  visible: boolean;
  initial: string;
  onCancel: () => void;
  onOk: (text: string) => void;
}>) {
  const [text, setText] = useState(initial);
  return (
    <Modal
      title="批量编辑选项"
      visible={visible}
      onCancel={onCancel}
      onOk={() => onOk(text)}
      okText="覆盖选项"
      width={480}
    >
      <Typography.Text type="tertiary" size="small">每行一个选项，空行自动忽略。已有同名选项会保留原标识。</Typography.Text>
      <TextArea
        value={text}
        rows={10}
        autosize={{ minRows: 8, maxRows: 16 }}
        style={{ marginTop: 8 }}
        placeholder={'选项一\n选项二\n选项三'}
        onChange={setText}
      />
    </Modal>
  );
}

export default function QuestionDesigner({ questions, onChange, kind, locked, errors }: Readonly<QuestionDesignerProps>) {
  const [bulkIndex, setBulkIndex] = useState<number | null>(null);
  const isPoll = kind === 'poll';

  const patch = (index: number, updater: (question: QuestionDraft) => QuestionDraft) => {
    onChange(questions.map((question, i) => (i === index ? updater(question) : question)));
  };

  const typeOptions = Object.entries(CMS_INTERACTION_QUESTION_TYPE_LABELS)
    .filter(([value]) => !isPoll || value !== 'text')
    .map(([value, label]) => ({ value, label }));

  return (
    <div className="interaction-designer">
      {questions.map((question, index) => {
        const error = errors.get(question.key);
        const duplicates = duplicateOptionLabels(question.options);
        return (
          <section
            key={question.key}
            className={error ? 'interaction-question interaction-question--error' : 'interaction-question'}
          >
            <header className="interaction-question__head">
              <span className="interaction-question__no">{index + 1}</span>
              <Input
                value={question.label}
                size="large"
                disabled={locked}
                placeholder="请输入题干，例如：您对我们的整体满意度？"
                onChange={(value) => patch(index, (item) => ({ ...item, label: value }))}
              />
              <Select
                value={question.type}
                disabled={locked}
                style={{ width: 104, flexShrink: 0 }}
                optionList={typeOptions}
                onChange={(value) => patch(index, (item) => applyQuestionType(item, value as CmsInteractionQuestionType))}
              />
              <Tooltip content={question.required ? '必答题' : '选答题'}>
                <span className="interaction-question__required">
                  <Switch
                    size="small"
                    checked={question.required}
                    disabled={locked}
                    onChange={(checked) => patch(index, (item) => ({ ...item, required: checked }))}
                  />
                  必答
                </span>
              </Tooltip>
              <div className="interaction-question__ops">
                <Tooltip content="上移">
                  <Button
                    theme="borderless"
                    size="small"
                    icon={<ArrowUp size={14} />}
                    disabled={locked || index === 0}
                    aria-label="上移题目"
                    onClick={() => onChange(moveItem(questions, index, -1))}
                  />
                </Tooltip>
                <Tooltip content="下移">
                  <Button
                    theme="borderless"
                    size="small"
                    icon={<ArrowDown size={14} />}
                    disabled={locked || index === questions.length - 1}
                    aria-label="下移题目"
                    onClick={() => onChange(moveItem(questions, index, 1))}
                  />
                </Tooltip>
                <Tooltip content="复制">
                  <Button
                    theme="borderless"
                    size="small"
                    icon={<Copy size={14} />}
                    disabled={locked || isPoll}
                    aria-label="复制题目"
                    onClick={() => onChange([
                      ...questions.slice(0, index + 1),
                      duplicateQuestion(question),
                      ...questions.slice(index + 1),
                    ])}
                  />
                </Tooltip>
                <Tooltip content="删除">
                  <Button
                    theme="borderless"
                    type="danger"
                    size="small"
                    icon={<Trash2 size={14} />}
                    disabled={locked || isPoll || questions.length <= 1}
                    aria-label="删除题目"
                    onClick={() => onChange(questions.filter((_, i) => i !== index))}
                  />
                </Tooltip>
              </div>
            </header>

            {question.type === 'text' ? (
              <Typography.Text type="tertiary" size="small">文本题：前台展示为多行输入框，无需配置选项。</Typography.Text>
            ) : (
              <>
                <div className="interaction-options">
                  {question.options.map((option, optionIndex) => {
                    const isDuplicate = duplicates.has(option.label.trim());
                    return (
                      <div key={option.id} className="interaction-options__row">
                        <span className="interaction-options__mark">{question.type === 'multiple' ? '☐' : '○'}</span>
                        <Input
                          value={option.label}
                          disabled={locked}
                          placeholder={`选项 ${optionIndex + 1}`}
                          validateStatus={isDuplicate ? 'error' : 'default'}
                          onChange={(value) => patch(index, (item) => ({
                            ...item,
                            options: item.options.map((o, i) => (i === optionIndex ? { ...o, label: value } : o)),
                          }))}
                        />
                        <Button
                          theme="borderless"
                          size="small"
                          icon={<ArrowUp size={13} />}
                          disabled={locked || optionIndex === 0}
                          aria-label="上移选项"
                          onClick={() => patch(index, (item) => ({ ...item, options: moveItem(item.options, optionIndex, -1) }))}
                        />
                        <Button
                          theme="borderless"
                          size="small"
                          icon={<ArrowDown size={13} />}
                          disabled={locked || optionIndex === question.options.length - 1}
                          aria-label="下移选项"
                          onClick={() => patch(index, (item) => ({ ...item, options: moveItem(item.options, optionIndex, 1) }))}
                        />
                        <Button
                          theme="borderless"
                          type="danger"
                          size="small"
                          icon={<Trash2 size={13} />}
                          disabled={locked || question.options.length <= 2}
                          aria-label="删除选项"
                          onClick={() => patch(index, (item) => ({
                            ...item,
                            options: item.options.filter((_, i) => i !== optionIndex),
                            maxChoices: Math.min(item.maxChoices, Math.max(item.options.length - 1, 1)),
                          }))}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="interaction-question__foot">
                  <Button
                    theme="borderless"
                    size="small"
                    icon={<Plus size={13} />}
                    disabled={locked}
                    onClick={() => patch(index, (item) => ({ ...item, options: [...item.options, createOption('')] }))}
                  >
                    添加选项
                  </Button>
                  <Button
                    theme="borderless"
                    size="small"
                    icon={<ClipboardPaste size={13} />}
                    disabled={locked}
                    onClick={() => setBulkIndex(index)}
                  >
                    批量编辑
                  </Button>
                  {question.type === 'multiple' ? (
                    <span className="interaction-question__limits">
                      最少选
                      <InputNumber
                        size="small"
                        min={0}
                        max={question.options.length}
                        disabled={locked}
                        value={question.minChoices}
                        style={{ width: 68 }}
                        onChange={(value) => patch(index, (item) => ({ ...item, minChoices: Number(value) || 0 }))}
                      />
                      最多选
                      <InputNumber
                        size="small"
                        min={1}
                        max={question.options.length}
                        disabled={locked}
                        value={question.maxChoices}
                        style={{ width: 68 }}
                        onChange={(value) => patch(index, (item) => ({ ...item, maxChoices: Number(value) || 1 }))}
                      />
                      项
                    </span>
                  ) : null}
                </div>
              </>
            )}

            {error ? <Typography.Text type="danger" size="small">{error}</Typography.Text> : null}
          </section>
        );
      })}

      {!locked && !isPoll ? (
        <Button
          className="interaction-designer__add"
          icon={<Plus size={14} />}
          onClick={() => onChange([...questions, createQuestion('single')])}
        >
          添加题目
        </Button>
      ) : null}

      {bulkIndex !== null ? (
        <BulkOptionsModal
          visible
          key={bulkIndex}
          initial={stringifyOptions(questions[bulkIndex].options)}
          onCancel={() => setBulkIndex(null)}
          onOk={(text) => {
            const parsed = parseOptionsText(text, questions[bulkIndex].options);
            patch(bulkIndex, (item) => ({
              ...item,
              options: parsed.length > 0 ? parsed : item.options,
              maxChoices: Math.min(item.maxChoices, Math.max(parsed.length, 1)),
            }));
            setBulkIndex(null);
          }}
        />
      ) : null}
    </div>
  );
}
