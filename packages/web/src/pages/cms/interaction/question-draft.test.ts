import { describe, expect, it } from 'vitest';
import {
  applyQuestionType,
  createMatrixRow,
  createOption,
  createQuestion,
  duplicateLabels,
  duplicateQuestion,
  moveItem,
  normalizePageNumbers,
  normalizeQuestions,
  parseOptionsText,
  remapConditions,
  stringifyOptions,
  validateQuestionSet,
  validateQuestions,
  type QuestionDraft,
} from './question-draft';

function choiceQuestion(labels: string[], patch: Partial<QuestionDraft> = {}): QuestionDraft {
  return {
    ...createQuestion('single'),
    label: '题干',
    options: labels.map((label) => createOption(label)),
    ...patch,
  };
}

describe('moveItem', () => {
  it('上移 / 下移交换相邻元素', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
  });

  it('越界时原样返回同一引用', () => {
    const list = ['a', 'b'];
    expect(moveItem(list, 0, -1)).toBe(list);
    expect(moveItem(list, 1, 1)).toBe(list);
    expect(moveItem(list, 5, 1)).toBe(list);
  });
});

describe('duplicateQuestion', () => {
  it('清除后端 id 并重新生成选项标识', () => {
    const source: QuestionDraft = { ...choiceQuestion(['A', 'B']), id: 7, label: '原题' };
    const copy = duplicateQuestion(source);
    expect(copy.id).toBeUndefined();
    expect(copy.key).not.toBe(source.key);
    expect(copy.label).toBe('原题（副本）');
    expect(copy.options.map((o) => o.label)).toEqual(['A', 'B']);
    expect(copy.options.map((o) => o.id)).not.toEqual(source.options.map((o) => o.id));
  });
});

describe('parseOptionsText', () => {
  it('忽略空行与首尾空白', () => {
    expect(parseOptionsText(' A \n\n B \n').map((o) => o.label)).toEqual(['A', 'B']);
  });

  it('同名选项复用原有 id / value，保持答卷口径稳定', () => {
    const existing = [createOption('A'), createOption('B')];
    const parsed = parseOptionsText('B\nA\nC', existing);
    expect(parsed.map((o) => o.label)).toEqual(['B', 'A', 'C']);
    expect(parsed[0].id).toBe(existing[1].id);
    expect(parsed[1].id).toBe(existing[0].id);
    expect(parsed[2].id).not.toBe(existing[0].id);
  });

  it('与 stringifyOptions 往返一致', () => {
    const options = [createOption('甲'), createOption('乙')];
    expect(parseOptionsText(stringifyOptions(options), options).map((o) => o.id))
      .toEqual(options.map((o) => o.id));
  });
});

describe('duplicateLabels', () => {
  it('仅返回重复出现的文案，忽略空值', () => {
    const options = [createOption('A'), createOption('A'), createOption('B'), createOption('  ')];
    expect([...duplicateLabels(options)]).toEqual(['A']);
  });
});

describe('applyQuestionType', () => {
  it('切到文本题清空选项并归零最少选择数', () => {
    const next = applyQuestionType(choiceQuestion(['A', 'B']), 'text');
    expect(next.options).toEqual([]);
    expect(next.minChoices).toBe(0);
  });

  it('文本题切回选择题时补齐默认选项', () => {
    const text = applyQuestionType(choiceQuestion(['A', 'B']), 'text');
    const single = applyQuestionType(text, 'single');
    expect(single.options).toHaveLength(2);
    expect(single.maxChoices).toBe(1);
  });

  it('类型不变时返回同一引用', () => {
    const question = choiceQuestion(['A', 'B']);
    expect(applyQuestionType(question, 'single')).toBe(question);
  });
});

describe('normalizeQuestions', () => {
  it('按顺序写 sort，裁剪空选项，并按题型收敛选择数量', () => {
    const questions = [
      choiceQuestion(['A', ' ', 'B'], { type: 'multiple', minChoices: 1, maxChoices: 5 }),
      { ...createQuestion('text'), label: ' 说说看 ', minChoices: 3 },
    ];
    const normalized = normalizeQuestions(questions);
    expect(normalized[0].sort).toBe(0);
    expect(normalized[0].options.map((o) => o.label)).toEqual(['A', 'B']);
    expect(normalized[1].sort).toBe(1);
    expect(normalized[1].label).toBe('说说看');
    expect(normalized[1].options).toEqual([]);
    expect(normalized[1].minChoices).toBe(0);
  });

  it('单选题强制 maxChoices 为 1，且不带 id 字段给新题', () => {
    const normalized = normalizeQuestions([choiceQuestion(['A', 'B'], { maxChoices: 4 })]);
    expect(normalized[0].maxChoices).toBe(1);
    expect('id' in normalized[0]).toBe(false);
  });
});

