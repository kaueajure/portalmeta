import React, { useState, useEffect } from 'react';
import { Check, HelpCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { PricingSettings } from '../../types';

interface PublicPricingPageProps {
  onNavigate: (path: string) => void;
}

const DEFAULT_PRICING_SETTINGS: PricingSettings = {
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

export const PublicPricingPage = ({ onNavigate }: PublicPricingPageProps) => {
  const [settings, setSettings] = useState<PricingSettings>(DEFAULT_PRICING_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await api.get<PricingSettings>('/public-settings/pricing');
        if (data) setSettings(data);
      } catch (error) {
        console.error('Falha ao carregar configurações de preços:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-white">
        <RefreshCw size={32} className="text-blue-500 animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-500 tracking-tight">Carregando planos e preços...</p>
      </div>
    );
  }

  const activePlans = settings.plans
    .filter(p => p.active)
    .sort((a, b) => a.order - b.order);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const getPlanMode = (plan: any) => {
    return plan.priceMode || (typeof plan.priceMonthly === 'number' ? 'fixed' : 'consult');
  };

  const getMonthlyPrice = (plan: any) => {
    const mode = getPlanMode(plan);
    if (mode === 'consult' || typeof plan.priceMonthly !== 'number') return null;

    if (billingCycle === 'monthly') return plan.priceMonthly;

    const discount = settings.billing?.annualDiscountPercent || 0;
    return plan.priceMonthly * (1 - discount / 100);
  };

  const hasFixedPricePlan = activePlans.some(plan => getPlanMode(plan) === 'fixed');
  const shouldShowBillingToggle = settings.billing?.showBillingToggle && hasFixedPricePlan;

  return (
    <div className="flex flex-col bg-white">
      {/* Header */}
      <section className="pt-20 pb-16 px-6 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">
            {settings.header.title}
          </h1>
          <p className="text-lg font-medium text-slate-500 leading-relaxed max-w-xl mx-auto">
            {settings.header.subtitle}
          </p>

          {shouldShowBillingToggle && (
            <div className="pt-8 flex flex-col items-center gap-4">
              <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                    billingCycle === 'monthly'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {settings.billing?.monthlyLabel || 'Mensal'}
                </button>
                <button
                  onClick={() => setBillingCycle('annual')}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                    billingCycle === 'annual'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {settings.billing?.annualLabel || 'Anual'}
                </button>
              </div>
              
              {billingCycle === 'annual' && settings.billing?.annualDiscountPercent && (
                <div className="text-emerald-600 text-[13px] font-bold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 animate-in fade-in zoom-in-95">
                  {settings.billing.annualEconomyText.replace('{discount}', settings.billing.annualDiscountPercent.toString())}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Pricing Grid */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6 items-stretch">
             {activePlans.map((plan, i) => {
                const mode = getPlanMode(plan);
                const displayPrice = getMonthlyPrice(plan);
                
                return (
                  <div key={plan.id || i} className={`relative p-6 rounded-xl border flex flex-col ${plan.highlight ? 'bg-white border-blue-600 shadow-xl z-10 scale-[1.02]' : 'bg-white border-slate-200 shadow-sm mt-0 md:mt-2'}`}>
                    
                    {plan.highlight && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                         {plan.highlightText}
                      </div>
                    )}

                    <div className="space-y-2 mb-6">
                      {!plan.highlight && <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{plan.highlightText}</div>}
                      <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                      <p className="text-[13px] font-medium text-slate-500 leading-snug">{plan.target}</p>
                    </div>
                    
                    <div className="mb-6 min-h-[60px]">
                       {mode === 'consult' ? (
                         <span className="text-2xl font-bold tracking-tight text-slate-900">
                           {plan.priceLabel || 'Sob consulta'}
                         </span>
                       ) : (
                         <div className="space-y-1">
                           <div className="flex items-baseline gap-1">
                             <span className="text-3xl font-bold tracking-tight text-slate-900">
                               {displayPrice !== null ? formatCurrency(displayPrice) : '---'}
                             </span>
                             <span className="text-sm font-semibold text-slate-400">/mês</span>
                           </div>

                           {billingCycle === 'annual' && displayPrice !== null && (
                             <p className="text-xs font-bold text-emerald-600">
                               Cobrado anualmente: {formatCurrency(displayPrice * 12)}/ano
                             </p>
                           )}
                           
                           {billingCycle === 'annual' && settings.billing?.annualDiscountPercent && (
                             <div className="mt-1">
                               <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                 {settings.billing.annualDiscountPercent}% OFF
                               </span>
                             </div>
                           )}
                         </div>
                       )}
                    </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-start gap-3">
                         <div className={`mt-0.5 rounded-full p-0.5 ${plan.highlight ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'}`}>
                           <Check size={14} strokeWidth={3} />
                         </div>
                         <span className="text-[13px] font-bold text-slate-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button 
                    onClick={() => onNavigate('/contato')}
                    className={`h-11 w-full rounded-lg text-[14px] font-bold transition-all ${
                      plan.highlight 
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' 
                        : 'bg-white text-slate-700 hover:bg-slate-50 border-2 border-slate-200'
                    }`}
                  >
                    Solicitar Proposta
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* O que influencia */}
      <section className="py-16 px-6 bg-slate-50 border-t border-slate-100">
         <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center text-slate-900 tracking-tight mb-10">O que influencia a proposta?</h2>
            
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
              {settings.proposalFactors.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border border-slate-100">
                   <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                   <span className="text-sm font-bold text-slate-700">{item}</span>
                </div>
              ))}
            </div>
         </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-6 bg-white border-t border-slate-100">
         <div className="max-w-3xl mx-auto space-y-10">
            <div className="text-center space-y-4">
              <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">Perguntas sobre Planos</h2>
            </div>
            
            <div className="space-y-4">
               {settings.faq.map((faq, idx) => (
                 <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-xl shadow-sm">
                   <h4 className="text-[14px] font-bold text-slate-900 flex items-center gap-2 mb-2">
                     <HelpCircle size={16} className="text-blue-600" /> {faq.question || (faq as any).q}
                   </h4>
                   <p className="text-[13px] text-slate-600 font-medium leading-relaxed pl-6">{faq.answer || (faq as any).a}</p>
                 </div>
               ))}
            </div>
         </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 px-6 bg-slate-50 border-t border-slate-100 text-center">
         <div className="max-w-2xl mx-auto space-y-6">
           <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">{settings.cta.title}</h2>
           <p className="text-slate-500 text-base lg:text-lg font-medium">{settings.cta.subtitle}</p>
           <div className="pt-2 flex justify-center">
             <button 
               onClick={() => onNavigate('/contato')}
               className="h-11 px-6 bg-blue-600 text-white text-[14px] font-bold rounded-lg hover:bg-blue-700 transition-all shadow-sm flex items-center justify-center gap-2"
             >
               {settings.cta.buttonText} <ArrowRight size={18} />
             </button>
           </div>
         </div>
      </section>
    </div>
  );
};
