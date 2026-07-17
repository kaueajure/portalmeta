import { Router } from 'express';
import multer from 'multer';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permissions.middleware.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { validateAttachmentMetadata } from '../utils/file-security.js';

const router = Router();
router.use(authMiddleware as any);

const OBLIGATIONS: Record<string, string[]> = {
  MSC: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro', 'Encerramento'],
  RREO: ['1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre', '5º Bimestre', '6º Bimestre'],
  RGF: ['1º Quadrimestre', '2º Quadrimestre', '3º Quadrimestre'],
  DCA: ['Anual'],
  SIOPE: ['1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre', '5º Bimestre', '6º Bimestre'],
  SIOPS: ['1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre', '5º Bimestre', '6º Bimestre'],
};
const STATUSES = new Set(['Falta XML', 'Não iniciado', 'Pendência Cliente', 'Trabalhando', 'Retificar', 'Enviado', 'Homologado']);
const AUXILIARY_STATUSES = new Set(['Não Solicitado', 'Solicitado', 'Recebido', 'Importado', 'Críticas', 'Diferença Folha', 'Sem críticas']);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, callback) => {
    const validation = validateAttachmentMetadata(file.originalname, file.mimetype);
    if (!validation.ok) return callback(new Error(validation.error));
    callback(null, true);
  },
});

