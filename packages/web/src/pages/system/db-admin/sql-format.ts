export function quoteSqlIdent(s: string): string {
  return '"' + s.replaceAll('"', '""') + '"';
}

/** 去掉 SQL 开头的行注释与块注释，用于识别首个关键字 */
export function stripLeadingSqlComments(text: string): string {
  let rest = text;
  for (;;) {
    const trimmed = rest.trimStart();
    if (trimmed.startsWith('--')) {
      const newline = trimmed.indexOf('\n');
      if (newline === -1) return '';
      rest = trimmed.slice(newline + 1);
      continue;
    }
    if (trimmed.startsWith('/*')) {
      const end = trimmed.indexOf('*/');
      if (end === -1) return '';
      rest = trimmed.slice(end + 2);
      continue;
    }
    return trimmed;
  }
}

/** 只读语句白名单：SELECT / WITH / EXPLAIN / SHOW / TABLE / VALUES */
const READONLY_SQL_RE = /^(select|with|explain|show|table|values)\b/i;

/** 判断整段 SQL 是否只含只读查询语句（按分号切分逐条判定，忽略注释、空语句与字符串内的分号） */
export function isReadOnlySql(text: string): boolean {
  // 字符串字面量置空，避免 'a;b' 里的分号干扰切分；$$ 块同理
  const sanitized = text
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/\$\$[\s\S]*?\$\$/g, '$$$$');
  const statements = sanitized.split(';');
  let checkedAny = false;
  for (const statement of statements) {
    const effective = stripLeadingSqlComments(statement);
    if (!effective.trim()) continue;
    checkedAny = true;
    if (!READONLY_SQL_RE.test(effective)) return false;
  }
  return checkedAny;
}

function escapeSingleQuote(s: string): string {
  return s.replaceAll("'", "''");
}

export function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number' || typeof v === 'bigint') return v.toString();
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof Date) return "'" + escapeSingleQuote(v.toISOString()) + "'";
  if (typeof v === 'object') {
    return "'" + escapeSingleQuote(JSON.stringify(v)) + "'::jsonb";
  }
  if (typeof v === 'string') return "'" + escapeSingleQuote(v) + "'";
  return "'" + escapeSingleQuote(JSON.stringify(v)) + "'";
}

export function buildUpdateSql(
  schema: string,
  table: string,
  pk: Record<string, unknown>,
  changes: Record<string, unknown>,
): string {
  const setExpr = Object.entries(changes)
    .map(([k, v]) => quoteSqlIdent(k) + ' = ' + sqlLiteral(v))
    .join(', ');
  const whereExpr = Object.entries(pk)
    .map(([k, v]) => quoteSqlIdent(k) + ' = ' + sqlLiteral(v))
    .join(' AND ');
  return (
    'UPDATE ' + quoteSqlIdent(schema) + '.' + quoteSqlIdent(table) +
    ' SET ' + setExpr + ' WHERE ' + whereExpr + ';'
  );
}

export function buildInsertSql(
  schema: string,
  table: string,
  row: Record<string, unknown>,
): string {
  const entries = Object.entries(row).filter(([k]) => !k.startsWith('__'));
  const cols = entries.map(([k]) => quoteSqlIdent(k)).join(', ');
  const vals = entries.map(([, v]) => sqlLiteral(v)).join(', ');
  return (
    'INSERT INTO ' + quoteSqlIdent(schema) + '.' + quoteSqlIdent(table) +
    ' (' + cols + ') VALUES (' + vals + ');'
  );
}

export function buildDeleteSql(
  schema: string,
  table: string,
  pk: Record<string, unknown>,
): string {
  const whereExpr = Object.entries(pk)
    .map(([k, v]) => quoteSqlIdent(k) + ' = ' + sqlLiteral(v))
    .join(' AND ');
  return (
    'DELETE FROM ' + quoteSqlIdent(schema) + '.' + quoteSqlIdent(table) +
    ' WHERE ' + whereExpr + ';'
  );
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

interface DdlColumn {
  name: string;
  dataType: string;
  isNullable: boolean;
  defaultValue: string | null;
}

/** 根据表结构信息生成 CREATE TABLE DDL 语句 */
export function generateCreateTableDdl(
  schema: string,
  table: string,
  columns: DdlColumn[],
  primaryKey: string[],
): string {
  const colLines = columns.map((c) => {
    let line = `  ${quoteSqlIdent(c.name)} ${c.dataType}`;
    if (!c.isNullable) line += ' NOT NULL';
    if (c.defaultValue !== null) line += ` DEFAULT ${c.defaultValue}`;
    return line;
  });
  if (primaryKey.length > 0) {
    colLines.push(`  PRIMARY KEY (${primaryKey.map(quoteSqlIdent).join(', ')})`);
  }
  return (
    `CREATE TABLE ${quoteSqlIdent(schema)}.${quoteSqlIdent(table)} (\n` +
    colLines.join(',\n') +
    '\n);'
  );
}
