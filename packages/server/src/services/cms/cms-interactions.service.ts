import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  sql,
  type SQL,
} from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import {
  createCmsInteractionSchema,
  CMS_INTERACTION_CHOICE_QUESTION_TYPES,
  CMS_INTERACTION_MATRIX_SEPARATOR,
  CMS_INTERACTION_NPS_MAX,
  CMS_INTERACTION_OTHER_PREFIX,
  CMS_INTERACTION_OTHER_VALUE,
  type CmsInteractionAnswerDetail,
  type CmsInteractionKind,
  type CmsInteractionQuestionType,
  type CmsInteractionRepeatPolicy,
  type CmsInteractionResponse,
  type CmsInteractionPublicStats,
  type CmsInteractionQuestionStats,
  type CmsInteractionStats,
  type CreateCmsInteractionInput,
  type SubmitCmsInteractionInput,
  type UpdateCmsInteractionInput,
} from '@zenith/shared';
import { db } from '../../db';
import {
  cmsInteractionAnswers,
  cmsInteractionQuestions,
  cmsInteractionResponses,
  cmsInteractions,
  cmsSites,
  members,
} from '../../db/schema';
import type {
  CmsInteractionQuestionRow,
  CmsInteractionRow,
} from '../../db/schema';
import type { DbExecutor } from '../../db/types';
import { formatDateTime, formatNullableDateTime, parseDateRangeEnd, parseDateRangeStart, parseDateTimeInput } from '../../lib/datetime';
import { rethrowPgUniqueViolation } from '../../lib/db-errors';
import { maskEmail, maskName, maskPhone } from '../../lib/masking';
import { escapeLike, withPagination } from '../../lib/where-helpers';
import { streamByDescendingId } from '../../lib/export-center/cursor-stream';
import { assertSiteAccess, ensureCmsSiteExists } from './cms-sites.service';
import { isCaptchaEnabled } from './cms-captcha.service';
import {
  type CmsResolvedCaptchaProvider,
  verifyCmsCaptchaAdapter,
} from './cms-captcha-adapter.service';
import { hashCmsRequestKey, hashCmsVisitor, hashCmsIp } from './cms-visitor';

/** 与 schema 中 `cms_interactions.code` / `.title` 的列长度保持一致 */
const CMS_INTERACTION_CODE_MAX = 50;
const CMS_INTERACTION_TITLE_MAX = 200;
const COPY_TITLE_SUFFIX = '（副本）';

export function mapCmsInteractionQuestion(row: CmsInteractionQuestionRow) {
  return {
    id: row.id,
    interactionId: row.interactionId,
    label: row.label,
    type: row.type,
    required: row.required,
    options: row.options ?? [],
    minChoices: row.minChoices,
    maxChoices: row.maxChoices,
    sort: row.sort,
    allowOther: row.allowOther,
    otherLabel: row.otherLabel ?? null,
    ratingMax: row.ratingMax,
    matrixRows: row.matrixRows ?? [],
    pageNo: row.pageNo,
    visibleWhen: row.visibleWhen ?? null,
  };
}

export function mapCmsInteraction(row: CmsInteractionRow, questions?: CmsInteractionQuestionRow[]) {
  return {
    id: row.id,
    siteId: row.siteId,
    code: row.code,
    kind: row.kind,
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    participantScope: row.participantScope,
    repeatPolicy: row.repeatPolicy,
    resultVisibility: row.resultVisibility,
    captchaPolicy: row.captchaPolicy,
    turnstileSiteKey: row.turnstileSiteKey ?? null,
    turnstileSecretConfigured: !!row.turnstileSecret,
    thankYouMessage: row.thankYouMessage,
    startAt: formatNullableDateTime(row.startAt),
    endAt: formatNullableDateTime(row.endAt),
    responseCount: row.responseCount,
    ...(questions
      ? { questions: [...questions].sort((a, b) => a.sort - b.sort || a.id - b.id).map(mapCmsInteractionQuestion) }
      : {}),
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

export async function ensureCmsInteractionExists(id: number): Promise<CmsInteractionRow> {
  const [row] = await db.select().from(cmsInteractions).where(eq(cmsInteractions.id, id)).limit(1);
  if (!row) throw new HTTPException(404, { message: '互动问卷不存在' });
  return row;
}

export interface ListCmsInteractionsQuery {
  siteId: number;
  keyword?: string;
  kind?: CmsInteractionKind;
  status?: 'draft' | 'published' | 'closed';
  page: number;
  pageSize: number;
}

export async function listCmsInteractions(q: ListCmsInteractionsQuery) {
  await ensureCmsSiteExists(q.siteId);
  await assertSiteAccess(q.siteId);
  const conditions: SQL[] = [eq(cmsInteractions.siteId, q.siteId)];
  if (q.keyword) conditions.push(ilike(cmsInteractions.title, `%${escapeLike(q.keyword)}%`));
  if (q.kind) conditions.push(eq(cmsInteractions.kind, q.kind));
  if (q.status) conditions.push(eq(cmsInteractions.status, q.status));
  const where = and(...conditions);
  const [total, rows] = await Promise.all([
    db.$count(cmsInteractions, where),
    withPagination(
      db.select().from(cmsInteractions).where(where).orderBy(desc(cmsInteractions.id)).$dynamic(),
      q.page,
      q.pageSize,
    ),
  ]);
  return { list: rows.map((row) => mapCmsInteraction(row)), total, page: q.page, pageSize: q.pageSize };
}

export async function getCmsInteraction(id: number) {
  const current = await ensureCmsInteractionExists(id);
  await assertSiteAccess(current.siteId);
  const row = await db.query.cmsInteractions.findFirst({
    where: eq(cmsInteractions.id, id),
    with: { questions: true },
  });
  if (!row) throw new HTTPException(404, { message: '互动问卷不存在' });
  return mapCmsInteraction(row, row.questions);
}

function assertInteractionDefinition(input: CreateCmsInteractionInput): void {
  const parsed = createCmsInteractionSchema.safeParse(input);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? '互动问卷配置无效' });
  }
}