describe('validateQuestions', () => {
  it('题干为空时报错', () => {
    const question = choiceQuestion(['A', 'B'], { label: '  ' });
    expect(validateQuestions([question], 'survey').get(question.key)).toBe('题目不能为空');
  });

  it('选择题少于 2 个有效选项时报错', () => {
    const question = choiceQuestion(['A', '  ']);
    expect(validateQuestions([question], 'survey').get(question.key)).toBe('选择题至少需要 2 个选项');
  });

  it('选项重复时报错', () => {
    const question = choiceQuestion(['A', 'A']);
    expect(validateQuestions([question], 'survey').get(question.key)).toBe('选项文案不能重复');
  });

  it('多选题的选择数量区间非法时报错', () => {
    const min = choiceQuestion(['A', 'B'], { type: 'multiple', minChoices: 2, maxChoices: 1 });
    expect(validateQuestions([min], 'survey').get(min.key)).toBe('最少选择数不能大于最多选择数');
    const max = choiceQuestion(['A', 'B'], { type: 'multiple', minChoices: 1, maxChoices: 3 });
    expect(validateQuestions([max], 'survey').get(max.key)).toBe('最多选择数不能超过选项个数');
  });

  it('投票不允许非选择题', () => {
    const question = { ...createQuestion('text'), label: '说说看' };
    expect(validateQuestions([question], 'poll').get(question.key)).toBe('投票只支持单选或多选题');
    expect(validateQuestions([question], 'survey').size).toBe(0);
  });

  it('合法题目返回空 Map', () => {
    expect(validateQuestions([choiceQuestion(['A', 'B'])], 'survey').size).toBe(0);
  });
});

describe('validateQuestionSet', () => {
  it('题目为空时报错', () => {
    expect(validateQuestionSet([], 'survey')).toBe('至少配置一道题目');
  });

  it('投票必须且只能有一道题', () => {
    const questions = [choiceQuestion(['A', 'B']), choiceQuestion(['C', 'D'])];
    expect(validateQuestionSet(questions, 'poll')).toBe('投票必须且只能包含一道选择题');
    expect(validateQuestionSet(questions, 'survey')).toBeNull();
  });

  it('投票不支持分页', () => {
    expect(validateQuestionSet([choiceQuestion(['A', 'B'], { pageNo: 2 })], 'poll')).toBe('投票不支持分页');
  });
});

describe('新题型', () => {
  it('切到评分/NPS/矩阵时收敛结构', () => {
    const rating = applyQuestionType(choiceQuestion(['A', 'B']), 'rating');
    expect(rating.options).toEqual([]);
    expect(rating.ratingMax).toBe(5);
    const nps = applyQuestionType(rating, 'nps');
    expect(nps.ratingMax).toBe(10);
    const matrix = applyQuestionType(nps, 'matrix');
    expect(matrix.matrixRows.length).toBeGreaterThan(0);
    expect(matrix.options.length).toBeGreaterThan(0);
    // 矩阵切回文本时行与选项都清空
    expect(applyQuestionType(matrix, 'text').matrixRows).toEqual([]);
  });

  it('「其他」仅在单选/多选保留', () => {
    const withOther: QuestionDraft = { ...choiceQuestion(['A', 'B']), allowOther: true };
    expect(applyQuestionType(withOther, 'multiple').allowOther).toBe(true);
    expect(applyQuestionType(withOther, 'rating').allowOther).toBe(false);
  });

  it('矩阵题缺行或行重复时报错', () => {
    const noRows: QuestionDraft = { ...choiceQuestion(['A', 'B'], { type: 'matrix' }), matrixRows: [] };
    expect(validateQuestions([noRows], 'survey').get(noRows.key)).toBe('矩阵题至少配置一行');
    const dupRows: QuestionDraft = {
      ...choiceQuestion(['A', 'B'], { type: 'matrix' }),
      matrixRows: [createMatrixRow('行'), createMatrixRow('行')],
    };
    expect(validateQuestions([dupRows], 'survey').get(dupRows.key)).toBe('矩阵行文案不能重复');
  });

  it('评分上限越界时报错', () => {
    const bad = choiceQuestion([], { type: 'rating', ratingMax: 99 });
    expect(validateQuestions([bad], 'survey').get(bad.key)).toBe('评分上限需在 2-10 之间');
  });

  it('投票只允许单选/多选', () => {
    const rating = choiceQuestion([], { type: 'rating' });
    expect(validateQuestions([rating], 'poll').get(rating.key)).toBe('投票只支持单选或多选题');
  });

  it('normalizeQuestions 按题型裁掉不相关字段', () => {
    const [rating] = normalizeQuestions([choiceQuestion(['A', 'B'], { type: 'rating', allowOther: true })]);
    expect(rating.options).toEqual([]);
    expect(rating.matrixRows).toEqual([]);
    expect(rating.allowOther).toBe(false);
    const [nps] = normalizeQuestions([choiceQuestion([], { type: 'nps', ratingMax: 3 })]);
    expect(nps.ratingMax).toBe(10);
  });
});

