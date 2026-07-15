import React from 'react';
import { Ticket, Clock, Users, ShieldCheck, CheckCircle2, Zap, PieChart, Activity, ArrowRight } from 'lucide-react';

interface PublicFeaturesPageProps {
  onNavigate: (path: string) => void;
}

export const PublicFeaturesPage = ({ onNavigate }: PublicFeaturesPageProps) => {
  const modules = [
    {
      title: "Gestão de Chamados",
      desc: "O motor da sua operação de suporte.",
      icon: Ticket,
      features: [
        { title: "Criação Estruturada", desc: "Abertura de chamados com tipificação clara e campos obrigatórios para evitar idas e vindas de informações." },
        { title: "Status e Workflow", desc: "Fluxos de status (Aberto, Em andamento, Pendente Cliente, Resolvido) que refletem a vida real." },
        { title: "Prioridade Dinâmica", desc: "Classifique a urgência para guiar o trabalho da equipe." },
        { title: "Definição de Responsável", desc: "Fim do 'de quem é?'. Todo chamado tem um dono claro." }
      ]
    },
    {
      title: "Operação e Produtividade",
      desc: "Ferramentas para o atendente trabalhar rápido.",
      icon: Zap,
      features: [
        { title: "Painel do Atendente", desc: "Caixa de entrada centralizada: o que precisa ser feito hoje, sem distrações." },
        { title: "Comentários Internos", desc: "Discuta o chamado com a equipe técnica sem que o cliente veja a conversa de bastidor." },
        { title: "Respostas Prontas", desc: "Catálogo de respostas padrão (Macros) para incidentes comuns. Um clique, problema explicado." },
        { title: "Histórico Completo", desc: "Histórico completo de alterações. Saiba quem mudou o status, quando respondeu e quem assumiu o chamado." }
      ]
    },
    {
      title: "SLA e Controle",
      desc: "Garantia de que o combinado será entregue.",
      icon: Clock,
      features: [
        { title: "Prazo de Primeira Resposta", desc: "Garante que o cliente não fique no vácuo logo após abrir a solicitação." },
        { title: "Prazo de Resolução", desc: "Controle rígido do tempo aceitável para entregar a solução definitiva." },
        { title: "Foco no que Importa", desc: "Chamados críticos ganham destaque visual para orientar a equipe." },
        { title: "Controle de Prazos", desc: "O acompanhamento de SLA considera o status atual do chamado e ajuda a priorizar chamados críticos." }
      ]
    },
    {
      title: "Cliente e Conhecimento",
      desc: "Empodere o cliente e reduza volume.",
      icon: Users,
      features: [
        { title: "Portal do Cliente (B2B)", desc: "Seus clientes fazem login e veem exatamente o status das demandas, sem precisar mandar e-mail/WhatsApp." },
        { title: "Base de Conhecimento", desc: "Artigos práticos integrados ao portal para autoatendimento ('Como resetar senha', etc)." },
        { title: "Pesquisa de Satisfação", desc: "Pesquisa de satisfação vinculada ao encerramento do chamado." },
        { title: "Acesso pelo Portal", desc: "O cliente acessa o portal para abrir e acompanhar chamados de forma estruturada." }
      ]
    },
    {
      title: "Gestão e Relatórios",
      desc: "Visibilidade operacional para os líderes.",
      icon: PieChart,
      features: [
        { title: "Dashboard Operacional", desc: "Visão imediata do dia: chamados abertos, atrasados e taxa de resolução atual." },
        { title: "Indicadores de Desempenho", desc: "Saiba quais categorias geram mais demanda e onde a equipe gasta mais tempo." },
        { title: "Métricas Individuais", desc: "Analise a produtividade e a saúde do SLA filtrado por cada atendente." },
        { title: "Permissões de Acesso", desc: "Visão segmentada. O cliente só vê o que é dele, atendente o que opera e o gestor vê tudo." }
      ]
    }
  ];

  return (
    <div className="flex flex-col bg-white">
      {/* Header */}
      <section className="pt-20 pb-16 px-6 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">
            Tudo que sua equipe precisa para atender melhor.
          </h1>
          <p className="text-lg font-medium text-slate-500 leading-relaxed max-w-2xl mx-auto">
            Do primeiro contato até a resolução, o Gestifique organiza cada etapa do suporte sem a poluição visual de sistemas antigos.
          </p>
        </div>
      </section>

      {/* Modules */}
      <section className="py-16 px-6 bg-slate-50 flex-1">
        <div className="max-w-5xl mx-auto space-y-14">
          {modules.map((module, i) => (
            <div key={i} className="scroll-mt-24 space-y-8">
               <div className="flex items-center gap-4 border-b border-slate-200 pb-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl text-blue-700 flex items-center justify-center">
                    <module.icon size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{module.title}</h2>
                    <p className="text-sm font-medium text-slate-500 mt-1">{module.desc}</p>
                  </div>
               </div>

               <div className="grid md:grid-cols-2 gap-4 pt-4">
                 {module.features.map((feat, j) => (
                   <div key={j} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <h3 className="text-[14px] font-bold text-slate-900 mb-2 flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-500" /> {feat.title}
                      </h3>
                      <p className="text-[13px] text-slate-600 font-medium leading-relaxed">{feat.desc}</p>
                   </div>
                 ))}
               </div>
            </div>
          ))}
        </div>
      </section>

      {/* Como muda o dia a dia */}
      <section className="py-14 px-6 bg-white border-y border-slate-200">
         <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-center text-slate-900 tracking-tight mb-10">Como isso muda o dia a dia da operação?</h2>
            <div className="grid md:grid-cols-3 gap-8">
               <div className="text-center space-y-3 p-4">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                    <Users size={18} />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">Para o Atendente</h3>
                  <p className="text-[13px] text-slate-500 font-medium leading-relaxed">Ele sabe o que precisa ser feito primeiro. A visualização de SLA ajuda o atendente a priorizar o que exige atenção.</p>
               </div>
               <div className="text-center space-y-3 p-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                    <Activity size={18} />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">Para o Gestor</h3>
                  <p className="text-[13px] text-slate-500 font-medium leading-relaxed">Fim do achismo. Ele sabe exatamente quantos chamados caíram na semana, onde estão os gargalos e quem é o mais focado.</p>
               </div>
               <div className="text-center space-y-3 p-4">
                  <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mx-auto mb-3">
                    <ShieldCheck size={18} />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">Para o Cliente</h3>
                  <p className="text-[13px] text-slate-500 font-medium leading-relaxed">Transparência total. Ele acompanha o andamento em tempo real e se sente seguro de que nada foi esquecido.</p>
               </div>
            </div>
         </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 px-6 bg-white border-t border-slate-100 text-center">
         <div className="max-w-2xl mx-auto space-y-6">
           <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">Parece com o que você procura?</h2>
           <p className="text-slate-500 text-base lg:text-lg font-medium">Veja essas funcionalidades em uma demonstração guiada.</p>
           <div className="pt-2 flex justify-center">
             <button 
               onClick={() => onNavigate('/contato')}
               className="h-11 px-6 bg-blue-600 text-white text-[14px] font-bold rounded-lg hover:bg-blue-700 transition-all shadow-sm flex items-center justify-center gap-2"
             >
               Solicitar demonstração guiada <ArrowRight size={18} />
             </button>
           </div>
         </div>
      </section>
    </div>
  );
};