async function replaceInteractionQuestions(
  tx: DbExecutor,
  interactionId: number,
  questions: CreateCmsInteractionInput['questions'],
): Promise<void> {
  await tx.delete(cmsInteractionQuestions).where(eq(cmsInteractionQuestions.interactionId, interactionId));
  await tx.insert(cmsInteractionQuestions).values(questions.map((question, index) => {
    const type = question.type ?? 'single';
    const isChoice = (CMS_INTERACTION_CHOICE_QUESTION_TYPES as readonly string[]).includes(type);
    return {
      interactionId,
      label: question.label,
      type,
      required: question.required ?? true,
      options: isChoice ? (question.options ?? []) : [],
      minChoices: type === 'multiple' ? (question.minChoices ?? 1) : (type === 'single' ? 1 : 0),
      maxChoices: type === 'multiple' ? (question.maxChoices ?? 1) : 1,
      sort: question.sort ?? index,
      allowOther: (type === 'single' || type === 'multiple') && (question.allowOther ?? false),
      otherLabel: question.otherLabel?.trim() || null,
      ratingMax: type === 'nps' ? CMS_INTERACTION_NPS_MAX : (question.ratingMax ?? 5),
      matrixRows: type === 'matrix' ? (question.matrixRows ?? []) : [],
      pageNo: question.pageNo ?? 1,
      visibleWhen: question.visibleWhen
        ? { ...question.visibleWhen, op: question.visibleWhen.op ?? 'any' }
        : null,
    };
  }));
}

export async function createCmsInteraction(input: CreateCmsInteractionInput) {
  await ensureCmsSiteExists(input.siteId);
  await assertSiteAccess(input.siteId);
  assertInteractionDefinition(input);
  const { questions, startAt, endAt } = input;
  try {
    const id = await db.transaction(async (tx) => {
      const [row] = await tx.insert(cmsInteractions).values({
        siteId: input.siteId,
        code: input.code,
        kind: input.kind ?? 'survey',
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? 'draft',
        participantScope: input.participantScope ?? 'anonymous',
        repeatPolicy: input.repeatPolicy ?? 'once_per_ip',
        resultVisibility: input.resultVisibility ?? 'after_submit',
        captchaPolicy: input.captchaPolicy ?? 'inherit',
        turnstileSiteKey: input.turnstileSiteKey ?? null,
        turnstileSecret: input.turnstileSecret ?? null,
        thankYouMessage: input.thankYouMessage ?? '感谢您的参与！',
        startAt: parseDateTimeInput(startAt),
        endAt: parseDateTimeInput(endAt),
      }).returning({ id: cmsInteractions.id });
      await replaceInteractionQuestions(tx, row.id, questions);
      return row.id;
    });
    return getCmsInteraction(id);
  } catch (error) {
    rethrowPgUniqueViolation(error, '同站点下互动标识已存在');
  }
}

export async function updateCmsInteraction(id: number, input: UpdateCmsInteractionInput) {
  const initial = await ensureCmsInteractionExists(id);
  await assertSiteAccess(initial.siteId);
  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(cmsInteractions)
      .where(eq(cmsInteractions.id, id))
      .for('update')
      .limit(1);
    if (!current) throw new HTTPException(404, { message: '互动问卷不存在' });
    if (input.questions && current.responseCount > 0) {
      throw new HTTPException(409, { message: '已有答卷的互动问卷不可替换题目；请用「复制」生成副本后修改' });
    }
    const currentQuestions = await tx.select().from(cmsInteractionQuestions)
      .where(eq(cmsInteractionQuestions.interactionId, id))
      .orderBy(asc(cmsInteractionQuestions.sort), asc(cmsInteractionQuestions.id));
    const merged = {
      siteId: current.siteId,
      code: current.code,
      kind: input.kind ?? current.kind,
      title: input.title ?? current.title,
      description: input.description === undefined ? current.description : input.description,
      status: input.status ?? current.status,
      participantScope: input.participantScope ?? current.participantScope,
      repeatPolicy: input.repeatPolicy ?? current.repeatPolicy,
      resultVisibility: input.resultVisibility ?? current.resultVisibility,
      captchaPolicy: input.captchaPolicy ?? current.captchaPolicy,
      turnstileSiteKey: input.turnstileSiteKey === undefined ? current.turnstileSiteKey : input.turnstileSiteKey,
      turnstileSecret: input.turnstileSecret === undefined ? current.turnstileSecret : input.turnstileSecret,
      thankYouMessage: input.thankYouMessage ?? current.thankYouMessage,
      startAt: input.startAt === undefined ? formatNullableDateTime(current.startAt) : input.startAt,
      endAt: input.endAt === undefined ? formatNullableDateTime(current.endAt) : input.endAt,
      questions: input.questions ?? currentQuestions.map((question) => ({
        id: question.id,
        label: question.label,
        type: question.type,
        required: question.required,
        options: question.options,
        minChoices: question.minChoices,
        maxChoices: question.maxChoices,
        sort: question.sort,
      })),
    } satisfies CreateCmsInteractionInput;
    assertInteractionDefinition(merged);
    const { questions, startAt, endAt, turnstileSecret, ...rest } = input;
    await tx.update(cmsInteractions).set({
      ...rest,
      ...(turnstileSecret !== undefined
        ? { turnstileSecret: turnstileSecret?.trim() || null }
        : {}),
      ...(startAt !== undefined ? { startAt: parseDateTimeInput(startAt) } : {}),
      ...(endAt !== undefined ? { endAt: parseDateTimeInput(endAt) } : {}),
    }).where(eq(cmsInteractions.id, id));
    if (questions) await replaceInteractionQuestions(tx, id, questions);
  });
  return getCmsInteraction(id);
}

export async function setCmsInteractionStatus(id: number, status: 'draft' | 'published' | 'closed') {
  const current = await ensureCmsInteractionExists(id);
  await assertSiteAccess(current.siteId);
  if (status === 'draft' && current.responseCount > 0) {
    throw new HTTPException(409, { message: '已有答卷的互动问卷不能退回草稿' });
  }
  const [row] = await db.update(cmsInteractions).set({ status }).where(eq(cmsInteractions.id, id)).returning();
  return mapCmsInteraction(row);
}

export async function deleteCmsInteraction(id: number): Promise<void> {
  const current = await ensureCmsInteractionExists(id);
  await assertSiteAccess(current.siteId);
  await db.delete(cmsInteractions).where(eq(cmsInteractions.id, id));
}

