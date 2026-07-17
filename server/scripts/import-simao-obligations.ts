import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { PoolConnection } from 'mysql2/promise';
import pool from '../db/connection.js';

type SqlValue = string | number | null;
type SourceRow = Record<string, SqlValue>;

type Municipality = {
  id: number;
  name: string;
  state: string;
  activeServices: Record<string, boolean>;
};

type Task = {
  id: number;
  municipalityId: number;
  municipalityName: string;
  obligationCode: string;
  competence: string;
  year: number;
  status: string;
  siopsMembros: string | null;
  siopeFolha: string | null;
  updatedAt: string;
};

const OBLIGATIONS = ['MSC', 'SIOPE', 'SIOPS', 'RREO', 'RGF', 'DCA'] as const;
const VALID_STATUSES = new Set([
  'Falta XML', 'Homologado', 'Pendência Cliente', 'Não iniciado', 'Enviado', 'Trabalhando',
]);
const VALID_SIOPS = new Set(['Não Solicitado', 'Sem críticas', 'Solicitado']);
const VALID_SIOPE = new Set(['Não Solicitado', 'Sem críticas', 'Solicitado', 'Diferença Folha', 'Recebido']);
const REQUIRED_TARGET_TABLES = [
  'obligation_municipalities',
  'obligation_tasks',
  'obligation_task_history',
  'obligation_task_comments',
  'obligation_task_attachments',
  'usuarios',
];

function cliOptions(): { sourcePath: string; apply: boolean } {
  const apply = process.argv.includes('--apply');
  if (apply && !process.argv.includes('--confirm=IMPORTAR_OBRIGACOES_SIMAO')) {
    throw new Error('Para aplicar, confirme explicitamente com --confirm=IMPORTAR_OBRIGACOES_SIMAO.');
  }
  const inline = process.argv.find((argument) => argument.startsWith('--source='))?.slice('--source='.length);
  const index = process.argv.indexOf('--source');
  const source = inline || (index >= 0 ? process.argv[index + 1] : undefined) || process.env.SIMAO_SQL_PATH;
  if (!source) {
    throw new Error('Informe o dump com --source "caminho\\arquivo.sql" ou SIMAO_SQL_PATH.');
  }
  return { sourcePath: path.resolve(source), apply };
}

function repairText(value: string): string {
  let repaired = value;
  for (let pass = 0; pass < 2 && /[ÃÂâ]/.test(repaired); pass += 1) {
    const candidate = Buffer.from(repaired, 'latin1').toString('utf8');
    if (candidate.includes('�')) break;
    repaired = candidate;
  }
  return repaired.normalize('NFC');
}

function normalizedName(value: string): string {
  const aliases: Record<string, string> = {
    'SJ DAS DUAS PONTES': 'SAO JOAO DAS DUAS PONTES',
  };
  const normalized = repairText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
  return aliases[normalized] || normalized;
}

function municipalityDisplayName(value: string): string {
  return normalizedName(value) === 'SAO JOAO DAS DUAS PONTES'
    ? 'SÃO JOÃO DAS DUAS PONTES'
    : repairText(value);
}

function serviceConfig(municipality: Municipality): string {
  return JSON.stringify({
    activeServices: municipality.activeServices,
  });
}

function dateValue(value: SqlValue): string {
  return stringValue(value).slice(0, 19);
}

function childFingerprint(values: Array<unknown>): string {
  return values.map((value) => value == null ? '' : repairText(String(value))).join('|');
}

function sqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === "'" && sql[index + 1] === "'") index += 1;
      else if (char === "'") quoted = false;
    } else if (char === "'") quoted = true;
    else if (char === ';') {
      const statement = sql.slice(start, index + 1).trim();
      const insertStart = statement.indexOf('INSERT INTO');
      if (insertStart >= 0) statements.push(statement.slice(insertStart));
      start = index + 1;
    }
  }
  return statements;
}

