import React from 'react';
import { ArrowRight, Ticket, Clock, CheckCircle2, ShieldCheck, Zap, Users, LayoutDashboard, Database, Check, HelpCircle, BarChart3, Inbox } from 'lucide-react';

interface PublicHomePageProps {
  onNavigate: (path: string) => void;
}

export const PublicHomePage = ({ onNavigate }: PublicHomePageProps) => {
  return (
    <div className="flex flex-col bg-white">
      {/* Hero */}
      <section className="pt-20 pb-16 px-6 lg:pt-24 lg:pb-16 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-50/50 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/4" />
        
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          <div className="flex-1 space-y-6 text-center lg:text-left z-10">
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 leading-[1.15]">
              Centralize atendimentos, controle SLAs e organize sua equipe.
            </h1>
            <p className="text-base lg:text-lg text-slate-500 font-medium leading-relaxed max-w-2xl mx-auto lg:mx-0">
              O Gestifique ajuda empresas a transformar e-mails soltos, solicitações informais e demandas urgentes em tickets organizados, rastreáveis e mensuráveis.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
               <button 
                 onClick={() => onNavigate('/contato')}
                 className="w-full sm:w-auto h-11 px-6 bg-blue-600 text-white text-[14px] font-bold rounded-lg hover:bg-blue-700 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
               >
                 Solicitar demonstração <ArrowRight size={18} />
               </button>
               <button 
                 onClick={() => onNavigate('/funcionalidades')}
                 className="w-full sm:w-auto h-11 px-6 bg-white border border-slate-200 text-slate-700 text-[14px] font-bold rounded-lg hover:bg-slate-50 transition-all flex items-center justify-center"
               >
                 Ver todas as funcionalidades
               </button>
            </div>
            <div className="flex justify-center lg:justify-start pt-2">
               <button 
                 onClick={() => onNavigate('/demonstracao')}
                 className="text-[13px] font-bold text-blue-600 hover:text-blue-700 hover:underline transition-all flex items-center gap-1"
               >
                 Ver prévia do sistema <ArrowRight size={14} />
               </button>
            </div>
            
            <div className="flex flex-wrap justify-center lg:justify-start gap-6 pt-6 text-[13px] font-semibold text-slate-500">
               <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-500"/> Implantação rápida </span>
               <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-500"/> Portal do cliente </span>
               <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-500"/> Controle de SLA </span>
               <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-500"/> Foco em operação B2B </span>
            </div>
          </div>
          
          <div className="flex-1 w-full max-w-[500px] lg:max-w-none relative z-10">
             <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden flex flex-col">
               <div className="h-10 bg-slate-900 flex items-center px-4 gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                  <div className="ml-4 h-5 w-48 bg-white/10 rounded text-[10px] flex items-center px-2 text-white/50 font-mono">app.gestifique.com.br</div>
               </div>
               <div className="flex-1 p-5 bg-slate-50">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-bold text-slate-900 text-base">Visão Geral</h3>
                    <div className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">Hoje</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div className="bg-white p-3 rounded-lg border border-red-100 shadow-sm relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">SLA Atrasado</span>
                       <div className="text-2xl font-bold text-slate-900 mt-1">4</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Abertos hoje</span>
                       <div className="text-2xl font-bold text-slate-900 mt-1">18</div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                     {[
                       { id: '#4092', title: 'Dúvida faturamento mensal', status: 'Novo', prio: 'Alta', color: 'bg-emerald-100 text-emerald-700' },
                       { id: '#4091', title: 'Erro de acesso portal', status: 'Em Análise', prio: 'Urgente', color: 'bg-blue-100 text-blue-700' },
                       { id: '#4090', title: 'Atualização de plano', status: 'Aguard. Cliente', prio: 'Média', color: 'bg-orange-100 text-orange-700' },
                     ].map((item, i) => (
                       <div key={i} className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between shadow-sm">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                               {item.id}
                             </div>
                             <div>
                                <div className="text-[13px] font-bold text-slate-900">{item.title}</div>
                                <div className="text-[11px] font-medium text-slate-500 mt-0.5">{item.prio} • Há 15 min</div>
                             </div>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded ${item.color}`}>
                            {item.status}
                          </span>
                       </div>
                     ))}
                  </div>
               </div>
             </div>
          </div>
        </div>
      </section>

      {/* Pain Section */}
      <section className="py-16 px-6 bg-slate-50 border-t border-slate-100">
         <div className="max-w-6xl mx-auto space-y-10">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">Quando o atendimento cresce, planilhas e mensagens soltas viram problema.</h2>
              <p className="text-base lg:text-lg text-slate-600">Processos informais não escalam. Veja onde a operação costuma quebrar:</p>
            </div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
               {[
                 { icon: Inbox, title: "Chamados perdidos", desc: "E-mails que ficam sem resposta e problemas que caem no esquecimento coletivo." },
                 { icon: Users, title: "Síndrome do \"de quem é?\"", desc: "Ninguém sabe quem pegou a demanda ou de quem é a responsabilidade técnica." },
                 { icon: ShieldCheck, title: "Cliente no escuro", desc: "Seu cliente B2B precisa perguntar toda hora sobre o status da solicitação." },
                 { icon: BarChart3, title: "Gestor sem dados", desc: "Impossível saber volume de demanda, tempo médio de resposta ou quem produz mais." }
               ].map((pain, idx) => (
                 <div key={idx} className="bg-white border border-slate-200 p-5 rounded-xl space-y-3 shadow-sm hover:shadow-md transition-shadow">
                   <pain.icon className="text-red-500" size={20} />
                   <h3 className="text-base font-bold text-slate-900">{pain.title}</h3>
                   <p className="text-sm text-slate-600 leading-relaxed">{pain.desc}</p>
                 </div>
               ))}
            </div>
         </div>
      </section>

      {/* Solution Section */}
      <section className="py-16 px-6 bg-white">
         <div className="max-w-6xl mx-auto space-y-12">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">Com o Gestifique, cada solicitação vira um fluxo claro.</h2>
              <p className="text-base lg:text-lg text-slate-500">Uma esteira completa que vai do acionamento pelo cliente até o encerramento pela equipe técnica.</p>
            </div>
            
            <div className="grid sm:grid-cols-4 gap-8 relative">
               <div className="hidden sm:block absolute top-[24px] left-[10%] right-[10%] h-0.5 bg-slate-200" />
               
               {[
                 { step: 1, title: 'Cliente aciona', desc: 'Abertura via portal de forma estruturada.' },
                 { step: 2, title: 'Equipe organiza', desc: 'Classificação e definição de responsável.' },
                 { step: 3, title: 'SLA visual', desc: 'Tempos de resposta acompanhados.' },
                 { step: 4, title: 'Gestor analisa', desc: 'Relatórios sobre a saúde da operação.' }
               ].map((item, idx) => (
                 <div key={idx} className="relative z-10 flex flex-col items-center text-center space-y-3">
                   <div className="w-12 h-12 bg-white border-4 border-slate-50 rounded-full shadow-sm flex items-center justify-center text-base font-bold text-blue-600">
                     {item.step}
                   </div>
                   <div className="space-y-1.5">
                     <h4 className="font-bold text-slate-900 text-base">{item.title}</h4>
                     <p className="text-sm font-medium text-slate-500 leading-relaxed px-2">{item.desc}</p>
                   </div>
                 </div>
               ))}
            </div>
         </div>
      </section>

      {/* Core Features */}
      <section className="py-16 px-6 bg-slate-50 border-t border-slate-100">
         <div className="max-w-6xl mx-auto space-y-12">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">Tudo para estruturar sua operação B2B</h2>
              <p className="text-base lg:text-lg text-slate-500">Módulos essenciais sem a complexidade desnecessária de softwares encorpados.</p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
               {[
                 { icon: Ticket, title: "Central de Chamados", desc: "Organize por status, categoria, prioridade e mantenha histórico completo para auditoria." },
                 { icon: Clock, title: "Controle de SLA", desc: "Tempos de resposta e resolução claramente definidos para garantir a entrega prometida ao cliente." },
                 { icon: LayoutDashboard, title: "Portal do Cliente B2B", desc: "Seus clientes empresariais ganham acesso a um portal dedicado para acompanhar suas demandas." },
                 { icon: Database, title: "Base de Conhecimento", desc: "Crie artigos para resolução rápida de incidentes e reduza a abertura de tickets por dúvidas comuns." },
                 { icon: BarChart3, title: "Dashboard Operacional", desc: "Mensure produtividade da equipe, volume de chamados e prioridades pendentes." },
                 { icon: Zap, title: "Fluxos e Produtividade", desc: "Poupe tempo com regras operacionais flexíveis e templates padrão de resposta." }
               ].map((feature, idx) => (
                 <div key={idx} className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mb-4">
                      <feature.icon size={20} />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mb-2">{feature.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">{feature.desc}</p>
                 </div>
               ))}
            </div>
         </div>
      </section>

      {/* Para quem é & Diferenciais (Before/After) */}
      <section className="py-16 px-6 bg-white border-t border-slate-100">
         <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10">
            <div className="space-y-6">
               <div>
                 <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 mb-3">Para quem o Gestifique é ideal?</h2>
                 <p className="text-base lg:text-lg text-slate-500 mb-6">Nascemos para atender operações estruturadas que precisam de rastreabilidade, mas recusam a complexidade de sistemas legados.</p>
               </div>
               
               <ul className="space-y-3">
                 {[
                   "Equipes de Suporte B2B e Customer Success",
                   "Help Desk e Service Desk interno de TI",
                   "Operações Administrativas e Facilities",
                   "Contabilidade, DP e Jurídico de alto volume"
                 ].map((item, idx) => (
                   <li key={idx} className="flex items-center gap-3 text-sm font-bold text-slate-700">
                     <CheckCircle2 size={18} className="text-blue-600" /> {item}
                   </li>
                 ))}
               </ul>
            </div>
            
            <div className="bg-white p-5 lg:p-6 rounded-xl border border-slate-200 shadow-md space-y-5">
               <h3 className="text-lg font-bold text-slate-900 text-center">Do caos à operação</h3>
               <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1 space-y-3">
                     <div className="text-xs font-bold text-slate-400 uppercase tracking-tight text-center pb-2 border-b border-slate-100">Como é hoje</div>
                     <ul className="space-y-3">
                       {['Caixa de e-mail lotada', 'Cliente cobrando avulso', 'Relatórios manuais', 'Prazos violados'].map((t, i) => (
                         <li key={i} className="text-[13px] font-medium text-slate-600 flex items-start gap-2">
                            <span className="text-red-400 mt-0.5 block">✕</span> <span>{t}</span>
                         </li>
                       ))}
                     </ul>
                  </div>
                  <div className="flex-1 space-y-3">
                     <div className="text-xs font-bold text-blue-600 uppercase tracking-tight text-center pb-2 border-b border-blue-50">Com Gestifique</div>
                     <ul className="space-y-3">
                       {['Central de chamados estruturada', 'Portal cliente transparente', 'Dashboard operacional', 'SLA visual por urgência'].map((t, i) => (
                         <li key={i} className="text-[13px] font-bold text-slate-800 flex items-start gap-2">
                            <Check size={14} className="text-emerald-500 mt-0.5 block" /> <span>{t}</span>
                         </li>
                       ))}
                     </ul>
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-6 bg-slate-50 border-t border-slate-100">
         <div className="max-w-3xl mx-auto space-y-10">
            <div className="text-center space-y-3">
              <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">Perguntas Frequentes</h2>
            </div>
            
            <div className="space-y-4">
               {[
                 { q: 'O Gestifique atende operações de TI interna?', a: 'Sim. Você pode usar a plataforma tanto para clientes externos B2B quanto para chamados internos (manutenção, acessos, equipamentos).' },
                 { q: 'Existe um limite de empresas ou clientes a cadastrar?', a: 'Depende do plano escolhido, mas nossa arquitetura é feita para suportar desde poucas dezenas até múltiplas unidades e clientes.' },
                 { q: 'Posso configurar SLA para diferentes urgências?', a: 'Sim. A plataforma permite determinar os tempos exatos para resposta e resolução conforme a prioridade (Baixa, Média, Alta, Urgente).' },
                 { q: 'As métricas estão disponíveis a qualquer momento?', a: 'Sim. O Dashboard é atualizado constantemente com informações operacionais recentes para evitar extrações manuais.' },
                 { q: 'O formulário de contato envia e-mail automático?', a: 'Ainda não. O formulário público atual é um registro local de intenção. A melhor via de contato comercial por enquanto é enviando e-mail para contato@gestifique.com.br.' },
               ].map((faq, idx) => (
                 <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                   <h4 className="text-[14px] font-bold text-slate-900 flex items-center gap-2 mb-2">
                     <HelpCircle size={16} className="text-blue-600" /> {faq.q}
                   </h4>
                   <p className="text-[13px] text-slate-600 font-medium leading-relaxed pl-6">{faq.a}</p>
                 </div>
               ))}
            </div>
         </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 px-6 bg-white border-t border-slate-100 text-center">
         <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Pronto para organizar seu atendimento?</h2>
            <p className="text-slate-500 text-base lg:text-lg font-medium">Deixe a rotina caótica no passado. Fale conosco e entenda como usar o Gestifique na sua operação.</p>
            <div className="pt-2 flex justify-center">
              <button 
                 onClick={() => onNavigate('/contato')}
                 className="h-11 px-6 bg-blue-600 text-white text-[14px] font-bold rounded-lg hover:bg-blue-700 transition-all shadow-sm flex items-center justify-center gap-2"
               >
                 Solicitar uma demonstração <ArrowRight size={18} />
               </button>
            </div>
         </div>
      </section>
    </div>
  );
};