describe('条件显示与分页', () => {
  it('条件只能依赖排在前面的单选/多选题', () => {
    const source = choiceQuestion(['A', 'B']);
    const target: QuestionDraft = {
      ...choiceQuestion([], { type: 'text' }),
      visibleWhen: { questionIndex: 1, op: 'any', values: ['A'] },
    };
    expect(validateQuestions([source, target], 'survey').get(target.key)).toBe('条件显示只能依赖排在前面的题目');
    const ok: QuestionDraft = { ...target, visibleWhen: { questionIndex: 0, op: 'any', values: ['A'] } };
    expect(validateQuestions([source, ok], 'survey').size).toBe(0);
    const empty: QuestionDraft = { ...target, visibleWhen: { questionIndex: 0, op: 'any', values: [] } };
    expect(validateQuestions([source, empty], 'survey').get(empty.key)).toBe('条件显示至少选择一个触发选项');
  });

  it('条件不能依赖非选择题', () => {
    const source = choiceQuestion([], { type: 'text' });
    const target: QuestionDraft = {
      ...choiceQuestion(['A', 'B']),
      visibleWhen: { questionIndex: 0, op: 'any', values: ['A'] },
    };
    expect(validateQuestions([source, target], 'survey').get(target.key)).toBe('条件显示只能依赖单选或多选题');
  });

  it('remapConditions 跟随题序调整引用，失效时清空', () => {
    const first = choiceQuestion(['A', 'B']);
    const second = choiceQuestion(['C', 'D']);
    const third: QuestionDraft = {
      ...choiceQuestion([], { type: 'text' }),
      visibleWhen: { questionIndex: 0, op: 'any', values: ['A'] },
    };
    // 交换前两题：引用从 0 变成 1
    const swapped = remapConditions([second, first, third], [1, 0, 2]);
    expect(swapped[2].visibleWhen?.questionIndex).toBe(1);
    // 删除被依赖的题目：条件清空
    const removed = remapConditions([second, third], [1, 2]);
    expect(removed[1].visibleWhen).toBeNull();
    // 被依赖题目移到后面：条件同样失效
    const moved = remapConditions([third, first], [2, 0]);
    expect(moved[0].visibleWhen).toBeNull();
  });

  it('normalizePageNumbers 压缩成连续页码', () => {
    const questions = [
      choiceQuestion(['A', 'B'], { pageNo: 1 }),
      choiceQuestion(['C', 'D'], { pageNo: 5 }),
      choiceQuestion(['E', 'F'], { pageNo: 9 }),
    ];
    expect(normalizePageNumbers(questions).map((q) => q.pageNo)).toEqual([1, 2, 3]);
    // 已连续时返回同一批对象引用
    const normalized = normalizePageNumbers(questions);
    expect(normalizePageNumbers(normalized)[1]).toBe(normalized[1]);
  });

  it('复制题目会清除条件引用，避免语义错位', () => {
    const source: QuestionDraft = {
      ...choiceQuestion(['A', 'B']),
      visibleWhen: { questionIndex: 0, op: 'any', values: ['A'] },
    };
    expect(duplicateQuestion(source).visibleWhen).toBeNull();
  });
});

describe('parseOptionsText 复用矩阵行标识', () => {
  it('同名行保留原 id，新行生成新 id', () => {
    const rows = [createMatrixRow('第一行'), createMatrixRow('第二行')];
    const parsed = parseOptionsText('第二行\n第三行', rows.map((row) => ({ id: row.id, label: row.label, value: row.id })));
    expect(parsed.map((row) => row.label)).toEqual(['第二行', '第三行']);
    expect(parsed[0].id).toBe(rows[1].id);
    expect(parsed[1].id).not.toBe(rows[0].id);
  });
});