function positiveInt(value: unknown): number | null {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseScope(req: AuthRequest) {
  const year = positiveInt(req.query.year);
  const obligationCode = String(req.query.obligationCode || '').toUpperCase();
  if (!year || year < 2000 || year > 2100 || !OBLIGATIONS[obligationCode]) return null;
  return { year, obligationCode, competences: OBLIGATIONS[obligationCode] };
}

function parseServiceConfig(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, any>;
  try { return JSON.parse(String(value)); } catch { return {}; }
}

function isServiceActive(config: unknown, obligationCode: string): boolean {
  return parseServiceConfig(config).activeServices?.[obligationCode] !== false;
}

function isCompleted(status: string): boolean {
  return status === 'Enviado' || status === 'Homologado';
}

function getDueDate(competence: string, year: number): Date {
  const months: Record<string, number> = {
    Janeiro: 1, Fevereiro: 2, 'Março': 3, Abril: 4, Maio: 5, Junho: 6,
    Julho: 7, Agosto: 8, Setembro: 9, Outubro: 10, Novembro: 11,
    Dezembro: 12, Encerramento: 12,
    '1º Bimestre': 2, '2º Bimestre': 4, '3º Bimestre': 6,
    '4º Bimestre': 8, '5º Bimestre': 10, '6º Bimestre': 12,
    '1º Quadrimestre': 4, '2º Quadrimestre': 8, '3º Quadrimestre': 12,
    Anual: 12,
  };
  const endMonth = months[String(competence || '').trim()] || 12;
  const dueYear = endMonth === 12 ? year + 1 : year;
  const dueMonth = endMonth === 12 ? 1 : endMonth + 1;
  const lastDay = new Date(Date.UTC(dueYear, dueMonth, 0)).getUTCDate();
  // Os prazos do produto são civis e seguem o horário de Brasília (UTC-03).
  return new Date(`${dueYear}-${String(dueMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59.999-03:00`);
}

function isOverdue(status: string, _obligationCode: string, competence: string, year: number): boolean {
  return !isCompleted(status) && Date.now() > getDueDate(competence, year).getTime();
}

function dateKeyInSaoPaulo(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function mapTask(row: any) {
  return {
    id: Number(row.id),
    municipalityId: Number(row.municipality_id),
    obligationCode: row.obligation_code,
    competence: row.competence,
    year: Number(row.year),
    status: row.status,
    siopsMembros: row.siops_membros,
    siopeFolha: row.siope_folha,
    updatedAt: row.updated_at,
    version: Number(row.version || 1),
    lastEditorName: row.last_editor_name || null,
  };
}

function mapMunicipality(row: any) {
  return {
    id: Number(row.id),
    name: row.name,
    state: row.state,
    serviceConfig: parseServiceConfig(row.service_config),
    phone: row.phone,
    email: row.email,
    observations: row.observations,
    version: Number(row.version || 1),
    updatedAt: row.updated_at,
    lastEditorName: row.last_editor_name || null,
  };
}

function normalizeMunicipalityPayload(body: any) {
  const name = String(body.name || '').trim().replace(/\s+/g, ' ').slice(0, 255);
  const state = 'SP';
  const phone = String(body.phone || '').trim().slice(0, 100) || null;
  const email = String(body.email || '').trim().toLowerCase().slice(0, 255) || null;
  const observations = String(body.observations || '').trim().slice(0, 10000) || null;
  const source = body.serviceConfig && typeof body.serviceConfig === 'object'
    ? body.serviceConfig
    : {};
  const serviceConfig: Record<string, any> = { activeServices: {} };
  for (const code of Object.keys(OBLIGATIONS)) {
    serviceConfig.activeServices[code] = source.activeServices?.[code] !== false;
  }
  if (!name) return null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return { name, state, phone, email, observations, serviceConfig };
}

async function taskExists(connection: any, taskId: number) {
  const [rows]: any = await connection.query('SELECT id FROM obligation_tasks WHERE id = ? LIMIT 1', [taskId]);
  return rows.length > 0;
}

router.get(
  '/dashboard',
  requirePermission('obrigacoes.dashboard.visualizar'),
  async (req: AuthRequest, res) => {
    const year = positiveInt(req.query.year);
    if (!year || year < 2000 || year > 2100) {
      return sendError(res, 'Exercício inválido.', 400);
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [municipalityRows]: any = await connection.query(
        `SELECT id, name, state, service_config
         FROM obligation_municipalities WHERE active = 1 ORDER BY name`,
      );

      const values: any[][] = [];
      for (const municipality of municipalityRows) {
        for (const [code, competences] of Object.entries(OBLIGATIONS)) {
          if (!isServiceActive(municipality.service_config, code)) continue;
          for (const competence of competences) {
            values.push([
              municipality.id, code, competence, year, 'Falta XML',
              code === 'SIOPS' ? 'Não Solicitado' : null,
              code === 'SIOPE' ? 'Não Solicitado' : null,
              req.user!.id,
              req.user!.id,
            ]);
          }
        }
      }
      if (values.length > 0) {
        await connection.query(
          `INSERT IGNORE INTO obligation_tasks
            (municipality_id, obligation_code, competence, year, status, siops_membros, siope_folha, created_by, updated_by)
           VALUES ?`,
          [values],
        );
      }

      const [taskRows]: any = await connection.query(
        `SELECT id, municipality_id, obligation_code, competence, year, status, updated_at
         FROM obligation_tasks WHERE year = ?`,
        [year],
      );
      const [previousTaskRows]: any = await connection.query(
        `SELECT id, municipality_id, obligation_code, competence, year, status, updated_at
         FROM obligation_tasks WHERE year = ?`,
        [year - 1],
      );
      const [completionRows]: any = await connection.query(
        `SELECT h.task_id, h.actor_name, h.created_at AS completed_at
         FROM obligation_task_history h
         INNER JOIN (
           SELECT task_id, MIN(id) AS first_completed_id
           FROM obligation_task_history
           WHERE field_changed = 'status' AND new_value IN ('Enviado', 'Homologado')
           GROUP BY task_id
         ) first_completed ON first_completed.first_completed_id = h.id
         INNER JOIN obligation_tasks t ON t.id = h.task_id
         WHERE t.year IN (?, ?)`,
        [year, year - 1],
      );
      const [lastEditRows]: any = await connection.query(
        `SELECT h.task_id, h.actor_name
         FROM obligation_task_history h
         INNER JOIN (
           SELECT task_id, MAX(id) AS latest_id
           FROM obligation_task_history
           GROUP BY task_id
         ) latest ON latest.latest_id = h.id
         INNER JOIN obligation_tasks t ON t.id = h.task_id
         WHERE t.year = ?`,
        [year],
      );
      await connection.commit();

      const municipalityById = new Map<number, any>(
        municipalityRows.map((row: any) => [Number(row.id), row]),
      );
      const completionByTask = new Map<number, { actor: string; completedAt: Date }>(
        completionRows
          .filter((row: any) => String(row.actor_name || '').trim())
          .map((row: any) => [Number(row.task_id), {
            actor: String(row.actor_name).trim(),
            completedAt: new Date(row.completed_at),
          }]),
      );
      const lastEditorByTask = new Map<number, string>(
        lastEditRows.map((row: any) => [Number(row.task_id), String(row.actor_name)]),
      );
      const activeTasks = taskRows.filter((task: any) => {
        const municipality = municipalityById.get(Number(task.municipality_id));
        return municipality && isServiceActive(municipality.service_config, task.obligation_code);
      });
      const previousActiveTasks = previousTaskRows.filter((task: any) => {
        const municipality = municipalityById.get(Number(task.municipality_id));
        return municipality && isServiceActive(municipality.service_config, task.obligation_code);
      });

      const statusCounts: Record<string, number> = Object.fromEntries(
        Array.from(STATUSES).map((status) => [status, 0]),
      );
      const obligationStats: Record<string, { completed: number; pending: number; total: number }> = {};
      const obligationCompetenceStats: Record<string, Record<string, { completed: number; pending: number }>> = {};
      const municipalityStats: Record<string, { completed: number; pending: number; total: number }> = {};
      const competenceStats: Record<string, { completed: number; pending: number; total: number }> = {};
      const overdue = {
        total: 0,
        byObligation: {} as Record<string, number>,
        byMunicipality: {} as Record<string, number>,
      };
      const taskItems: any[] = [];
      const now = new Date();
      const todayKey = dateKeyInSaoPaulo(now);
      const trendMap = new Map<string, { period: string; completed: number; missed: number }>();

      for (const task of activeTasks) {
        const municipality = municipalityById.get(Number(task.municipality_id));
        const municipalityName = municipality?.name || 'Outro';
        const code = String(task.obligation_code);
        const competence = String(task.competence);
        const completed = isCompleted(task.status);
        statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;

        obligationStats[code] ||= { completed: 0, pending: 0, total: 0 };
        obligationCompetenceStats[code] ||= {};
        obligationCompetenceStats[code][competence] ||= { completed: 0, pending: 0 };
        municipalityStats[municipalityName] ||= { completed: 0, pending: 0, total: 0 };
        competenceStats[competence] ||= { completed: 0, pending: 0, total: 0 };
        const buckets = [obligationStats[code], municipalityStats[municipalityName], competenceStats[competence]];
        for (const bucket of buckets) {
          bucket.total += 1;
          bucket[completed ? 'completed' : 'pending'] += 1;
        }
        obligationCompetenceStats[code][competence][completed ? 'completed' : 'pending'] += 1;

        const completion = completed ? completionByTask.get(Number(task.id)) : null;

        if (isOverdue(task.status, code, competence, Number(task.year))) {
          overdue.total += 1;
          overdue.byObligation[code] = (overdue.byObligation[code] || 0) + 1;
          overdue.byMunicipality[municipalityName] = (overdue.byMunicipality[municipalityName] || 0) + 1;
        }

        const dueDate = getDueDate(competence, Number(task.year));
        const dueKey = dateKeyInSaoPaulo(dueDate);
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / 86_400_000);
        const completedOnTime = completed && completion
          ? completion.completedAt.getTime() <= dueDate.getTime()
          : null;
        const overdueNow = !completed && dueDate.getTime() < now.getTime();
        const deadlineSituation = completed
          ? 'completed'
          : overdueNow
            ? 'overdue'
            : dueKey === todayKey
              ? 'today'
              : daysUntilDue <= 7
                ? 'soon'
                : 'scheduled';
        const stale = !completed && now.getTime() - new Date(task.updated_at).getTime() >= 14 * 86_400_000;
        const blocked = task.status === 'Pendência Cliente' || task.status === 'Retificar';
        taskItems.push({
          id: Number(task.id),
          municipalityId: Number(task.municipality_id),
          municipalityName,
          obligationCode: code,
          competence,
          year: Number(task.year),
          status: task.status,
          dueDate: dueDate.toISOString(),
          updatedAt: new Date(task.updated_at).toISOString(),
          lastEditorName: lastEditorByTask.get(Number(task.id)) || null,
          completedAt: completion?.completedAt.toISOString() || null,
          completedOnTime,
          deadlineSituation,
          stale,
          blocked,
        });

        const period = dueKey.slice(0, 7);
        const trend = trendMap.get(period) || { period, completed: 0, missed: 0 };
        if (completed) trend.completed += 1;
        if ((completed && completedOnTime === false) || overdueNow) trend.missed += 1;
        trendMap.set(period, trend);
      }

      const completed = (statusCounts.Enviado || 0) + (statusCounts.Homologado || 0);
      const totalTasks = activeTasks.length;
      const onTimeKnown = taskItems.filter((task) => task.completedOnTime !== null);
      const onTimeCount = onTimeKnown.filter((task) => task.completedOnTime).length;
      const previousCompleted = previousActiveTasks.filter((task: any) => isCompleted(task.status)).length;
      const previousOverdue = previousActiveTasks.filter((task: any) => (
        isOverdue(task.status, task.obligation_code, task.competence, Number(task.year))
      )).length;

      return sendSuccess(res, {
        year,
        totalMunicipalities: municipalityRows.length,
        totalTasks,
        completed,
        pending: totalTasks - completed,
        completionRate: totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0,
        statusCounts,
        obligationStats,
        obligationCompetenceStats,
        municipalityStats,
        competenceStats,
        overdue,
        taskItems,
        deadlineTrend: Array.from(trendMap.values()).sort((a, b) => a.period.localeCompare(b.period)),
        onTime: {
          count: onTimeCount,
          sampleSize: onTimeKnown.length,
          rate: onTimeKnown.length > 0 ? Math.round((onTimeCount / onTimeKnown.length) * 100) : null,
        },
        previousPeriod: previousActiveTasks.length > 0 ? {
          year: year - 1,
          totalTasks: previousActiveTasks.length,
          completed: previousCompleted,
          overdue: previousOverdue,
          completionRate: Math.round((previousCompleted / previousActiveTasks.length) * 100),
        } : null,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      await connection.rollback();
      console.error('[Obligations] Falha ao carregar dashboard:', error);
      return sendError(res, 'Não foi possível carregar o dashboard de obrigações.');
    } finally {
      connection.release();
    }
  },
);

router.get(
  '/municipalities',
  requirePermission('obrigacoes.municipios.visualizar'),
  async (_req: AuthRequest, res) => {
    try {
      const [municipalityResult]: any = await pool.query(
        `SELECT m.id, m.name, m.state, m.service_config, m.phone, m.email, m.observations,
                m.version, m.updated_at, editor.nome AS last_editor_name
         FROM obligation_municipalities m
         LEFT JOIN usuarios editor ON editor.id = m.updated_by
         WHERE m.active = 1 ORDER BY m.name`,
      );
      return sendSuccess(res, {
        municipalities: municipalityResult.map(mapMunicipality),
      });
    } catch (error) {
      console.error('[Obligations] Falha ao listar municípios:', error);
      return sendError(res, 'Não foi possível carregar os municípios.');
    }
  },
);

router.post(
  '/municipalities',
  requirePermission('obrigacoes.municipios.criar'),
  async (req: AuthRequest, res) => {
    const payload = normalizeMunicipalityPayload(req.body);
    if (!payload) return sendError(res, 'Revise o nome, estado e e-mail informados.', 400);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result]: any = await connection.query(
        `INSERT INTO obligation_municipalities
          (name, state, service_config, phone, email, observations, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [payload.name, payload.state, JSON.stringify(payload.serviceConfig), payload.phone, payload.email,
          payload.observations, req.user!.id, req.user!.id],
      );
      await connection.query(
        `INSERT INTO obligation_municipality_history
          (municipality_id, user_id, actor_name, action, changes_json)
         VALUES (?, ?, ?, 'created', ?)`,
        [result.insertId, req.user!.id, req.user!.nome, JSON.stringify({ before: null, after: payload })],
      );
      const [rows]: any = await connection.query(
        `SELECT m.id, m.name, m.state, m.service_config, m.phone, m.email, m.observations,
                m.version, m.updated_at, editor.nome AS last_editor_name
         FROM obligation_municipalities m
         LEFT JOIN usuarios editor ON editor.id = m.updated_by
         WHERE m.id = ?`,
        [result.insertId],
      );
      await connection.commit();
      return sendSuccess(res, mapMunicipality(rows[0]), 'Município cadastrado.', 201);
    } catch (error: any) {
      await connection.rollback();
      if (error?.code === 'ER_DUP_ENTRY') return sendError(res, 'Este município já está cadastrado neste estado.', 409);
      console.error('[Obligations] Falha ao cadastrar município:', error);
      return sendError(res, 'Não foi possível cadastrar o município.');
    } finally {
      connection.release();
    }
  },
);

router.put(
  '/municipalities/:id',
  requirePermission('obrigacoes.municipios.editar'),
  async (req: AuthRequest, res) => {
    const municipalityId = positiveInt(req.params.id);
    const expectedVersion = positiveInt(req.body.version);
    const payload = normalizeMunicipalityPayload(req.body);
    if (!municipalityId || !expectedVersion || !payload) return sendError(res, 'Dados do município ou versão inválidos.', 400);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [currentRows]: any = await connection.query(
        `SELECT id, name, state, service_config, phone, email, observations, version, updated_at
         FROM obligation_municipalities WHERE id = ? AND active = 1 FOR UPDATE`,
        [municipalityId],
      );
      if (!currentRows.length) {
        await connection.rollback();
        return sendError(res, 'Município não encontrado.', 404);
      }
      if (Number(currentRows[0].version) !== expectedVersion) {
        await connection.rollback();
        return sendError(res, 'Este município foi alterado por outra pessoa. Recarregue os dados antes de salvar novamente.', 409);
      }
      await connection.query(
        `UPDATE obligation_municipalities
         SET name = ?, state = ?, service_config = ?, phone = ?, email = ?, observations = ?,
             updated_by = ?, version = version + 1
         WHERE id = ? AND active = 1 AND version = ?`,
        [payload.name, payload.state, JSON.stringify(payload.serviceConfig), payload.phone, payload.email,
          payload.observations, req.user!.id, municipalityId, expectedVersion],
      );
      await connection.query(
        `INSERT INTO obligation_municipality_history
          (municipality_id, user_id, actor_name, action, changes_json)
         VALUES (?, ?, ?, 'updated', ?)`,
        [municipalityId, req.user!.id, req.user!.nome, JSON.stringify({
          before: mapMunicipality(currentRows[0]),
          after: payload,
        })],
      );
      const [rows]: any = await connection.query(
        `SELECT m.id, m.name, m.state, m.service_config, m.phone, m.email, m.observations,
                m.version, m.updated_at, editor.nome AS last_editor_name
         FROM obligation_municipalities m
         LEFT JOIN usuarios editor ON editor.id = m.updated_by
         WHERE m.id = ?`,
        [municipalityId],
      );
      await connection.commit();
      return sendSuccess(res, mapMunicipality(rows[0]), 'Município atualizado.');
    } catch (error: any) {
      await connection.rollback();
      if (error?.code === 'ER_DUP_ENTRY') return sendError(res, 'Este município já está cadastrado neste estado.', 409);
      console.error('[Obligations] Falha ao atualizar município:', error);
      return sendError(res, 'Não foi possível atualizar o município.');
    } finally {
      connection.release();
    }
  },
);

router.delete(
  '/municipalities/:id',
  requirePermission('obrigacoes.municipios.excluir'),
  async (req: AuthRequest, res) => {
    const municipalityId = positiveInt(req.params.id);
    const expectedVersion = positiveInt(req.query.version);
    if (!municipalityId || !expectedVersion) return sendError(res, 'Município ou versão inválidos.', 400);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [currentRows]: any = await connection.query(
        `SELECT id, name, state, service_config, phone, email, observations, version, updated_at
         FROM obligation_municipalities WHERE id = ? AND active = 1 FOR UPDATE`,
        [municipalityId],
      );
      if (!currentRows.length) {
        await connection.rollback();
        return sendError(res, 'Município não encontrado.', 404);
      }
      if (Number(currentRows[0].version) !== expectedVersion) {
        await connection.rollback();
        return sendError(res, 'Este município foi alterado por outra pessoa. Recarregue os dados antes de desativá-lo.', 409);
      }
      await connection.query(
        `UPDATE obligation_municipalities
         SET active = 0, updated_by = ?, version = version + 1
         WHERE id = ? AND active = 1 AND version = ?`,
        [req.user!.id, municipalityId, expectedVersion],
      );
      await connection.query(
        `INSERT INTO obligation_municipality_history
          (municipality_id, user_id, actor_name, action, changes_json)
         VALUES (?, ?, ?, 'deactivated', ?)`,
        [municipalityId, req.user!.id, req.user!.nome, JSON.stringify({
          before: mapMunicipality(currentRows[0]),
          after: { active: false },
        })],
      );
      await connection.commit();
      return sendSuccess(res, { id: municipalityId }, 'Município desativado.');
    } catch (error) {
      await connection.rollback();
      console.error('[Obligations] Falha ao excluir município:', error);
      return sendError(res, 'Não foi possível excluir o município.');
    } finally {
      connection.release();
    }
  },
);

router.get(
  '/workspace',
  requirePermission('obrigacoes.planilha.visualizar'),
  async (req: AuthRequest, res) => {
    const scope = parseScope(req);
    if (!scope) return sendError(res, 'Obrigação ou exercício inválido.', 400);

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [municipalityRows]: any = await connection.query(
        `SELECT id, name, state, service_config, phone, email, observations, version, updated_at
         FROM obligation_municipalities WHERE active = 1 ORDER BY name`,
      );
      const activeMunicipalities = municipalityRows.filter((row: any) =>
        isServiceActive(row.service_config, scope.obligationCode),
      );

      const values = activeMunicipalities.flatMap((municipality: any) =>
        scope.competences.map((competence) => [
          municipality.id,
          scope.obligationCode,
          competence,
          scope.year,
          'Falta XML',
          scope.obligationCode === 'SIOPS' ? 'Não Solicitado' : null,
          scope.obligationCode === 'SIOPE' ? 'Não Solicitado' : null,
          req.user!.id,
          req.user!.id,
        ]),
      );
      if (values.length > 0) {
        await connection.query(
          `INSERT IGNORE INTO obligation_tasks
            (municipality_id, obligation_code, competence, year, status, siops_membros, siope_folha, created_by, updated_by)
           VALUES ?`,
          [values],
        );
      }

      const [taskRows]: any = await connection.query(
        `SELECT t.id, t.municipality_id, t.obligation_code, t.competence, t.year, t.status,
                t.siops_membros, t.siope_folha, t.updated_at, t.version,
                editor.nome AS last_editor_name
         FROM obligation_tasks t
         LEFT JOIN usuarios editor ON editor.id = t.updated_by
         WHERE t.year = ? AND t.obligation_code = ?`,
        [scope.year, scope.obligationCode],
      );
      const activeIds = new Set(activeMunicipalities.map((row: any) => Number(row.id)));
      const tasks = taskRows.filter((row: any) => activeIds.has(Number(row.municipality_id))).map(mapTask);

      const [commentRows]: any = await connection.query(
        `SELECT c.id, c.task_id, c.author_name, c.text, c.created_at
         FROM obligation_task_comments c
         JOIN obligation_tasks t ON t.id = c.task_id
         WHERE t.year = ? AND t.obligation_code = ?
         ORDER BY c.created_at`,
        [scope.year, scope.obligationCode],
      );
      const commentsMap: Record<number, any[]> = {};
      for (const comment of commentRows) {
        const taskId = Number(comment.task_id);
        (commentsMap[taskId] ||= []).push({
          id: Number(comment.id), taskId, authorName: comment.author_name,
          text: comment.text, createdAt: comment.created_at,
        });
      }
      await connection.commit();
      return sendSuccess(res, {
        municipalities: activeMunicipalities.map((row: any) => mapMunicipality(row)),
        tasks,
        commentsMap,
        competences: scope.competences,
      });
    } catch (error) {
      await connection.rollback();
      console.error('[Obligations] Falha ao carregar planilha:', error);
      return sendError(res, 'Não foi possível carregar a Planilha Principal.');
    } finally {
      connection.release();
    }
  },
);

router.get(
  '/tasks/:id/details',
  requirePermission('obrigacoes.planilha.visualizar'),
  async (req: AuthRequest, res) => {
    const taskId = positiveInt(req.params.id);
    if (!taskId) return sendError(res, 'Tarefa inválida.', 400);
    try {
      const [historyRows, commentRows, attachmentRows] = await Promise.all([
        pool.query(
          `SELECT id, task_id, field_changed, old_value, new_value, actor_name,
                  observation, created_at
           FROM obligation_task_history WHERE task_id = ? ORDER BY created_at DESC, id DESC`,
          [taskId],
        ),
        pool.query(
          `SELECT id, task_id, author_name, text, created_at
           FROM obligation_task_comments WHERE task_id = ? ORDER BY created_at, id`,
          [taskId],
        ),
        pool.query(
          `SELECT id, task_id, file_name, file_type, file_size, uploaded_at
           FROM obligation_task_attachments WHERE task_id = ? ORDER BY uploaded_at DESC, id DESC`,
          [taskId],
        ),
      ]);
      return sendSuccess(res, {
        history: (historyRows[0] as any[]).map((row) => ({
          id: Number(row.id), taskId: Number(row.task_id), fieldChanged: row.field_changed,
          oldValue: row.old_value, newValue: row.new_value, actorName: row.actor_name,
          observation: row.observation, createdAt: row.created_at,
        })),
        comments: (commentRows[0] as any[]).map((row) => ({
          id: Number(row.id), taskId: Number(row.task_id), authorName: row.author_name,
          text: row.text, createdAt: row.created_at,
        })),
        attachments: (attachmentRows[0] as any[]).map((row) => ({
          id: Number(row.id), taskId: Number(row.task_id), fileName: row.file_name,
          fileType: row.file_type, fileSize: Number(row.file_size), uploadedAt: row.uploaded_at,
        })),
      });
    } catch (error) {
      console.error('[Obligations] Falha ao carregar detalhes:', error);
      return sendError(res, 'Não foi possível carregar os detalhes da competência.');
    }
  },
);

router.put(
  '/tasks/:id',
  requirePermission('obrigacoes.planilha.editar'),
  async (req: AuthRequest, res) => {
    const taskId = positiveInt(req.params.id);
    const expectedVersion = positiveInt(req.body.version);
    const status = req.body.status === undefined ? undefined : String(req.body.status);
    const siopsMembros = req.body.siopsMembros === undefined ? undefined : String(req.body.siopsMembros);
    const siopeFolha = req.body.siopeFolha === undefined ? undefined : String(req.body.siopeFolha);
    const observation = String(req.body.observation || '').trim().slice(0, 5000) || null;
    if (!taskId || !expectedVersion || (status !== undefined && !STATUSES.has(status)) ||
        (siopsMembros !== undefined && !AUXILIARY_STATUSES.has(siopsMembros)) ||
        (siopeFolha !== undefined && !AUXILIARY_STATUSES.has(siopeFolha))) {
      return sendError(res, 'Dados da atualização inválidos.', 400);
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows]: any = await connection.query(
        `SELECT t.*, m.service_config FROM obligation_tasks t
         JOIN obligation_municipalities m ON m.id = t.municipality_id
         WHERE t.id = ? FOR UPDATE`,
        [taskId],
      );
      if (rows.length === 0) {
        await connection.rollback();
        return sendError(res, 'Competência não encontrada.', 404);
      }
      const current = rows[0];
      if (Number(current.version || 1) !== expectedVersion) {
        await connection.rollback();
        return sendError(res, 'Esta obrigação foi alterada por outra pessoa. Recarregue os dados antes de salvar novamente.', 409);
      }
      const actor = req.user!;
      const historyValues: any[][] = [];

      const recordChange = (id: number, field: string, oldValue: unknown, newValue: unknown) => {
        historyValues.push([id, field, oldValue ?? null, newValue ?? null, actor.id, actor.nome, observation]);
      };

      if (current.status === 'Falta XML' && status === 'Não iniciado') {
        const related = new Set<string>();
        for (const [code, competences] of Object.entries(OBLIGATIONS)) {
          if (competences.includes(current.competence)) related.add(`${code}|${current.competence}`);
        }
        const monthToBimester: Record<string, string> = {
          Fevereiro: '1º Bimestre', Abril: '2º Bimestre', Junho: '3º Bimestre',
          Agosto: '4º Bimestre', Outubro: '5º Bimestre', Dezembro: '6º Bimestre',
        };
        const monthToQuarter: Record<string, string> = {
          Abril: '1º Quadrimestre', Agosto: '2º Quadrimestre', Dezembro: '3º Quadrimestre',
        };
        const bimester = monthToBimester[current.competence];
        if (bimester) ['RREO', 'SIOPE', 'SIOPS'].forEach((code) => related.add(`${code}|${bimester}`));
        const quarter = monthToQuarter[current.competence];
        if (quarter) related.add(`RGF|${quarter}`);
        if (current.competence === 'Encerramento') related.add('DCA|Anual');

        for (const item of related) {
          const [code, competence] = item.split('|');
          if (!isServiceActive(current.service_config, code)) continue;
          await connection.query(
            `INSERT IGNORE INTO obligation_tasks
              (municipality_id, obligation_code, competence, year, status, siops_membros, siope_folha, created_by, updated_by)
             VALUES (?, ?, ?, ?, 'Falta XML', ?, ?, ?, ?)`,
            [current.municipality_id, code, competence, current.year,
             code === 'SIOPS' ? 'Não Solicitado' : null, code === 'SIOPE' ? 'Não Solicitado' : null,
             actor.id, actor.id],
          );
          const [relatedRows]: any = await connection.query(
            `SELECT id, status FROM obligation_tasks
             WHERE municipality_id = ? AND obligation_code = ? AND competence = ? AND year = ? FOR UPDATE`,
            [current.municipality_id, code, competence, current.year],
          );
          const relatedTask = relatedRows[0];
          if (relatedTask?.status === 'Falta XML') {
            await connection.query(
              "UPDATE obligation_tasks SET status = 'Não iniciado', updated_by = ?, version = version + 1 WHERE id = ?",
              [actor.id, relatedTask.id],
            );
            recordChange(Number(relatedTask.id), 'status', 'Falta XML', 'Não iniciado');
          }
        }
      } else if (status !== undefined && status !== current.status) {
        await connection.query(
          'UPDATE obligation_tasks SET status = ?, updated_by = ?, version = version + 1 WHERE id = ?',
          [status, actor.id, taskId],
        );
        recordChange(taskId, 'status', current.status, status);
      }

      if (siopsMembros !== undefined && siopsMembros !== current.siops_membros) {
        await connection.query(
          'UPDATE obligation_tasks SET siops_membros = ?, updated_by = ?, version = version + 1 WHERE id = ?',
          [siopsMembros, actor.id, taskId],
        );
        recordChange(taskId, 'siopsMembros', current.siops_membros, siopsMembros);
      }
      if (siopeFolha !== undefined && siopeFolha !== current.siope_folha) {
        await connection.query(
          'UPDATE obligation_tasks SET siope_folha = ?, updated_by = ?, version = version + 1 WHERE id = ?',
          [siopeFolha, actor.id, taskId],
        );
        recordChange(taskId, 'siopeFolha', current.siope_folha, siopeFolha);
      }
      if (historyValues.length > 0) {
        await connection.query(
          `INSERT INTO obligation_task_history
            (task_id, field_changed, old_value, new_value, user_id, actor_name, observation) VALUES ?`,
          [historyValues],
        );
      }
      const [updatedRows]: any = await connection.query(
        `SELECT t.*, editor.nome AS last_editor_name
         FROM obligation_tasks t
         LEFT JOIN usuarios editor ON editor.id = t.updated_by
         WHERE t.id = ?`,
        [taskId],
      );
      await connection.commit();
      return sendSuccess(res, mapTask(updatedRows[0]), 'Competência atualizada.');
    } catch (error) {
      await connection.rollback();
      console.error('[Obligations] Falha ao atualizar competência:', error);
      return sendError(res, 'Não foi possível atualizar a competência.');
    } finally {
      connection.release();
    }
  },
);

router.put(
  '/history/:id',
  requirePermission('obrigacoes.planilha.editar_historico'),
  async (req: AuthRequest, res) => {
    const historyId = positiveInt(req.params.id);
    const expectedTaskVersion = positiveInt(req.body.taskVersion);
    const oldValue = req.body.oldValue == null ? null : String(req.body.oldValue).slice(0, 500);
    const newValue = req.body.newValue == null ? null : String(req.body.newValue).slice(0, 500);
    const observation = req.body.observation == null ? null : String(req.body.observation).trim().slice(0, 5000);
    if (!historyId || !expectedTaskVersion) return sendError(res, 'Histórico ou versão inválidos.', 400);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows]: any = await connection.query(
        'SELECT * FROM obligation_task_history WHERE id = ? FOR UPDATE', [historyId],
      );
      if (rows.length === 0) {
        await connection.rollback();
        return sendError(res, 'Registro histórico não encontrado.', 404);
      }
      const history = rows[0];
      const [taskRows]: any = await connection.query(
        'SELECT * FROM obligation_tasks WHERE id = ? FOR UPDATE', [history.task_id],
      );
      if (taskRows.length === 0) {
        await connection.rollback();
        return sendError(res, 'Competência não encontrada.', 404);
      }
      if (Number(taskRows[0].version || 1) !== expectedTaskVersion) {
        await connection.rollback();
        return sendError(res, 'Esta obrigação foi alterada por outra pessoa. Recarregue os dados antes de corrigir o histórico.', 409);
      }
      const allowedField: Record<string, string> = {
        status: 'status', siopsMembros: 'siops_membros', siopeFolha: 'siope_folha',
      };
      const taskColumn = allowedField[history.field_changed];
      if (!taskColumn) throw new Error('Campo histórico inválido.');
      if (newValue) {
        await connection.query(
          `UPDATE obligation_tasks SET ${taskColumn} = ?, updated_by = ?, version = version + 1 WHERE id = ?`,
          [newValue, req.user!.id, history.task_id],
        );
      }
      await connection.query(
        `UPDATE obligation_task_history
         SET old_value = ?, new_value = ?, actor_name = ?, user_id = ?, observation = ? WHERE id = ?`,
        [oldValue, newValue, req.user!.nome, req.user!.id, observation, historyId],
      );
      const [updatedTaskRows]: any = await connection.query(
        `SELECT t.*, editor.nome AS last_editor_name
         FROM obligation_tasks t
         LEFT JOIN usuarios editor ON editor.id = t.updated_by
         WHERE t.id = ?`,
        [history.task_id],
      );
      await connection.commit();
      return sendSuccess(res, { id: historyId, task: mapTask(updatedTaskRows[0]) }, 'Histórico corrigido.');
    } catch (error) {
      await connection.rollback();
      console.error('[Obligations] Falha ao corrigir histórico:', error);
      return sendError(res, 'Não foi possível corrigir o histórico.');
    } finally {
      connection.release();
    }
  },
);

router.post(
  '/tasks/:id/comments',
  requirePermission('obrigacoes.planilha.comentar'),
  async (req: AuthRequest, res) => {
    const taskId = positiveInt(req.params.id);
    const text = String(req.body.text || '').trim().slice(0, 5000);
    if (!taskId || !text) return sendError(res, 'Informe um comentário válido.', 400);
    try {
      if (!await taskExists(pool, taskId)) return sendError(res, 'Competência não encontrada.', 404);
      const [result]: any = await pool.query(
        `INSERT INTO obligation_task_comments (task_id, author_id, author_name, text)
         VALUES (?, ?, ?, ?)`,
        [taskId, req.user!.id, req.user!.nome, text],
      );
      const [rows]: any = await pool.query('SELECT * FROM obligation_task_comments WHERE id = ?', [result.insertId]);
      const row = rows[0];
      return sendSuccess(res, {
        id: Number(row.id), taskId: Number(row.task_id), authorName: row.author_name,
        text: row.text, createdAt: row.created_at,
      }, 'Comentário adicionado.', 201);
    } catch (error) {
      console.error('[Obligations] Falha ao comentar:', error);
      return sendError(res, 'Não foi possível adicionar o comentário.');
    }
  },
);

router.post(
  '/tasks/:id/attachments',
  requirePermission('obrigacoes.planilha.anexar'),
  upload.single('file'),
  async (req: AuthRequest, res) => {
    const taskId = positiveInt(req.params.id);
    if (!taskId || !req.file) return sendError(res, 'Selecione um arquivo válido.', 400);
    try {
      if (!await taskExists(pool, taskId)) return sendError(res, 'Competência não encontrada.', 404);
      const [result]: any = await pool.query(
        `INSERT INTO obligation_task_attachments
          (task_id, uploaded_by, file_name, file_type, file_size, file_data)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [taskId, req.user!.id, req.file.originalname, req.file.mimetype || 'application/octet-stream', req.file.size, req.file.buffer],
      );
      return sendSuccess(res, {
        id: Number(result.insertId), taskId, fileName: req.file.originalname,
        fileType: req.file.mimetype, fileSize: req.file.size, uploadedAt: new Date().toISOString(),
      }, 'Arquivo anexado.', 201);
    } catch (error) {
      console.error('[Obligations] Falha ao anexar:', error);
      return sendError(res, 'Não foi possível anexar o arquivo.');
    }
  },
);

router.get(
  '/attachments/:id',
  requirePermission('obrigacoes.planilha.anexar'),
  async (req: AuthRequest, res) => {
    const attachmentId = positiveInt(req.params.id);
    if (!attachmentId) return sendError(res, 'Anexo inválido.', 400);
    try {
      const [rows]: any = await pool.query(
        'SELECT file_name, file_type, file_size, file_data FROM obligation_task_attachments WHERE id = ?',
        [attachmentId],
      );
      if (rows.length === 0) return sendError(res, 'Anexo não encontrado.', 404);
      const file = rows[0];
      res.setHeader('Content-Type', file.file_type || 'application/octet-stream');
      res.setHeader('Content-Length', String(file.file_size));
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.file_name)}`);
      return res.send(file.file_data);
    } catch (error) {
      console.error('[Obligations] Falha ao baixar anexo:', error);
      return sendError(res, 'Não foi possível baixar o anexo.');
    }
  },
);

export default router;