function parseScalar(raw: string): SqlValue {
  const trimmed = raw.trim();
  if (/^NULL$/i.test(trimmed)) return null;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (!(trimmed.startsWith("'") && trimmed.endsWith("'"))) return repairText(trimmed);
  const body = trimmed.slice(1, -1)
    .replace(/''/g, "'")
    .replace(/\\0/g, '\0')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\Z/g, '\x1a')
    .replace(/\\([\\'\"])/g, '$1');
  return repairText(body);
}

function parseTuples(values: string): SqlValue[][] {
  const tuples: SqlValue[][] = [];
  let fields: string[] | null = null;
  let field = '';
  let quoted = false;
  let escaped = false;
  let depth = 0;
  for (let index = 0; index < values.length; index += 1) {
    const char = values[index];
    if (quoted) {
      field += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === "'" && values[index + 1] === "'") field += values[++index];
      else if (char === "'") quoted = false;
      continue;
    }
    if (char === "'") {
      quoted = true;
      field += char;
    } else if (char === '(') {
      depth += 1;
      if (depth === 1) fields = [];
      else field += char;
    } else if (char === ',' && depth === 1) {
      fields?.push(field);
      field = '';
    } else if (char === ')' && depth === 1) {
      fields?.push(field);
      tuples.push((fields || []).map(parseScalar));
      fields = null;
      field = '';
      depth = 0;
    } else if (depth > 0) field += char;
  }
  return tuples;
}

function parseDump(sql: string): Record<string, SourceRow[]> {
  const tables: Record<string, SourceRow[]> = {};
  for (const statement of sqlStatements(sql)) {
    const match = statement.match(/^INSERT INTO\s+`([^`]+)`\s*\(([^)]+)\)\s*VALUES\s*([\s\S]*);$/);
    if (!match) continue;
    const [, table, rawColumns, values] = match;
    const columns = [...rawColumns.matchAll(/`([^`]+)`/g)].map((column) => column[1]);
    for (const tuple of parseTuples(values)) {
      if (tuple.length !== columns.length) throw new Error(`Quantidade de colunas inválida em ${table}.`);
      (tables[table] ||= []).push(Object.fromEntries(columns.map((column, index) => [column, tuple[index]])));
    }
  }
  return tables;
}

function stringValue(value: SqlValue): string {
  return value == null ? '' : repairText(String(value));
}

function nullableString(value: SqlValue): string | null {
  return value == null || value === '' ? null : repairText(String(value));
}

function activeServices(raw: SqlValue): Record<string, boolean> {
  const allActive = Object.fromEntries(OBLIGATIONS.map((code) => [code, true]));
  if (typeof raw !== 'string' || !raw.trim().startsWith('{')) return allActive;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const configured = parsed._activeServices;
    if (!configured || typeof configured !== 'object') return allActive;
    return Object.fromEntries(OBLIGATIONS.map((code) => [code, (configured as Record<string, unknown>)[code] !== false]));
  } catch {
    return allActive;
  }
}

function taskKey(task: Pick<Task, 'municipalityName' | 'obligationCode' | 'competence' | 'year'>): string {
  return [normalizedName(task.municipalityName), task.obligationCode, task.competence, task.year].join('|');
}

function identityKey(value: string): string {
  return normalizedName(value);
}

function sameNullable(left: unknown, right: unknown): boolean {
  return (left == null || left === '' ? null : repairText(String(left))) ===
    (right == null || right === '' ? null : repairText(String(right)));
}

