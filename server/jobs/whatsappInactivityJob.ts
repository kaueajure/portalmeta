import { whatsappService } from '../services/whatsapp.service.js';

/**
 * Encerra atendimentos WhatsApp ativos sem resposta do cliente
 * após o tempo configurado desde a última mensagem da empresa.
 */
export async function runWhatsAppInactivityJob(): Promise<void> {
  if (!whatsappService.isConfigured()) return;

  try {
    const result = await whatsappService.closeInactiveAttendances();
    if (result.closed > 0) {
      console.log(`[WhatsApp] Encerrados ${result.closed} atendimento(s) por inatividade.`);
    }
  } catch (err) {
    console.error('[WhatsApp] Erro no job de inatividade:', err);
  }
}
