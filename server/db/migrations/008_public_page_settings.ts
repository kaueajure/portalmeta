
import { Connection } from 'mysql2/promise';

export async function up(connection: Connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS public_page_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      page_key VARCHAR(100) NOT NULL UNIQUE,
      settings_json JSON NOT NULL,
      updated_by INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_public_page_settings_page_key (page_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Insert default pricing settings if it doesn't exist
  const defaultPricing = {
    header: {
      title: "Planos para diferentes fases da sua operação.",
      subtitle: "O Gestifique pode ser adaptado ao tamanho da sua equipe, volume de tickets e necessidade de gestão de desempenho."
    },
    plans: [
      {
        id: "inicial",
        name: "Inicial",
        target: "Equipes que estão organizando o fluxo.",
        highlightText: "Para sair da planilha",
        priceLabel: "Sob consulta",
        features: [
          "Atendentes limitados (até 5)",
          "Portal do cliente",
          "Criação de tickets padronizados",
          "Pesquisa de satisfação (CSAT)",
          "Relatórios básicos de operação"
        ],
        highlight: false,
        active: true,
        order: 1
      },
      {
        id: "profissional",
        name: "Profissional",
        target: "Operações B2B que precisam de controle.",
        highlightText: "Mais escolhido",
        priceLabel: "Sob consulta",
        features: [
          "Faixa de atendentes personalizada",
          "SLA Estrito (1ª resposta e resolução)",
          "Dashboard operacional",
          "Configurações operacionais",
          "Base de Conhecimento"
        ],
        highlight: true,
        active: true,
        order: 2
      },
      {
        id: "empresarial",
        name: "Empresarial",
        target: "Múltiplas áreas com alta complexidade.",
        highlightText: "Para operações complexas",
        priceLabel: "Sob consulta",
        features: [
          "Gestão Multi-empresa (Multi-tenant)",
          "Auditoria e Logs refinados",
          "Configuração por equipe",
          "Onboarding Dedicado (Implantação)",
          "Condições de suporte conforme proposta"
        ],
        highlight: false,
        active: true,
        order: 3
      }
    ],
    proposalFactors: [
      "Quantidade de Atendentes",
      "Volume mensal de atendimentos",
      "Multi-empresas e marcas",
      "Necessidade rigorosa de SLA",
      "Portal do Cliente para operações B2B",
      "Treinamento de Implantação"
    ],
    faq: [
      {
        question: "Posso começar pequeno?",
        answer: "Com certeza. Muitos clientes iniciam no Plano Inicial para organizar as demandas primárias e migram conforme ganham escala."
      },
      {
        question: "Existe custo de implantação (Setup)?",
        answer: "Depende da complexidade e do plano. Para operações mais estruturadas, recomendamos um setup dedicado para garantir treinamento e aderência."
      },
      {
        question: "Posso usar para atendimento interno apenas?",
        answer: "Sim! Se você for usar para Help Desk de TI ou DP, sem acesso de cliente externo, podemos adequar nossa proposta."
      },
      {
        question: "O preço é estritamente por usuário?",
        answer: "Avaliamos o escopo técnico todo: volume esperado, necessidades, integrações se houverem. Tudo sob consulta."
      },
      {
        question: "Posso solicitar demonstração antes de contratar?",
        answer: "Sim! É mandatório para que tenhamos plena certeza de que seremos a ferramenta correta para o momento de vocês."
      }
    ],
    cta: {
      title: "Vamos montar sua proposta?",
      subtitle: "Converse com nossa equipe para entendermos seu cenário e desenharmos o plano ideal.",
      buttonText: "Falar com consultor agora"
    }
  };

  await connection.query(`
    INSERT IGNORE INTO public_page_settings (page_key, settings_json)
    VALUES ('pricing', ?)
  `, [JSON.stringify(defaultPricing)]);
}