async function applyImport({
  connection,
  municipalities,
  eligibleTasks,
  sourceHistories,
  sourceComments,
  userByIdentity,
  targetDispositionBySourceId,
}: {
  connection: PoolConnection;
  municipalities: Municipality[];
  eligibleTasks: Task[];
  sourceHistories: SourceRow[];
  sourceComments: SourceRow[];
  userByIdentity: Map<string, { id: number; name: string }>;
  targetDispositionBySourceId: Map<number, string>;
}) {
  const applied = { municipalitiesInserted: 0, tasksInserted: 0, tasksUpdated: 0, historiesInserted: 0, commentsInserted: 0 };
  await connection.beginTransaction();
  try {
    const [existingMunicipalities]: any = await connection.query(
      'SELECT id, name, state FROM obligation_municipalities FOR UPDATE',
    );
    const existingKeys = new Set(existingMunicipalities.map((row: any) => `${normalizedName(row.name)}|${String(row.state).toUpperCase()}`));
    const municipalityInsertValues = municipalities
      .filter((municipality) => !existingKeys.has(`${normalizedName(municipality.name)}|${municipality.state}`))
      .map((municipality) => [
        municipalityDisplayName(municipality.name), 'SP', serviceConfig(municipality), null, null, null, 1,
      ]);
    if (municipalityInsertValues.length > 0) {
      const [result]: any = await connection.query(
        `INSERT INTO obligation_municipalities
          (name, state, service_config, phone, email, observations, active)
         VALUES ?`,
        [municipalityInsertValues],
      );
      applied.municipalitiesInserted = Number(result.affectedRows);
    }

    const [currentMunicipalities]: any = await connection.query(
      'SELECT id, name, state FROM obligation_municipalities WHERE active = 1',
    );
    const municipalityIdByKey = new Map<string, number>(currentMunicipalities.map((row: any) => [
      `${normalizedName(row.name)}|${String(row.state).toUpperCase()}`, Number(row.id),
    ]));

    for (const task of eligibleTasks.filter((item) => targetDispositionBySourceId.get(item.id) === 'safeUpdate')) {
      const municipalityId = municipalityIdByKey.get(`${normalizedName(task.municipalityName)}|SP`);
      const [result]: any = await connection.query(
        `UPDATE obligation_tasks
         SET status = ?, siops_membros = ?, siope_folha = ?, updated_at = ?, version = version + 1
         WHERE municipality_id = ? AND obligation_code = ? AND competence = ? AND year = ?`,
        [task.status, task.siopsMembros, task.siopeFolha, task.updatedAt, municipalityId,
          task.obligationCode, task.competence, task.year],
      );
      applied.tasksUpdated += Number(result.affectedRows);
    }

    const taskInsertValues = eligibleTasks
      .filter((task) => targetDispositionBySourceId.get(task.id) === 'insert')
      .map((task) => {
        const municipalityId = municipalityIdByKey.get(`${normalizedName(task.municipalityName)}|SP`);
        if (!municipalityId) throw new Error(`Município não localizado durante a aplicação: ${task.municipalityName}`);
        return [municipalityId, task.obligationCode, task.competence, task.year, task.status,
          task.siopsMembros, task.siopeFolha, task.updatedAt];
      });
    if (taskInsertValues.length > 0) {
      const [result]: any = await connection.query(
        `INSERT INTO obligation_tasks
          (municipality_id, obligation_code, competence, year, status, siops_membros, siope_folha, updated_at)
         VALUES ?`,
        [taskInsertValues],
      );
      applied.tasksInserted = Number(result.affectedRows);
    }

    const [currentTasks]: any = await connection.query(`
      SELECT t.id, m.name AS municipalityName, t.obligation_code AS obligationCode,
        t.competence, t.year
      FROM obligation_tasks t
      INNER JOIN obligation_municipalities m ON m.id = t.municipality_id
    `);
    const targetTaskIdByKey = new Map<string, number>(currentTasks.map((row: any) => [taskKey({
      municipalityName: String(row.municipalityName), obligationCode: String(row.obligationCode),
      competence: repairText(String(row.competence)), year: Number(row.year),
    }), Number(row.id)]));
    const targetTaskIdBySourceId = new Map<number, number>();
    for (const task of eligibleTasks) {
      const targetId = targetTaskIdByKey.get(taskKey(task));
      if (!targetId) throw new Error(`Tarefa não localizada após inserção: ${taskKey(task)}`);
      targetTaskIdBySourceId.set(task.id, targetId);
    }

    const [existingHistoryRows]: any = await connection.query(`
      SELECT task_id AS taskId, field_changed AS fieldChanged, old_value AS oldValue,
        new_value AS newValue, actor_name AS actorName, observation,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
      FROM obligation_task_history
    `);
    const historyFingerprints = new Set(existingHistoryRows.map((row: any) => childFingerprint([
      row.taskId, row.fieldChanged, row.oldValue, row.newValue, row.actorName, row.observation, row.createdAt,
    ])));
    const historyValues: unknown[][] = [];
    for (const row of sourceHistories) {
      const taskId = targetTaskIdBySourceId.get(Number(row.task_id));
      if (!taskId) continue;
      const sourceAuthor = stringValue(row.user_who_changed);
      const matchedUser = userByIdentity.get(identityKey(sourceAuthor)) || userByIdentity.get(sourceAuthor.trim().toLowerCase());
      const actorName = matchedUser?.name || 'Sem Registro';
      const values = [taskId, stringValue(row.field_changed), nullableString(row.old_value), nullableString(row.new_value),
        matchedUser?.id || null, actorName, nullableString(row.observation), dateValue(row.created_at)];
      const fingerprint = childFingerprint([values[0], values[1], values[2], values[3], values[5], values[6], values[7]]);
      if (!historyFingerprints.has(fingerprint)) {
        historyFingerprints.add(fingerprint);
        historyValues.push(values);
      }
    }
    if (historyValues.length > 0) {
      const [result]: any = await connection.query(
        `INSERT INTO obligation_task_history
          (task_id, field_changed, old_value, new_value, user_id, actor_name, observation, created_at)
         VALUES ?`,
        [historyValues],
      );
      applied.historiesInserted = Number(result.affectedRows);
    }

    const [existingCommentRows]: any = await connection.query(`
      SELECT task_id AS taskId, author_name AS authorName, text,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
      FROM obligation_task_comments
    `);
    const commentFingerprints = new Set(existingCommentRows.map((row: any) => childFingerprint([
      row.taskId, row.authorName, row.text, row.createdAt,
    ])));
    const commentValues: unknown[][] = [];
    for (const row of sourceComments) {
      const taskId = targetTaskIdBySourceId.get(Number(row.task_id));
      if (!taskId) continue;
      const sourceAuthor = stringValue(row.author_name);
      const matchedUser = userByIdentity.get(identityKey(sourceAuthor)) || userByIdentity.get(sourceAuthor.trim().toLowerCase());
      const authorName = matchedUser?.name || 'Sem Registro';
      const values = [taskId, matchedUser?.id || null, authorName, stringValue(row.text), dateValue(row.created_at)];
      const fingerprint = childFingerprint([values[0], values[2], values[3], values[4]]);
      if (!commentFingerprints.has(fingerprint)) {
        commentFingerprints.add(fingerprint);
        commentValues.push(values);
      }
    }
    if (commentValues.length > 0) {
      const [result]: any = await connection.query(
        `INSERT INTO obligation_task_comments
          (task_id, author_id, author_name, text, created_at)
         VALUES ?`,
        [commentValues],
      );
      applied.commentsInserted = Number(result.affectedRows);
    }

    await connection.commit();
    return applied;
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function main() {
  const { sourcePath, apply } = cliOptions();
  const sql = await readFile(sourcePath, 'utf8');
  const tables = parseDump(sql);

  const municipalities: Municipality[] = (tables.municipalities || []).map((row) => ({
    id: Number(row.id),
    name: stringValue(row.name),
    state: stringValue(row.state).toUpperCase(),
    activeServices: activeServices(row.responsible),
  }));
  const municipalityById = new Map(municipalities.map((municipality) => [municipality.id, municipality]));
  const tasks: Task[] = (tables.tasks || []).map((row) => ({
    id: Number(row.id),
    municipalityId: Number(row.municipality_id),
    municipalityName: municipalityById.get(Number(row.municipality_id))?.name || '',
    obligationCode: stringValue(row.obligation_code).toUpperCase(),
    competence: stringValue(row.competence),
    year: Number(row.year),
    status: stringValue(row.status),
    siopsMembros: nullableString(row.siops_membros),
    siopeFolha: nullableString(row.siope_folha),
    updatedAt: stringValue(row.updated_at),
  }));

  const validationErrors: string[] = [];
  const municipalityKeys = new Set<string>();
  for (const municipality of municipalities) {
    const key = `${normalizedName(municipality.name)}|${municipality.state}`;
    if (municipalityKeys.has(key)) validationErrors.push(`Município duplicado: ${municipality.name}/${municipality.state}`);
    municipalityKeys.add(key);
    if (municipality.state !== 'SP') validationErrors.push(`UF diferente de SP: ${municipality.name}/${municipality.state}`);
  }
  const sourceTaskKeys = new Set<string>();
  for (const task of tasks) {
    if (!municipalityById.has(task.municipalityId)) validationErrors.push(`Tarefa ${task.id} sem município.`);
    if (!OBLIGATIONS.includes(task.obligationCode as typeof OBLIGATIONS[number])) validationErrors.push(`Tarefa ${task.id} com obrigação inválida: ${task.obligationCode}`);
    if (!VALID_STATUSES.has(task.status)) validationErrors.push(`Tarefa ${task.id} com status inválido: ${task.status}`);
    if (task.siopsMembros && !VALID_SIOPS.has(task.siopsMembros)) validationErrors.push(`Tarefa ${task.id} com SIOPS inválido: ${task.siopsMembros}`);
    if (task.siopeFolha && !VALID_SIOPE.has(task.siopeFolha)) validationErrors.push(`Tarefa ${task.id} com SIOPE inválido: ${task.siopeFolha}`);
    const key = taskKey(task);
    if (sourceTaskKeys.has(key)) validationErrors.push(`Tarefa duplicada: ${key}`);
    sourceTaskKeys.add(key);
  }

  const ignoredTasks = tasks.filter((task) => municipalityById.get(task.municipalityId)?.activeServices[task.obligationCode] === false);
  const ignoredTaskIds = new Set(ignoredTasks.map((task) => task.id));
  const eligibleTasks = tasks.filter((task) => !ignoredTaskIds.has(task.id));
  const eligibleTaskIds = new Set(eligibleTasks.map((task) => task.id));
  const sourceHistories = (tables.history || []).filter((row) => eligibleTaskIds.has(Number(row.task_id)));
  const sourceComments = (tables.comments || []).filter((row) => eligibleTaskIds.has(Number(row.task_id)));

  const report: Record<string, unknown> = {
    mode: apply ? 'APPLY_TRANSACTIONAL' : 'DRY_RUN_READ_ONLY',
    source: path.basename(sourcePath),
    sourceCounts: {
      municipalities: municipalities.length,
      tasks: tasks.length,
      history: (tables.history || []).length,
      comments: (tables.comments || []).length,
      attachments: (tables.attachments || []).length,
      usersIgnored: (tables.users || []).length,
    },
    rules: {
      accountsAndPasswords: 'IGNORED',
      unmatchedAuthors: 'Sem Registro',
      municipalityAlias: 'SJ DAS DUAS PONTES -> SÃO JOÃO DAS DUAS PONTES',
      phoneAndEmail: 'NOT_PLANNED (dados genéricos/placeholders do legado)',
    },
    validation: { valid: validationErrors.length === 0, errors: validationErrors },
    ignoredInactiveTasks: ignoredTasks.map((task) => ({
      sourceId: task.id,
      municipality: task.municipalityName,
      obligation: task.obligationCode,
      competence: task.competence,
      year: task.year,
      status: task.status,
    })),
  };

  try {
    const [tableRows] = await pool.query(
      `SELECT TABLE_NAME AS tableName FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?)`,
      [REQUIRED_TARGET_TABLES],
    );
    const targetTables = new Set((tableRows as Array<{ tableName: string }>).map((row) => row.tableName));
    const missingTables = REQUIRED_TARGET_TABLES.filter((table) => !targetTables.has(table));
    if (missingTables.length > 0) {
      report.target = {
        connected: true,
        schemaReady: false,
        missingTables,
        plannedIfSchemaReady: { municipalitiesInsert: municipalities.length, tasksInsert: eligibleTasks.length },
      };
      if (apply) throw new Error(`Schema de destino incompleto: ${missingTables.join(', ')}`);
    } else {
      const [targetMunicipalityRows] = await pool.query(
        'SELECT id, name, state, service_config AS serviceConfig FROM obligation_municipalities',
      );
      const [targetTaskRows] = await pool.query(`
        SELECT t.id, m.name AS municipalityName, t.obligation_code AS obligationCode,
          t.competence, t.year, t.status, t.siops_membros AS siopsMembros,
          t.siope_folha AS siopeFolha,
          (SELECT COUNT(*) FROM obligation_task_history h WHERE h.task_id = t.id) AS historyCount,
          (SELECT COUNT(*) FROM obligation_task_comments c WHERE c.task_id = t.id) AS commentCount,
          (SELECT COUNT(*) FROM obligation_task_attachments a WHERE a.task_id = t.id) AS attachmentCount
        FROM obligation_tasks t
        INNER JOIN obligation_municipalities m ON m.id = t.municipality_id
      `);
      const [userRows] = await pool.query(
        "SELECT id, nome, email FROM usuarios WHERE ativo = 1 AND COALESCE(perfil, '') <> 'cliente'",
      );

      const targetMunicipalities = targetMunicipalityRows as Array<Record<string, unknown>>;
      const targetMunicipalityByKey = new Map(targetMunicipalities.map((row) => [
        `${normalizedName(String(row.name))}|${String(row.state).toUpperCase()}`, row,
      ]));
      const targetTasks = targetTaskRows as Array<Record<string, unknown>>;
      const targetTaskByKey = new Map(targetTasks.map((row) => [taskKey({
        municipalityName: String(row.municipalityName),
        obligationCode: String(row.obligationCode),
        competence: repairText(String(row.competence)),
        year: Number(row.year),
      }), row]));
      const municipalityPlan = { insert: 0, reuse: 0 };
      const municipalitiesToInsert: string[] = [];
      for (const municipality of municipalities) {
        if (targetMunicipalityByKey.has(`${normalizedName(municipality.name)}|${municipality.state}`)) municipalityPlan.reuse += 1;
        else {
          municipalityPlan.insert += 1;
          municipalitiesToInsert.push(municipality.name === 'SJ DAS DUAS PONTES' ? 'SÃO JOÃO DAS DUAS PONTES' : municipality.name);
        }
      }

      const taskPlan = { insert: 0, unchanged: 0, safeUpdate: 0, conflict: 0, ignoredInactive: ignoredTasks.length };
      const conflicts: string[] = [];
      const conflictGroups = new Map<string, { count: number; source: string; target: string }>();
      const conflictProtections = { withHistory: 0, withComments: 0, withAttachments: 0 };
      const targetDispositionBySourceId = new Map<number, string>();
      for (const task of eligibleTasks) {
        const target = targetTaskByKey.get(taskKey(task));
        if (!target) {
          taskPlan.insert += 1;
          targetDispositionBySourceId.set(task.id, 'insert');
          continue;
        }
        const same = repairText(String(target.status)) === task.status &&
          sameNullable(target.siopsMembros, task.siopsMembros) && sameNullable(target.siopeFolha, task.siopeFolha);
        if (same) {
          taskPlan.unchanged += 1;
          targetDispositionBySourceId.set(task.id, 'unchanged');
          continue;
        }
        const targetSiopsIsDefault = target.siopsMembros == null || target.siopsMembros === 'Não Solicitado';
        const targetSiopeIsDefault = target.siopeFolha == null || target.siopeFolha === 'Não Solicitado';
        const safe = String(target.status) === 'Falta XML' && targetSiopsIsDefault && targetSiopeIsDefault &&
          Number(target.historyCount) === 0 && Number(target.commentCount) === 0 && Number(target.attachmentCount) === 0;
        if (safe) {
          taskPlan.safeUpdate += 1;
          targetDispositionBySourceId.set(task.id, 'safeUpdate');
        } else {
          taskPlan.conflict += 1;
          targetDispositionBySourceId.set(task.id, 'conflict');
          if (conflicts.length < 50) conflicts.push(taskKey(task));
          const sourceValues = `status=${task.status}; siops=${task.siopsMembros || '-'}; siope=${task.siopeFolha || '-'}`;
          const targetValues = `status=${repairText(String(target.status))}; siops=${target.siopsMembros || '-'}; siope=${target.siopeFolha || '-'}`;
          const groupKey = `${sourceValues} -> ${targetValues}`;
          const group = conflictGroups.get(groupKey) || { count: 0, source: sourceValues, target: targetValues };
          group.count += 1;
          conflictGroups.set(groupKey, group);
          if (Number(target.historyCount) > 0) conflictProtections.withHistory += 1;
          if (Number(target.commentCount) > 0) conflictProtections.withComments += 1;
          if (Number(target.attachmentCount) > 0) conflictProtections.withAttachments += 1;
        }
      }

      const userByIdentity = new Map<string, { id: number; name: string }>();
      for (const user of userRows as Array<Record<string, unknown>>) {
        const mapped = { id: Number(user.id), name: String(user.nome) };
        if (user.nome) userByIdentity.set(identityKey(String(user.nome)), mapped);
        if (user.email) userByIdentity.set(String(user.email).trim().toLowerCase(), mapped);
      }
      let historyMatched = 0;
      let historySemRegistro = 0;
      let commentsMatched = 0;
      let commentsSemRegistro = 0;
      for (const row of sourceHistories) {
        const author = stringValue(row.user_who_changed);
        if (userByIdentity.has(identityKey(author)) || userByIdentity.has(author.trim().toLowerCase())) historyMatched += 1;
        else historySemRegistro += 1;
      }
      for (const row of sourceComments) {
        const author = stringValue(row.author_name);
        if (userByIdentity.has(identityKey(author)) || userByIdentity.has(author.trim().toLowerCase())) commentsMatched += 1;
        else commentsSemRegistro += 1;
      }
      const historyBlockedByTaskConflict = sourceHistories.filter((row) => targetDispositionBySourceId.get(Number(row.task_id)) === 'conflict').length;
      const commentsBlockedByTaskConflict = sourceComments.filter((row) => targetDispositionBySourceId.get(Number(row.task_id)) === 'conflict').length;

      report.target = {
        connected: true,
        schemaReady: true,
        existing: { municipalities: targetMunicipalities.length, tasks: targetTasks.length },
        municipalityPlan,
        municipalitiesToInsert,
        taskPlan,
        conflictProtections,
        conflictSummary: [...conflictGroups.values()].sort((left, right) => right.count - left.count),
        conflictExamples: conflicts.slice(0, 15),
        historyPlan: {
          sourceEligible: sourceHistories.length,
          authorMatched: historyMatched,
          authorSemRegistro: historySemRegistro,
          blockedByTaskConflict: historyBlockedByTaskConflict,
          note: 'Duplicatas de histórico serão conferidas novamente antes do modo de aplicação.',
        },
        commentPlan: {
          sourceEligible: sourceComments.length,
          authorMatched: commentsMatched,
          authorSemRegistro: commentsSemRegistro,
          blockedByTaskConflict: commentsBlockedByTaskConflict,
          note: 'Duplicatas de comentários serão conferidas novamente antes do modo de aplicação.',
        },
      };
      if (apply) {
        if (validationErrors.length > 0) throw new Error('A aplicação foi bloqueada por erros de validação do dump.');
        if (taskPlan.conflict > 0) throw new Error(`A aplicação foi bloqueada por ${taskPlan.conflict} conflito(s).`);
        const connection = await pool.getConnection();
        try {
          report.application = await applyImport({
            connection, municipalities, eligibleTasks, sourceHistories, sourceComments,
            userByIdentity, targetDispositionBySourceId,
          });
        } finally {
          connection.release();
        }
      }
    }
  } catch (error) {
    report.target = {
      connected: false,
      error: error instanceof Error ? error.message : String(error),
      note: 'A validação do dump foi concluída; nenhuma gravação foi tentada.',
    };
    if (apply) {
      report.application = { committed: false, error: error instanceof Error ? error.message : String(error) };
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }

  const application = report.application as Record<string, number> | undefined;
  report.writeOperationsExecuted = application
    ? Object.values(application).reduce((total, count) => total + Number(count), 0)
    : 0;
  console.log(JSON.stringify(report, null, 2));
  if (validationErrors.length > 0) process.exitCode = 2;
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await pool.end().catch(() => undefined);
  process.exitCode = 1;
});
