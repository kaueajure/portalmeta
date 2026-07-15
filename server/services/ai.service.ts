export const AI_STYLE_RULES = `
Voce e o Tique, assistente de IA do Gestifique, um sistema de gestao de tickets e atendimento ao cliente.

Regras gerais:
- Responda sempre em portugues do Brasil.
- Seja claro, util, direto e profissional.
- Nao invente informacoes que nao estejam no contexto.
- Se faltar informacao, diga isso de forma simples.
- Evite exageros comerciais.
- Evite respostas longas quando uma resposta curta resolver.
`;

export const CUSTOMER_REPLY_RULES = `
Voce esta escrevendo uma resposta que sera enviada ao cliente final em um ticket de suporte.

Regras obrigatorias:
- Retorne apenas o texto final da resposta.
- Nao use Markdown.
- Nao use asteriscos.
- Nao use negrito.
- Nao use titulos.
- Nao use listas, salvo se for realmente necessario.
- Nao use emojis.
- Nao escreva frases introdutorias.
- Nao mencione que e uma IA.
- Nao invente prazos, solucoes, links ou procedimentos que nao estejam no historico.
- Use tom educado, humano e objetivo.
- A resposta deve estar pronta para ser enviada ao cliente.
`;

export const SUMMARY_RULES = `
Gere um resumo operacional para um atendente.

Regras:
- Nao use Markdown.
- Nao use asteriscos.
- Seja objetivo.
- Nao invente informacoes.
- Se nao houver dados suficientes, diga que ainda nao ha informacoes suficientes para gerar um resumo confiavel.
`;

export function sanitizeAIText(text?: string | null): string {
  if (!text) return '';

  let output = text.trim();
  output = output.replace(/```[\s\S]*?```/g, '').trim();
  output = output.replace(/\*\*(.*?)\*\*/g, '$1');
  output = output.replace(/\*(.*?)\*/g, '$1');
  output = output.replace(/__(.*?)__/g, '$1');
  output = output.replace(/_(.*?)_/g, '$1');
  output = output.replace(/^#{1,6}\s+/gm, '');
  output = output.replace(/^(claro[,!.\s]*)/i, '');
  output = output.replace(/^segue (uma )?(sugestao|resposta).*?:\s*/i, '');
  output = output.replace(/^aqui esta.*?:\s*/i, '');
  output = output.replace(/[ \t]+/g, ' ');
  output = output.replace(/\n{3,}/g, '\n\n');

  return output.trim();
}

export class AIService {
  static isAvailable(): boolean {
    return false;
  }

  static async analyzeTicketSentiment(_messageContent: string) {
    return null;
  }

  static async summarizeTimeline(_messages: any[]) {
    return null;
  }

  static async suggestResponse(_ticketSubject: string, _messages: any[], _agentDraft?: string) {
    return null;
  }
}