/** 去掉已有的 `-copy` / `-copy-N` 后缀，避免复制副本时无限累加 */
export function interactionCodeStem(code: string): string {
  return code.replace(/-copy(?:-\d+)?$/, '') || code;
}

/** 在已占用标识集合中挑一个未使用的副本标识，并保证不超过列长度上限 */
export function nextInteractionCopyCode(baseCode: string, taken: ReadonlySet<string>): string {
  const stem = interactionCodeStem(baseCode);
  for (let index = 1; index <= 100; index += 1) {
    const suffix = index === 1 ? '-copy' : `-copy-${index}`;
    const candidate = `${stem.slice(0, CMS_INTERACTION_CODE_MAX - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new HTTPException(400, { message: '副本过多，请先清理已有副本或手动指定标识' });
}

/** 在站点内找一个未被占用的副本标识 */
async function nextAvailableInteractionCode(siteId: number, baseCode: string): Promise<string> {
  const stem = interactionCodeStem(baseCode);
  const rows = await db.select({ code: cmsInteractions.code })
    .from(cmsInteractions)
    .where(and(
      eq(cmsInteractions.siteId, siteId),
      ilike(cmsInteractions.code, `${escapeLike(stem)}-copy%`),
    ));
  return nextInteractionCopyCode(baseCode, new Set(rows.map((row) => row.code)));
}

/**
 * 复制互动问卷：配置与题目全量克隆，标识自动去重，状态强制为草稿且答卷数归零。
 * 「已有答卷不可替换题目」时的官方出路。
 */
export async function copyCmsInteraction(id: number) {
  const current = await ensureCmsInteractionExists(id);
  await assertSiteAccess(current.siteId);
  const questions = await db.select().from(cmsInteractionQuestions)
    .where(eq(cmsInteractionQuestions.interactionId, id))
    .orderBy(asc(cmsInteractionQuestions.sort), asc(cmsInteractionQuestions.id));
  const code = await nextAvailableInteractionCode(current.siteId, current.code);
  const title = `${current.title.slice(0, CMS_INTERACTION_TITLE_MAX - COPY_TITLE_SUFFIX.length)}${COPY_TITLE_SUFFIX}`;
  try {
    const newId = await db.transaction(async (tx) => {
      const [row] = await tx.insert(cmsInteractions).values({
        siteId: current.siteId,
        code,
        kind: current.kind,
        title,
        description: current.description,
        status: 'draft',
        participantScope: current.participantScope,
        repeatPolicy: current.repeatPolicy,
        resultVisibility: current.resultVisibility,
        captchaPolicy: current.captchaPolicy,
        turnstileSiteKey: current.turnstileSiteKey,
        turnstileSecret: current.turnstileSecret,
        thankYouMessage: current.thankYouMessage,
        startAt: current.startAt,
        endAt: current.endAt,
      }).returning({ id: cmsInteractions.id });
      if (questions.length > 0) {
        await tx.insert(cmsInteractionQuestions).values(questions.map((question) => ({
          interactionId: row.id,
          label: question.label,
          type: question.type,
          required: question.required,
          options: question.options ?? [],
          minChoices: question.minChoices,
          maxChoices: question.maxChoices,
          sort: question.sort,
        })));
      }
      return row.id;
    });
    return getCmsInteraction(newId);
  } catch (error) {
    rethrowPgUniqueViolation(error, '同站点下互动标识已存在');
  }
}

function isInteractionOpen(row: CmsInteractionRow, now = new Date()): boolean {
  if (row.status !== 'published') return false;
  if (row.startAt && now < row.startAt) return false;
  if (row.endAt && now > row.endAt) return false;
  return true;
}

export async function getPublicCmsInteractionByCode(siteId: number, code: string) {
  const row = await db.query.cmsInteractions.findFirst({
    where: and(
      eq(cmsInteractions.siteId, siteId),
      eq(cmsInteractions.code, code),
      inArray(cmsInteractions.status, ['published', 'closed']),
    ),
    with: { questions: true },
  });
  return row ?? null;
}

export async function getPublicCmsInteractionById(id: number) {
  const row = await db.query.cmsInteractions.findFirst({
    where: and(eq(cmsInteractions.id, id), inArray(cmsInteractions.status, ['published', 'closed'])),
    with: { questions: true },
  });
  return row ?? null;
}

function repeatKeyFor(
  policy: CmsInteractionRepeatPolicy,
  memberId: number | null,
  ipHash: string,
): string | null {
  if (policy === 'multiple') return null;
  if (policy === 'once_per_member') {
    if (!memberId) throw new HTTPException(401, { message: '该互动仅限登录会员参与' });
    return `m:${memberId}`;
  }
  return `i:${ipHash}`;
}

/** 「其他」答案：`__other__` 或 `__other__:自由文本` */
function isOtherAnswer(value: string): boolean {
  return value === CMS_INTERACTION_OTHER_VALUE || value.startsWith(CMS_INTERACTION_OTHER_PREFIX);
}

/** 判断条件显示题目在本次作答下是否可见；不可见的题目不参与必答校验也不落库 */
function isQuestionVisible(
  question: CmsInteractionQuestionRow,
  questionsBySort: CmsInteractionQuestionRow[],
  answered: Map<number, string[]>,
): boolean {
  const rule = question.visibleWhen;
  if (!rule) return true;
  const source = questionsBySort[rule.questionIndex];
  if (!source) return true;
  const picked = answered.get(source.id) ?? [];
  const hit = picked.some((value) => rule.values.includes(value));
  return rule.op === 'none' ? !hit : hit;
}

function assertChoiceAnswers(
  question: CmsInteractionQuestionRow,
  values: string[],
): void {
  const allowed = new Set((question.options ?? []).map((option) => option.value));
  const invalid = values.filter((value) => !allowed.has(value) && !(question.allowOther && isOtherAnswer(value)));
  if (invalid.length > 0) {
    throw new HTTPException(400, { message: `题目「${question.label}」选项无效` });
  }
  if (question.allowOther && values.filter(isOtherAnswer).length > 1) {
    throw new HTTPException(400, { message: `题目「${question.label}」只能填写一项「其他」` });
  }
  const maxChoices = question.type === 'single' ? 1 : question.maxChoices;
  const minChoices = question.required ? Math.max(1, question.minChoices) : question.minChoices;
  if (values.length < minChoices || values.length > maxChoices) {
    throw new HTTPException(400, { message: `题目「${question.label}」需选择 ${minChoices}-${maxChoices} 项` });
  }
}

/** 其他填空的自由文本统一截断，防止绕过 answers 的长度上限 */
function normalizeOtherAnswer(value: string): string {
  if (!isOtherAnswer(value)) return value;
  const text = value.slice(CMS_INTERACTION_OTHER_PREFIX.length).trim();
  return text ? `${CMS_INTERACTION_OTHER_PREFIX}${text.slice(0, 200)}` : CMS_INTERACTION_OTHER_VALUE;
}

function assertMatrixAnswers(question: CmsInteractionQuestionRow, values: string[]): void {
  const rowIds = new Set((question.matrixRows ?? []).map((row) => row.id));
  const optionValues = new Set((question.options ?? []).map((option) => option.value));
  const seenRows = new Set<string>();
  for (const value of values) {
    const separator = value.indexOf(CMS_INTERACTION_MATRIX_SEPARATOR);
    const rowId = separator < 0 ? '' : value.slice(0, separator);
    const optionValue = separator < 0 ? '' : value.slice(separator + CMS_INTERACTION_MATRIX_SEPARATOR.length);
    if (!rowIds.has(rowId) || !optionValues.has(optionValue)) {
      throw new HTTPException(400, { message: `题目「${question.label}」矩阵作答无效` });
    }
    if (seenRows.has(rowId)) {
      throw new HTTPException(400, { message: `题目「${question.label}」每行只能选择一项` });
    }
    seenRows.add(rowId);
  }
  if (question.required && seenRows.size !== rowIds.size) {
    throw new HTTPException(400, { message: `题目「${question.label}」需要每行都作答` });
  }
}

function assertScaleAnswer(question: CmsInteractionQuestionRow, value: string): number {
  const parsed = Number(value);
  const max = question.type === 'nps' ? CMS_INTERACTION_NPS_MAX : question.ratingMax;
  const min = question.type === 'nps' ? 0 : 1;
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new HTTPException(400, { message: `题目「${question.label}」需在 ${min}-${max} 之间` });
  }
  return parsed;
}

function validateInteractionAnswers(
  questions: CmsInteractionQuestionRow[],
  input: SubmitCmsInteractionInput,
): Array<{ questionId: number; value: string | string[] }> {
  const result: Array<{ questionId: number; value: string | string[] }> = [];
  // 条件显示依赖题序，按 sort 排序后逐题推进，保证被依赖题已先行判定
  const ordered = [...questions].sort((a, b) => a.sort - b.sort || a.id - b.id);
  const answered = new Map<number, string[]>();
  for (const question of ordered) {
    const raw = input.answers[String(question.id)];
    const values = Array.isArray(raw)
      ? [...new Set(raw.map(String).filter(Boolean))]
      : raw === undefined || raw === ''
        ? []
        : [String(raw)];
    if (!isQuestionVisible(question, ordered, answered)) {
      // 条件未命中：即使前端误传也不落库，避免脏数据混入统计
      continue;
    }
    if (values.length === 0) {
      if (question.required) throw new HTTPException(400, { message: `题目「${question.label}」为必答题` });
      continue;
    }
    switch (question.type) {
      case 'text': {
        result.push({ questionId: question.id, value: values[0].slice(0, 2000) });
        break;
      }
      case 'rating':
      case 'nps': {
        const score = assertScaleAnswer(question, values[0]);
        result.push({ questionId: question.id, value: String(score) });
        break;
      }
      case 'number': {
        const parsed = Number(values[0]);
        if (!Number.isFinite(parsed)) {
          throw new HTTPException(400, { message: `题目「${question.label}」需填写数字` });
        }
        result.push({ questionId: question.id, value: String(parsed) });
        break;
      }
      case 'date': {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(values[0])) {
          throw new HTTPException(400, { message: `题目「${question.label}」日期格式无效` });
        }
        result.push({ questionId: question.id, value: values[0] });
        break;
      }
      case 'matrix': {
        assertMatrixAnswers(question, values);
        answered.set(question.id, values);
        result.push({ questionId: question.id, value: values });
        break;
      }
      default: {
        const normalized = values.map(normalizeOtherAnswer);
        assertChoiceAnswers(question, normalized);
        answered.set(question.id, normalized);
        result.push({ questionId: question.id, value: question.type === 'single' ? normalized[0] : normalized });
        break;
      }
    }
  }
  return result;
}

export interface CmsInteractionCaptchaConfig {
  provider: CmsResolvedCaptchaProvider;
  siteKey: string | null;
}

interface CmsInteractionCaptchaInternalConfig extends CmsInteractionCaptchaConfig {
  secret: string | null;
}

async function resolveCmsInteractionCaptchaInternal(
  interaction: CmsInteractionRow,
  executor: DbExecutor = db,
): Promise<CmsInteractionCaptchaInternalConfig> {
  if (interaction.captchaPolicy === 'none') return { provider: 'none', siteKey: null, secret: null };
  if (interaction.captchaPolicy === 'math') return { provider: 'math', siteKey: null, secret: null };
  if (interaction.captchaPolicy === 'turnstile') {
    return {
      provider: 'turnstile',
      siteKey: interaction.turnstileSiteKey ?? null,
      secret: interaction.turnstileSecret ?? null,
    };
  }
  const [site] = await executor.select().from(cmsSites).where(eq(cmsSites.id, interaction.siteId)).limit(1);
  return {
    provider: site && isCaptchaEnabled(site) ? 'math' : 'none',
    siteKey: null,
    secret: null,
  };
}

export async function resolveCmsInteractionCaptcha(
  interaction: CmsInteractionRow,
): Promise<CmsInteractionCaptchaConfig> {
  const { secret: _secret, ...config } = await resolveCmsInteractionCaptchaInternal(interaction);
  return config;
}

async function assertInteractionCaptcha(
  interaction: CmsInteractionRow,
  input: SubmitCmsInteractionInput,
  ip: string | null,
): Promise<CmsInteractionCaptchaInternalConfig> {
  const config = await resolveCmsInteractionCaptchaInternal(interaction);
  const passed = await verifyCmsCaptchaAdapter({
    provider: config.provider,
    captchaId: input.captchaId,
    captchaAnswer: input.captchaAnswer,
    turnstileToken: input.turnstileToken,
    turnstileSecret: config.secret,
    ip: ip ?? 'unknown',
  });
  if (!passed) throw new HTTPException(400, { message: '验证码验证失败，请重试' });
  return config;
}

export interface SubmitCmsInteractionMeta {
  memberId: number | null;
  ip: string | null;
  userAgent: string | null;
  idempotencyKey?: string | null;
}

export async function submitCmsInteraction(
  interaction: CmsInteractionRow & { questions: CmsInteractionQuestionRow[] },
  input: SubmitCmsInteractionInput,
  meta: SubmitCmsInteractionMeta,
): Promise<{ responseId: number; duplicate: boolean; message: string; results: CmsInteractionPublicStats | null }> {
  if (!isInteractionOpen(interaction)) throw new HTTPException(400, { message: '互动问卷未开放或已关闭' });
  if (interaction.participantScope === 'member' && !meta.memberId) {
    throw new HTTPException(401, { message: '该互动仅限登录会员参与' });
  }
  const verifiedCaptcha = await assertInteractionCaptcha(interaction, input, meta.ip);
  const ipHash = hashCmsIp(meta.ip);
  const visitorHash = hashCmsVisitor(meta.ip, meta.userAgent);
  const rawRequestKey = meta.idempotencyKey ?? input.idempotencyKey;
  const requestKey = rawRequestKey ? hashCmsRequestKey(`${interaction.id}:${rawRequestKey}`) : null;
  const transactionResult = await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(cmsInteractions)
      .where(eq(cmsInteractions.id, interaction.id))
      .for('update')
      .limit(1);
    if (!locked || !isInteractionOpen(locked)) {
      throw new HTTPException(400, { message: '互动问卷未开放或已关闭' });
    }
    if (locked.participantScope === 'member' && !meta.memberId) {
      throw new HTTPException(401, { message: '该互动仅限登录会员参与' });
    }
    const currentCaptcha = await resolveCmsInteractionCaptchaInternal(locked, tx);
    if (
      currentCaptcha.provider !== verifiedCaptcha.provider
      || currentCaptcha.siteKey !== verifiedCaptcha.siteKey
      || currentCaptcha.secret !== verifiedCaptcha.secret
    ) {
      throw new HTTPException(409, { message: '验证码策略已更新，请刷新后重试' });
    }
    const questions = await tx.select().from(cmsInteractionQuestions)
      .where(eq(cmsInteractionQuestions.interactionId, locked.id))
      .orderBy(asc(cmsInteractionQuestions.sort), asc(cmsInteractionQuestions.id));
    const answers = validateInteractionAnswers(questions, input);
    const repeatKey = repeatKeyFor(locked.repeatPolicy, meta.memberId, ipHash);
    const rows = await tx.insert(cmsInteractionResponses).values({
      interactionId: locked.id,
      memberId: meta.memberId,
      visitorHash,
      ipHash,
      repeatKey,
      requestKey,
    }).onConflictDoNothing().returning({ id: cmsInteractionResponses.id });
    const created = rows[0];
    if (created) {
      await tx.insert(cmsInteractionAnswers).values(answers.map((answer) => ({
        responseId: created.id,
        questionId: answer.questionId,
        value: answer.value,
      })));
      await tx.update(cmsInteractions)
        .set({ responseCount: sql`${cmsInteractions.responseCount} + 1` })
        .where(eq(cmsInteractions.id, locked.id));
    }
    return { responseId: created?.id ?? null, repeatKey, interaction: locked };
  });
  let responseId = transactionResult.responseId;
  let duplicate = false;
  if (!responseId) {
    const duplicateConditions: SQL[] = [eq(cmsInteractionResponses.interactionId, transactionResult.interaction.id)];
    if (requestKey) duplicateConditions.push(eq(cmsInteractionResponses.requestKey, requestKey));
    else if (transactionResult.repeatKey) duplicateConditions.push(eq(cmsInteractionResponses.repeatKey, transactionResult.repeatKey));
    else throw new HTTPException(409, { message: '请求已处理，请勿重复提交' });
    const [existing] = await db.select({ id: cmsInteractionResponses.id }).from(cmsInteractionResponses)
      .where(and(...duplicateConditions)).limit(1);
    if (!existing) throw new HTTPException(409, { message: '您已参与过本次互动' });
    if (!requestKey) throw new HTTPException(409, { message: '您已参与过本次互动' });
    responseId = existing.id;
    duplicate = true;
  }
  const finalInteraction = transactionResult.interaction;
  const canSee = finalInteraction.resultVisibility === 'always' || finalInteraction.resultVisibility === 'after_submit';
  return {
    responseId,
    duplicate,
    message: finalInteraction.thankYouMessage,
    results: canSee ? toCmsInteractionPublicStats(await getCmsInteractionStatsInternal(finalInteraction.id)) : null,
  };
}

async function hasResponded(
  interaction: CmsInteractionRow,
  meta: Pick<SubmitCmsInteractionMeta, 'memberId' | 'ip'>,
): Promise<boolean> {
  const ipHash = hashCmsIp(meta.ip);
  if (interaction.repeatPolicy === 'once_per_member' && !meta.memberId) return false;
  const repeatKey = repeatKeyFor(interaction.repeatPolicy, meta.memberId, ipHash);
  const where = repeatKey
    ? and(eq(cmsInteractionResponses.interactionId, interaction.id), eq(cmsInteractionResponses.repeatKey, repeatKey))
    : meta.memberId
      ? and(eq(cmsInteractionResponses.interactionId, interaction.id), eq(cmsInteractionResponses.memberId, meta.memberId))
      : and(eq(cmsInteractionResponses.interactionId, interaction.id), eq(cmsInteractionResponses.ipHash, ipHash));
  return (await db.$count(cmsInteractionResponses, where)) > 0;
}

export async function getCmsInteractionPublicState(
  interaction: CmsInteractionRow & { questions: CmsInteractionQuestionRow[] },
  meta: Pick<SubmitCmsInteractionMeta, 'memberId' | 'ip'>,
) {
  const submitted = await hasResponded(interaction, meta);
  const resultsVisible = canExposeCmsInteractionResults({
    visibility: interaction.resultVisibility,
    status: interaction.status,
    submitted,
  });
  const captcha = await resolveCmsInteractionCaptcha(interaction);
  return {
    interaction: {
      id: interaction.id,
      siteId: interaction.siteId,
      code: interaction.code,
      kind: interaction.kind,
      title: interaction.title,
      description: interaction.description ?? null,
      status: interaction.status,
      participantScope: interaction.participantScope,
      repeatPolicy: interaction.repeatPolicy,
      resultVisibility: interaction.resultVisibility,
      captchaPolicy: interaction.captchaPolicy,
      thankYouMessage: interaction.thankYouMessage,
      startAt: formatNullableDateTime(interaction.startAt),
      endAt: formatNullableDateTime(interaction.endAt),
      questions: [...interaction.questions]
        .sort((a, b) => a.sort - b.sort || a.id - b.id)
        .map(mapCmsInteractionQuestion),
    },
    open: isInteractionOpen(interaction),
    submitted,
    captchaRequired: captcha.provider !== 'none',
    captcha,
    resultsVisible,
    results: resultsVisible
      ? toCmsInteractionPublicStats(await getCmsInteractionStatsInternal(interaction.id))
      : null,
  };
}

/** 选项分布：给定命中计数与分母，产出带百分比的选项数组 */
function distributionOf(
  options: { id: string; label: string; value: string }[],
  counts: Map<string, number>,
  answered: number,
) {
  return options.map((option) => {
    const count = counts.get(option.value) ?? 0;
    return {
      ...option,
      count,
      percent: answered > 0 ? Math.round((count / answered) * 1000) / 10 : 0,
    };
  });
}

/** NPS 净推荐值：推荐者（9-10）占比 - 贬损者（0-6）占比 */
export function npsScoreOf(scores: number[]): number | null {
  if (scores.length === 0) return null;
  const promoters = scores.filter((score) => score >= 9).length;
  const detractors = scores.filter((score) => score <= 6).length;
  return Math.round(((promoters - detractors) / scores.length) * 1000) / 10;
}

async function getCmsInteractionStatsInternal(id: number): Promise<CmsInteractionStats> {
  const interaction = await db.query.cmsInteractions.findFirst({
    where: eq(cmsInteractions.id, id),
    with: { questions: true },
  });
  if (!interaction) throw new HTTPException(404, { message: '互动问卷不存在' });
  const answers = await db.select({
    questionId: cmsInteractionAnswers.questionId,
    value: cmsInteractionAnswers.value,
    responseId: cmsInteractionAnswers.responseId,
  })
    .from(cmsInteractionAnswers)
    .innerJoin(cmsInteractionResponses, eq(cmsInteractionAnswers.responseId, cmsInteractionResponses.id))
    .where(eq(cmsInteractionResponses.interactionId, id))
    .orderBy(desc(cmsInteractionAnswers.id))
    .limit(100_000);
  const byQuestion = new Map<number, typeof answers>();
  for (const answer of answers) {
    const list = byQuestion.get(answer.questionId) ?? [];
    list.push(answer);
    byQuestion.set(answer.questionId, list);
  }
  return {
    interactionId: id,
    responseCount: interaction.responseCount,
    questions: [...interaction.questions].sort((a, b) => a.sort - b.sort || a.id - b.id).map((question) => {
      const questionAnswers = byQuestion.get(question.id) ?? [];
      const answered = new Set(questionAnswers.map((answer) => answer.responseId)).size;
      const base = {
        id: question.id,
        label: question.label,
        type: question.type,
        options: [] as CmsInteractionQuestionStats['options'],
        texts: [] as string[],
        answered,
        average: null as number | null,
        npsScore: null as number | null,
        matrixRows: [] as CmsInteractionQuestionStats['matrixRows'],
      };

      if (question.type === 'text' || question.type === 'date') {
        return {
          ...base,
          texts: questionAnswers
            .map((answer) => answer.value)
            .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
            .slice(0, 50),
        };
      }

      if (question.type === 'rating' || question.type === 'nps' || question.type === 'number') {
        const scores = questionAnswers
          .map((answer) => Number(Array.isArray(answer.value) ? answer.value[0] : answer.value))
          .filter((score) => Number.isFinite(score));
        const average = scores.length > 0
          ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100
          : null;
        // 评分/NPS 同时给出分值分布，便于前台画柱状图
        const buckets = new Map<string, number>();
        for (const score of scores) buckets.set(String(score), (buckets.get(String(score)) ?? 0) + 1);
        const scale = question.type === 'nps'
          ? Array.from({ length: CMS_INTERACTION_NPS_MAX + 1 }, (_, index) => String(index))
          : Array.from({ length: question.ratingMax }, (_, index) => String(index + 1));
        const scaleOptions = question.type === 'number'
          ? []
          : scale.map((value) => ({ id: value, label: `${value} 分`, value }));
        return {
          ...base,
          options: distributionOf(scaleOptions, buckets, answered),
          average,
          npsScore: question.type === 'nps' ? npsScoreOf(scores) : null,
        };
      }

      if (question.type === 'matrix') {
        const rowCounts = new Map<string, Map<string, number>>();
        const rowAnswered = new Map<string, Set<number>>();
        for (const answer of questionAnswers) {
          const values = Array.isArray(answer.value) ? answer.value : [answer.value];
          for (const value of values) {
            const separator = value.indexOf(CMS_INTERACTION_MATRIX_SEPARATOR);
            if (separator < 0) continue;
            const rowId = value.slice(0, separator);
            const optionValue = value.slice(separator + CMS_INTERACTION_MATRIX_SEPARATOR.length);
            const counts = rowCounts.get(rowId) ?? new Map<string, number>();
            counts.set(optionValue, (counts.get(optionValue) ?? 0) + 1);
            rowCounts.set(rowId, counts);
            const responders = rowAnswered.get(rowId) ?? new Set<number>();
            responders.add(answer.responseId);
            rowAnswered.set(rowId, responders);
          }
        }
        return {
          ...base,
          matrixRows: (question.matrixRows ?? []).map((row) => ({
            id: row.id,
            label: row.label,
            options: distributionOf(
              question.options ?? [],
              rowCounts.get(row.id) ?? new Map(),
              rowAnswered.get(row.id)?.size ?? 0,
            ),
          })),
        };
      }

      // 单选 / 多选：「其他」不论自由文本内容如何，统一归入同一个桶
      const counts = new Map<string, number>();
      let otherCount = 0;
      for (const answer of questionAnswers) {
        const values = Array.isArray(answer.value) ? answer.value : [answer.value];
        for (const value of values) {
          if (isOtherAnswer(value)) otherCount += 1;
          else counts.set(value, (counts.get(value) ?? 0) + 1);
        }
      }
      const options = [...(question.options ?? [])];
      if (question.allowOther) {
        options.push({
          id: CMS_INTERACTION_OTHER_VALUE,
          label: question.otherLabel?.trim() || '其他',
          value: CMS_INTERACTION_OTHER_VALUE,
        });
        counts.set(CMS_INTERACTION_OTHER_VALUE, otherCount);
      }
      return {
        ...base,
        options: distributionOf(options, counts, answered),
        // 「其他」的自由文本作为文本答案一并回传，运营才看得到写了什么
        texts: question.allowOther
          ? questionAnswers
              .flatMap((answer) => (Array.isArray(answer.value) ? answer.value : [answer.value]))
              .filter((value) => value.startsWith(CMS_INTERACTION_OTHER_PREFIX))
              .map((value) => value.slice(CMS_INTERACTION_OTHER_PREFIX.length))
              .slice(0, 50)
          : [],
      };
    }),
  };
}

export function toCmsInteractionPublicStats(stats: CmsInteractionStats): CmsInteractionPublicStats {
  return {
    interactionId: stats.interactionId,
    responseCount: stats.responseCount,
    questions: stats.questions.map((question) => ({
      id: question.id,
      label: question.label,
      type: question.type,
      options: question.options.map((option) => ({ ...option })),
      average: question.average,
      npsScore: question.npsScore,
    })),
  };
}

export async function getCmsInteractionStats(id: number): Promise<CmsInteractionStats> {
  const current = await ensureCmsInteractionExists(id);
  await assertSiteAccess(current.siteId);
  return getCmsInteractionStatsInternal(id);
}

function maskedMember(row: {
  nickname: string | null;
  username: string | null;
  phone: string | null;
  email: string | null;
}): string {
  if (row.nickname) return maskName(row.nickname);
  if (row.username) return maskName(row.username);
  if (row.phone) return maskPhone(row.phone);
  if (row.email) return maskEmail(row.email);
  return '游客';
}

export interface ListCmsInteractionResponsesQuery {
  siteId: number;
  interactionId?: number;
  kind?: CmsInteractionKind;
  startTime?: string;
  endTime?: string;
  page: number;
  pageSize: number;
}

export function buildCmsInteractionResponseWhere(
  q: Omit<ListCmsInteractionResponsesQuery, 'page' | 'pageSize'>,
): SQL {
  const conditions: SQL[] = [eq(cmsInteractions.siteId, q.siteId)];
  if (q.interactionId) conditions.push(eq(cmsInteractionResponses.interactionId, q.interactionId));
  if (q.kind) conditions.push(eq(cmsInteractions.kind, q.kind));
  if (q.startTime) {
    const parsed = parseDateRangeStart(q.startTime);
    if (!parsed) throw new HTTPException(400, { message: '开始时间格式无效' });
    conditions.push(gte(cmsInteractionResponses.createdAt, parsed));
  }
  if (q.endTime) {
    const parsed = parseDateRangeEnd(q.endTime);
    if (!parsed) throw new HTTPException(400, { message: '结束时间格式无效' });
    conditions.push(lte(cmsInteractionResponses.createdAt, parsed));
  }
  return and(...conditions)!;
}

/**
 * 把一条原始答案关联题目后转成可读结构：选项 value 反查文案，
 * 选项被改名/删除时回退成原始 value，保证答卷永远看得见内容。
 */
export function toCmsInteractionAnswerDetail(input: {
  questionId: number;
  label: string;
  type: CmsInteractionQuestionType;
  options: { label: string; value: string }[] | null;
  matrixRows?: { id: string; label: string }[] | null;
  otherLabel?: string | null;
  value: string | string[];
}): CmsInteractionAnswerDetail {
  const raw = Array.isArray(input.value) ? input.value : [input.value];
  const labelOf = new Map((input.options ?? []).map((option) => [option.value, option.label]));
  const rowLabelOf = new Map((input.matrixRows ?? []).map((row) => [row.id, row.label]));
  const otherLabel = input.otherLabel?.trim() || '其他';
  const values = raw.map((value) => {
    switch (input.type) {
      case 'text':
      case 'date':
      case 'number':
        return value;
      case 'rating':
        return `${value} 分`;
      case 'nps':
        return `${value} 分`;
      case 'matrix': {
        const separator = value.indexOf(CMS_INTERACTION_MATRIX_SEPARATOR);
        if (separator < 0) return value;
        const rowId = value.slice(0, separator);
        const optionValue = value.slice(separator + CMS_INTERACTION_MATRIX_SEPARATOR.length);
        return `${rowLabelOf.get(rowId) ?? rowId}：${labelOf.get(optionValue) ?? optionValue}`;
      }
      default: {
        if (value === CMS_INTERACTION_OTHER_VALUE) return otherLabel;
        if (value.startsWith(CMS_INTERACTION_OTHER_PREFIX)) {
          return `${otherLabel}：${value.slice(CMS_INTERACTION_OTHER_PREFIX.length)}`;
        }
        return labelOf.get(value) ?? value;
      }
    }
  });
  return {
    questionId: input.questionId,
    label: input.label,
    type: input.type,
    values,
    display: values.join('、'),
  };
}

interface LoadedAnswers {
  /** 原始答案：questionId -> 选项 value / 文本，保持既有 API 兼容 */
  answers: Map<number, Record<string, string | string[]>>;
  /** 关联题目后的可读答案，按题目 sort 排序 */
  details: Map<number, CmsInteractionAnswerDetail[]>;
}

/** 一次性载入答案并关联题目，把选项 value 反查成选项文案 */
async function loadAnswers(responseIds: number[]): Promise<LoadedAnswers> {
  if (responseIds.length === 0) return { answers: new Map(), details: new Map() };
  const rows = await db.select({
    responseId: cmsInteractionAnswers.responseId,
    questionId: cmsInteractionAnswers.questionId,
    value: cmsInteractionAnswers.value,
    label: cmsInteractionQuestions.label,
    type: cmsInteractionQuestions.type,
    options: cmsInteractionQuestions.options,
    matrixRows: cmsInteractionQuestions.matrixRows,
    otherLabel: cmsInteractionQuestions.otherLabel,
  })
    .from(cmsInteractionAnswers)
    .innerJoin(cmsInteractionQuestions, eq(cmsInteractionAnswers.questionId, cmsInteractionQuestions.id))
    .where(inArray(cmsInteractionAnswers.responseId, responseIds))
    .orderBy(asc(cmsInteractionQuestions.sort), asc(cmsInteractionQuestions.id));
  const answers = new Map<number, Record<string, string | string[]>>();
  const details = new Map<number, CmsInteractionAnswerDetail[]>();
  for (const row of rows) {
    const answer = answers.get(row.responseId) ?? {};
    answer[String(row.questionId)] = row.value;
    answers.set(row.responseId, answer);

    const list = details.get(row.responseId) ?? [];
    list.push(toCmsInteractionAnswerDetail(row));
    details.set(row.responseId, list);
  }
  return { answers, details };
}

export async function listCmsInteractionResponses(q: ListCmsInteractionResponsesQuery) {
  await ensureCmsSiteExists(q.siteId);
  await assertSiteAccess(q.siteId);
  const where = buildCmsInteractionResponseWhere(q);
  const base = db.select({
    response: cmsInteractionResponses,
    interactionTitle: cmsInteractions.title,
    kind: cmsInteractions.kind,
    nickname: members.nickname,
    username: members.username,
    phone: members.phone,
    email: members.email,
  })
    .from(cmsInteractionResponses)
    .innerJoin(cmsInteractions, eq(cmsInteractionResponses.interactionId, cmsInteractions.id))
    .leftJoin(members, eq(cmsInteractionResponses.memberId, members.id))
    .where(where)
    .orderBy(desc(cmsInteractionResponses.createdAt), desc(cmsInteractionResponses.id));
  const [countRows, rows] = await Promise.all([
    db.select({ value: sql<number>`count(*)::int` }).from(cmsInteractionResponses)
      .innerJoin(cmsInteractions, eq(cmsInteractionResponses.interactionId, cmsInteractions.id))
      .where(where),
    withPagination(base.$dynamic(), q.page, q.pageSize),
  ]);
  const { answers, details } = await loadAnswers(rows.map((row) => row.response.id));
  const list: CmsInteractionResponse[] = rows.map((row) => ({
    id: row.response.id,
    interactionId: row.response.interactionId,
    interactionTitle: row.interactionTitle,
    kind: row.kind,
    memberId: row.response.memberId,
    memberDisplay: row.response.memberId ? maskedMember(row) : '游客',
    visitorHash: row.response.visitorHash,
    ipHash: row.response.ipHash,
    answers: answers.get(row.response.id) ?? {},
    answerDetails: details.get(row.response.id) ?? [],
    createdAt: formatDateTime(row.response.createdAt),
  }));
  return { list, total: countRows[0]?.value ?? 0, page: q.page, pageSize: q.pageSize };
}

export async function* streamCmsInteractionResponses(
  q: Omit<ListCmsInteractionResponsesQuery, 'page' | 'pageSize'>,
) {
  await ensureCmsSiteExists(q.siteId);
  await assertSiteAccess(q.siteId);
  const baseWhere = buildCmsInteractionResponseWhere(q);
  yield* streamByDescendingId(async (beforeId, limit) => {
    const rows = await db.select({
      response: cmsInteractionResponses,
      interactionTitle: cmsInteractions.title,
      kind: cmsInteractions.kind,
      memberId: members.id,
      nickname: members.nickname,
      username: members.username,
      phone: members.phone,
      email: members.email,
    })
      .from(cmsInteractionResponses)
      .innerJoin(cmsInteractions, eq(cmsInteractionResponses.interactionId, cmsInteractions.id))
      .leftJoin(members, eq(cmsInteractionResponses.memberId, members.id))
      .where(and(baseWhere, beforeId === null ? undefined : lt(cmsInteractionResponses.id, beforeId)))
      .orderBy(desc(cmsInteractionResponses.id))
      .limit(limit);
    const { answers, details } = await loadAnswers(rows.map((row) => row.response.id));
    return rows.map((row): CmsInteractionResponse => ({
      id: row.response.id,
      interactionId: row.response.interactionId,
      interactionTitle: row.interactionTitle,
      kind: row.kind,
      memberId: row.response.memberId,
      memberDisplay: row.memberId
        ? row.nickname || row.username || row.phone || row.email || `会员 #${row.memberId}`
        : '游客',
      visitorHash: row.response.visitorHash,
      ipHash: row.response.ipHash,
      answers: answers.get(row.response.id) ?? {},
      answerDetails: details.get(row.response.id) ?? [],
      createdAt: formatDateTime(row.response.createdAt),
    }));
  });
}

