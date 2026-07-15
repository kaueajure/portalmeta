import { Router } from 'express';
import pool from '../db/connection.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permissions.middleware.js';
import { sendSuccess, sendError } from '../utils/response.js';
const router = Router();
const DEFAULT_PRICING_SETTINGS = {
    header: {
        title: "Planos para diferentes fases da sua operação.",
        subtitle: "O Gestifique pode ser adaptado ao tamanho da sua equipe, volume de tickets e necessidade de gestão de desempenho."
    },
    billing: {
        annualDiscountPercent: 20,
        showBillingToggle: true,
        monthlyLabel: "Mensal",
        annualLabel: "Anual",
        annualEconomyText: "Economize {discount}% no plano anual"
    },
    plans: [
        {
            id: "inicial",
            name: "Inicial",
            target: "Equipes que estão organizando o fluxo.",
            highlightText: "Para sair da planilha",
            priceLabel: "Sob consulta",
            priceMode: "consult",
            priceMonthly: null,
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
            priceMode: "consult",
            priceMonthly: null,
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
            priceMode: "consult",
            priceMonthly: null,
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
// GET /api/public-settings/pricing - PUBLIC
router.get('/pricing', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT settings_json FROM public_page_settings WHERE page_key = ?', ['pricing']);
        if (rows.length === 0) {
            return sendSuccess(res, DEFAULT_PRICING_SETTINGS);
        }
        let settings = rows[0].settings_json;
        if (typeof settings === 'string') {
            try {
                settings = JSON.parse(settings);
            }
            catch (e) {
                return sendSuccess(res, DEFAULT_PRICING_SETTINGS);
            }
        }
        // Compatibilidade e sanitização
        if (!settings.billing) {
            settings.billing = DEFAULT_PRICING_SETTINGS.billing;
        }
        if (Array.isArray(settings.plans)) {
            settings.plans = settings.plans.map((plan) => ({
                ...plan,
                priceMode: plan.priceMode || (typeof plan.priceMonthly === 'number' ? 'fixed' : 'consult'),
                priceMonthly: typeof plan.priceMonthly === 'number' ? plan.priceMonthly : null,
                priceLabel: plan.priceLabel || 'Sob consulta'
            }));
        }
        sendSuccess(res, settings);
    }
    catch (error) {
        console.error('[PublicSettings] Error fetching pricing settings:', error);
        sendSuccess(res, DEFAULT_PRICING_SETTINGS);
    }
});
// PUT /api/public-settings/pricing - GR_EDIT
router.put('/pricing', authMiddleware, requirePermission('telas.precos.editar'), async (req, res) => {
    const { header, billing, plans, proposalFactors, faq, cta } = req.body;
    if (!header || !header.title || !header.subtitle) {
        return sendError(res, 'Título e subtítulo do cabeçalho são obrigatórios.');
    }
    if (!Array.isArray(plans)) {
        return sendError(res, 'Os planos devem ser um array.');
    }
    if (!cta || !cta.title || !cta.buttonText) {
        return sendError(res, 'Dados do CTA incompletos.');
    }
    try {
        // Validar e sanitizar billing
        const finalBilling = {
            annualDiscountPercent: Math.min(90, Math.max(0, Number(billing?.annualDiscountPercent) || 0)),
            showBillingToggle: Boolean(billing?.showBillingToggle),
            monthlyLabel: (billing?.monthlyLabel || 'Mensal').trim(),
            annualLabel: (billing?.annualLabel || 'Anual').trim(),
            annualEconomyText: (billing?.annualEconomyText || 'Economize {discount}% no plano anual').trim()
        };
        // Validar e sanitizar planos
        const sanitizedPlans = plans.map((plan) => {
            const mode = plan.priceMode === 'fixed' ? 'fixed' : 'consult';
            return {
                ...plan,
                id: (plan.id || `plan-${Date.now()}-${Math.random()}`).toString(),
                name: (plan.name || 'Sem nome').trim(),
                target: (plan.target || '').trim(),
                highlightText: (plan.highlightText || '').trim(),
                priceMode: mode,
                priceMonthly: mode === 'fixed' ? Math.max(0, Number(plan.priceMonthly) || 0) : null,
                priceLabel: (plan.priceLabel || 'Sob consulta').trim(),
                features: Array.isArray(plan.features) ? plan.features.map((f) => f.trim()).filter(Boolean) : [],
                highlight: Boolean(plan.highlight),
                active: Boolean(plan.active),
                order: Number(plan.order) || 0
            };
        });
        const settingsJson = JSON.stringify({
            header: {
                title: header.title.trim(),
                subtitle: header.subtitle.trim()
            },
            billing: finalBilling,
            plans: sanitizedPlans,
            proposalFactors: Array.isArray(proposalFactors) ? proposalFactors.map((f) => f.trim()).filter(Boolean) : [],
            faq: Array.isArray(faq) ? faq.map((f) => ({
                question: (f.question || '').trim(),
                answer: (f.answer || '').trim()
            })).filter((f) => f.question && f.answer) : [],
            cta: {
                title: cta.title.trim(),
                subtitle: (cta.subtitle || '').trim(),
                buttonText: cta.buttonText.trim()
            }
        });
        await pool.query(`
      INSERT INTO public_page_settings (page_key, settings_json, updated_by)
      VALUES ('pricing', ?, ?)
      ON DUPLICATE KEY UPDATE
        settings_json = VALUES(settings_json),
        updated_by = VALUES(updated_by),
        updated_at = NOW()
    `, [settingsJson, req.user.id]);
        sendSuccess(res, JSON.parse(settingsJson), 'Configuração de preços atualizada com sucesso.');
    }
    catch (error) {
        console.error('[PublicSettings] Error updating pricing settings:', error);
        sendError(res, 'Erro ao salvar configurações de preços.');
    }
});
// POST /api/public-settings/pricing/reset - ADMIN/DEV
router.post('/pricing/reset', authMiddleware, requirePermission('telas.precos.resetar'), async (req, res) => {
    try {
        const settingsJson = JSON.stringify(DEFAULT_PRICING_SETTINGS);
        await pool.query(`
      INSERT INTO public_page_settings (page_key, settings_json, updated_by)
      VALUES ('pricing', ?, ?)
      ON DUPLICATE KEY UPDATE
        settings_json = VALUES(settings_json),
        updated_by = VALUES(updated_by),
        updated_at = NOW()
    `, [settingsJson, req.user.id]);
        sendSuccess(res, DEFAULT_PRICING_SETTINGS, 'Configurações de preços restauradas para o padrão.');
    }
    catch (error) {
        console.error('[PublicSettings] Error resetting pricing settings:', error);
        sendError(res, 'Erro ao restaurar configurações padrão.');
    }
});
export default router;
