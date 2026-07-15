import pool from '../db/connection.js';
import { runAutomations } from '../services/automations.service.js';
// Fase 1 (escalabilidade): nome do lock distribuído (MySQL GET_LOCK) que impede
// a execução simultânea das automações em múltiplas instâncias/processos.
const AUTOMATION_LOCK_NAME = 'gestifique:ticket-automations';
const AUTOMATION_TICKET_BATCH_SIZE = 200;
const SLA_UPDATE_BATCH_SIZE = 1000;
async function runBatchedUpdate(sql, params = []) {
    while (true) {
        const [result] = await pool.query(`${sql} LIMIT ${SLA_UPDATE_BATCH_SIZE}`, params);
        if (!result?.affectedRows || result.affectedRows < SLA_UPDATE_BATCH_SIZE)
            break;
    }
}
const executeTicketAutomations = async () => {
    try {
        const [regras] = await pool.query("SELECT * FROM ticket_automacoes WHERE ativo = 1 AND evento IN ('tempo_sem_interacao', 'aguardando_cliente_por_tempo', 'sla_primeira_resposta_vencido', 'sla_resolucao_vencido')");
        for (const regra of regras) {
            let query = "";
            let params = [];
            if (regra.evento === 'sla_resolucao_vencido') {
                query = `
           SELECT * FROM tickets 
           WHERE deleted_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM empresa_ticket_status status_cfg
             WHERE status_cfg.empresa_id = tickets.empresa_id
               AND status_cfg.valor = tickets.status
               AND status_cfg.especial IN ('finalizado', 'encerrado', 'aguardando_cliente')
           )
           AND sla_pausado_em IS NULL
           AND sla_status_operacional != 'pausado'
           AND (sla_resolucao_status != 'violado' OR sla_resolucao_status IS NULL)
           AND prazo_sla < NOW()
           AND empresa_id = ?
         `;
                params = [regra.empresa_id];
            }
            else if (regra.evento === 'sla_primeira_resposta_vencido') {
                query = `
           SELECT * FROM tickets 
           WHERE deleted_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM empresa_ticket_status status_cfg
             WHERE status_cfg.empresa_id = tickets.empresa_id
               AND status_cfg.valor = tickets.status
               AND status_cfg.especial IN ('finalizado', 'encerrado', 'aguardando_cliente')
           )
           AND primeira_resposta_em IS NULL
           AND (sla_primeira_resposta_status = 'aguardando' OR sla_primeira_resposta_status IS NULL)
           AND prazo_primeira_resposta < NOW()
           AND empresa_id = ?
         `;
                params = [regra.empresa_id];
            }
            else if (regra.evento === 'aguardando_cliente_por_tempo') {
                // This typically requires at least one condition of "hours_since_update" in the Rule
                // But for simplicity in the job, we'll just fetch tickets in that status
                query = `
           SELECT * FROM tickets 
           WHERE deleted_at IS NULL
           AND EXISTS (
             SELECT 1 FROM empresa_ticket_status status_cfg
             WHERE status_cfg.empresa_id = tickets.empresa_id
               AND status_cfg.valor = tickets.status
               AND status_cfg.especial = 'aguardando_cliente'
           )
           AND empresa_id = ?
         `;
                params = [regra.empresa_id];
            }
            else if (regra.evento === 'tempo_sem_interacao') {
                query = `
           SELECT * FROM tickets 
           WHERE deleted_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM empresa_ticket_status status_cfg
             WHERE status_cfg.empresa_id = tickets.empresa_id
               AND status_cfg.valor = tickets.status
               AND status_cfg.especial IN ('finalizado', 'encerrado')
           )
           AND empresa_id = ?
         `;
                params = [regra.empresa_id];
            }
            if (query) {
                let lastId = 0;
                while (true) {
                    const [tickets] = await pool.query(`${query}
              AND id > ?
              ORDER BY id ASC
              LIMIT ?`, [...params, lastId, AUTOMATION_TICKET_BATCH_SIZE]);
                    if (tickets.length === 0)
                        break;
                    for (const ticket of tickets) {
                        // runAutomations internally evaluates conditions (like hours_since_update)
                        await runAutomations(regra.evento, ticket, { isInternalAutomation: false, usuario_id: null });
                        lastId = Number(ticket.id) || lastId;
                    }
                    if (tickets.length < AUTOMATION_TICKET_BATCH_SIZE)
                        break;
                }
            }
        }
        // Baseline SLA violation update for tickets without specific rules.
        // Sprint 2: Respect paused tickets
        await runBatchedUpdate(`
      UPDATE tickets 
      SET sla_resolucao_status = 'violado', 
          sla_status_operacional = 'violado',
          updated_at = NOW() 
      WHERE NOT EXISTS (
        SELECT 1 FROM empresa_ticket_status status_cfg
        WHERE status_cfg.empresa_id = tickets.empresa_id
          AND status_cfg.valor = tickets.status
          AND status_cfg.especial IN ('finalizado', 'encerrado', 'aguardando_cliente')
      )
      AND (sla_resolucao_status != 'violado' OR sla_resolucao_status IS NULL)
      AND sla_pausado_em IS NULL
      AND prazo_sla < NOW()
      AND deleted_at IS NULL
    `);
        await runBatchedUpdate(`
      UPDATE tickets 
      SET sla_primeira_resposta_status = 'violado', 
          updated_at = NOW() 
      WHERE NOT EXISTS (
        SELECT 1 FROM empresa_ticket_status status_cfg
        WHERE status_cfg.empresa_id = tickets.empresa_id
          AND status_cfg.valor = tickets.status
          AND status_cfg.especial IN ('finalizado', 'encerrado', 'aguardando_cliente')
      )
      AND primeira_resposta_em IS NULL
      AND (sla_primeira_resposta_status = 'aguardando' OR sla_primeira_resposta_status IS NULL)
      AND prazo_primeira_resposta < NOW()
      AND deleted_at IS NULL
    `);
        // Sync other operacional statuses for non-paused, non-resolved tickets
        await runBatchedUpdate(`
      UPDATE tickets
      SET sla_status_operacional = CASE
        WHEN prazo_sla < NOW() THEN 'vencido'
        WHEN prazo_sla BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 HOUR) THEN 'vencendo'
        ELSE 'dentro_sla'
      END
      WHERE NOT EXISTS (
        SELECT 1 FROM empresa_ticket_status status_cfg
        WHERE status_cfg.empresa_id = tickets.empresa_id
          AND status_cfg.valor = tickets.status
          AND status_cfg.especial IN ('finalizado', 'encerrado', 'aguardando_cliente')
      )
      AND sla_pausado_em IS NULL
      AND deleted_at IS NULL
      AND prazo_sla IS NOT NULL
      AND (
        sla_status_operacional IS NULL
        OR sla_status_operacional <> CASE
          WHEN prazo_sla < NOW() THEN 'vencido'
          WHEN prazo_sla BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 HOUR) THEN 'vencendo'
          ELSE 'dentro_sla'
        END
      )
    `);
    }
    catch (err) {
        console.error('[Automations] Erro ao rodar rotina de automacao:', err);
    }
};
/**
 * Wrapper público com lock distribuído (MySQL GET_LOCK).
 *
 * Garante execução ÚNICA das automações mesmo que múltiplas instâncias/processos
 * estejam com ENABLE_TICKET_JOBS=true. O lock é por sessão (conexão), então:
 *  - adquirimos o lock numa conexão dedicada,
 *  - mantemos essa conexão durante toda a execução,
 *  - liberamos o lock em finally e só então devolvemos a conexão ao pool.
 *
 * Se outra instância já detém o lock, este ciclo é pulado sem erro.
 * NÃO é um lock global do app — protege apenas o job de automações.
 */
export const runTicketAutomations = async () => {
    const lockConn = await pool.getConnection();
    try {
        // timeout 0 => tenta uma vez e retorna imediatamente.
        const [lockRows] = await lockConn.query('SELECT GET_LOCK(?, 0) AS got', [AUTOMATION_LOCK_NAME]);
        const got = Number(lockRows?.[0]?.got);
        if (got !== 1) {
            console.log('[Automations] Lock ocupado: outra instância já está executando as automações. Ciclo ignorado.');
            return;
        }
        try {
            await executeTicketAutomations();
        }
        finally {
            // Libera o lock sempre, mesmo se a execução falhar.
            await lockConn.query('SELECT RELEASE_LOCK(?)', [AUTOMATION_LOCK_NAME]).catch((relErr) => {
                console.error('[Automations] Falha ao liberar o lock de automações:', relErr);
            });
        }
    }
    catch (err) {
        console.error('[Automations] Erro ao adquirir/executar automações com lock:', err);
    }
    finally {
        // Devolve a conexão ao pool apenas após o RELEASE_LOCK.
        lockConn.release();
    }
};