const INTERACTION_MARKER_RE = /(?:<p[^>]*>)?\s*\[互动:([a-z0-9-]+)\]\s*(?:<\/p>)?/gi;
const LEGACY_INTERACTION_MARKER_RE = /(?:<p[^>]*>)?\s*\[(?:投票|问卷|survey|poll):[^\]\r\n]{1,100}\]\s*(?:<\/p>)?/gi;

export function applyInteractionMarkers(html: string, siteCode: string): string {
  if (!html) return html;
  const withoutLegacy = html.replace(LEGACY_INTERACTION_MARKER_RE, '');
  if (!withoutLegacy.includes('[互动:')) return withoutLegacy;
  const safeSiteCode = siteCode.replace(/[^a-z0-9-]/gi, '');
  return withoutLegacy.replace(INTERACTION_MARKER_RE, (_match, code: string) =>
    `<div class="cms-interaction" data-site="${safeSiteCode}" data-code="${code}"></div>`);
}

export function canExposeCmsInteractionResults(input: {
  visibility: CmsInteractionRow['resultVisibility'];
  status: CmsInteractionRow['status'];
  submitted: boolean;
}): boolean {
  return input.visibility === 'always'
    || (input.visibility === 'after_submit' && input.submitted)
    || (input.visibility === 'after_close' && input.status === 'closed');
}

export function cmsInteractionRepeatIdentity(input: {
  policy: CmsInteractionRepeatPolicy;
  memberId: number | null;
  ipHash: string;
}): string | null {
  return repeatKeyFor(input.policy, input.memberId, input.ipHash);
}
