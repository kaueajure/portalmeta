import React, { useState } from 'react';
import { 
  ArrowRight, Ticket, Clock, CheckCircle2, AlertCircle, 
  LayoutDashboard, Settings, ChevronRight, 
  MessageSquare, Menu, Check, X, BarChart3, Search, FileText, 
  SlidersHorizontal, Users, Building2, Shield, UserCircle, LogOut, BookOpen, User 
} from 'lucide-react';
import { AppLogo } from '../ui/Logo';

interface PublicPreviewPageProps {
  onNavigate: (path: string) => void;
}

type PreviewModule = 
  | 'dashboard' 
  | 'tickets' 
  | 'knowledge' 
  | 'reports' 
  | 'users' 
  | 'companies' 
  | 'settings' 
  | 'logs' 
  | 'profile';

export const PublicPreviewPage = ({ onNavigate }: PublicPreviewPageProps) => {
  const [activeModule, setActiveModule] = useState<PreviewModule>('tickets');

  const previewSections = [
    {
      title: "Operação",
      items: [
        { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
        { id: "tickets", icon: Ticket, label: "Chamados" },
        { id: "knowledge", icon: BookOpen, label: "Base de Conhecimento" },
      ]
    },
    {
      title: "Gestão",
      items: [
        { id: "reports", icon: BarChart3, label: "Relatórios" },
        { id: "users", icon: Users, label: "Equipe" },
        { id: "companies", icon: Building2, label: "Empresas" },
      ]
    },
    {
      title: "Sistema",
      items: [
        { id: "settings", icon: Settings, label: "Configurações" },
        { id: "logs", icon: Shield, label: "Logs do Sistema" },
      ]
    },
    {
      title: "Conta",
      items: [
        { id: "profile", icon: UserCircle, label: "Meu Perfil" },
      ]
    }
  ];

  const moduleMeta = {
    dashboard: { title: 'Dashboard de Controle', subtitle: 'Indicadores simulados da operação de suporte', action: 'Atualizar Tela' },
    tickets: { title: 'Central de Chamados', subtitle: 'Visão geral de demandas da operação', action: 'Novo chamado' },
    knowledge: { title: 'Base de Conhecimento', subtitle: 'Artigos internos e simulados', action: 'Novo Artigo' },
    reports: { title: 'Relatórios Gerenciais', subtitle: 'Métricas de suporte e produtividade', action: 'Exportar' },
    users: { title: 'Equipe', subtitle: 'Gestão de perfis de acesso', action: 'Novo Usuário' },
    companies: { title: 'Empresas Ativas', subtitle: 'Nossos contratos e clientes', action: 'Nova Empresa' },
    settings: { title: 'Configurações', subtitle: 'Preferências e comportamento do sistema', action: 'Salvar Tudo' },
    logs: { title: 'Logs do Sistema', subtitle: 'Auditoria de ações', action: 'Exportar Logs' },
    profile: { title: 'Meu Perfil', subtitle: 'Gerencie suas credenciais', action: 'Salvar Perfil' }
  };

  const renderPreviewContent = () => {
    switch (activeModule) {
      case 'dashboard': return <DashboardPreview />;
      case 'tickets': return <TicketsPreview />;
      case 'knowledge': return <KnowledgePreview />;
      case 'reports': return <ReportsPreview />;
      case 'users': return <UsersPreview />;
      case 'companies': return <CompaniesPreview />;
      case 'settings': return <SettingsPreview />;
      case 'logs': return <LogsPreview />;
      case 'profile': return <ProfilePreview />;
      default: return <TicketsPreview />;
    }
  };

  return (
    <div className="flex flex-col bg-white">
      {/* Hero Section */}
      <section className="pt-20 pb-16 px-6 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold mb-4">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            Prévia Visual
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">
            Veja como o Gestifique organiza sua operação.
          </h1>
          <p className="text-base lg:text-lg font-medium text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Abaixo preparamos uma demonstração da interface logada do sistema. Você pode navegar visualmente entre os módulos simulados.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => onNavigate('/contato')}
              className="h-11 px-6 w-full sm:w-auto bg-blue-600 text-white text-[14px] font-bold rounded-lg hover:bg-blue-700 transition-all shadow-sm flex items-center justify-center gap-2"
            >
              Solicitar demonstração real <ArrowRight size={18} />
            </button>
            <button 
              onClick={() => onNavigate('/funcionalidades')}
              className="h-11 px-6 w-full sm:w-auto bg-white text-slate-700 border border-slate-200 text-[14px] font-bold rounded-lg hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center gap-2"
            >
              Ver funcionalidades <CheckCircle2 size={18} className="text-slate-400" />
            </button>
          </div>
          <p className="text-[12px] text-slate-400 font-medium pt-2">
            * Esta prévia reproduz visualmente a estrutura do sistema logado usando dados simulados. Algumas permissões e telas podem variar conforme o perfil do usuário.
          </p>
        </div>
      </section>

      {/* Main Mockup Section */}
      <section className="py-16 px-6 bg-slate-50 border-b border-slate-200 overflow-hidden">
        <div className="max-w-[1600px] mx-auto">
          {/* Mockup Container */}
          <div className="bg-[#FDFDFF] rounded-xl shadow-md border border-slate-200 overflow-hidden flex min-h-[700px]">
            
            {/* Sidebar */}
            <div className="hidden lg:flex flex-col w-56 bg-white border-r border-slate-200/60 z-10 shrink-0">
               <div className="h-12 flex items-center justify-between px-4 border-b border-slate-100 shrink-0">
                  <div className="flex items-center gap-2">
                     <AppLogo size={24} />
                     <span className="text-[14px] font-bold text-slate-900 tracking-tight">Gestifique</span>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 custom-scrollbar">
                  {previewSections.map((section) => (
                    <div key={section.title} className="space-y-1">
                       <h3 className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {section.title}
                       </h3>
                       <div className="space-y-0.5">
                          {section.items.map((item) => {
                             const active = activeModule === item.id;
                             return (
                                <button
                                  key={item.id}
                                  onClick={() => setActiveModule(item.id as PreviewModule)}
                                  className={`w-full flex items-center gap-2.5 px-3 h-8 rounded-md text-[13px] font-semibold transition-all duration-200 ${
                                     active ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                  }`}
                                >
                                   <item.icon
                                     size={16}
                                     className={`transition-colors shrink-0 ${active ? "text-slate-800" : "text-slate-400 group-hover:text-slate-600"}`}
                                     strokeWidth={active ? 2.5 : 2}
                                   />
                                   <span className="truncate">{item.label}</span>
                                </button>
                             );
                          })}
                       </div>
                    </div>
                  ))}
               </div>

               <div className="p-3 border-t border-slate-100 bg-white shrink-0 space-y-2">
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-slate-50/50 border border-transparent hover:border-slate-100 transition-colors">
                     <div className="w-7 h-7 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs shrink-0 shadow-sm">
                        L
                     </div>
                     <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-slate-900 truncate tracking-tight">Lucas Diretor</div>
                        <div className="text-[11px] font-medium text-slate-500 truncate">Administrador</div>
                     </div>
                  </div>
                  <button
                     title="Elemento ilustrativo da demonstração"
                     className="w-full h-8 flex items-center gap-2.5 px-2.5 rounded-md text-[13px] font-medium text-slate-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-default"
                  >
                     <LogOut size={16} /> Sair
                  </button>
               </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-col bg-[#FDFDFF] min-w-0">
              {/* Fake Topbar */}
              <header className="h-12 bg-white border-b border-slate-100 flex items-center justify-between px-5 sticky top-0 z-30 shrink-0">
                 <div className="flex items-center gap-4">
                    <button className="lg:hidden p-1.5 text-slate-500 hover:bg-slate-50 rounded-md transition-colors">
                       <Menu size={16} />
                    </button>
                    <h1 className="text-[14px] font-semibold text-slate-800 tracking-tight hidden sm:block">
                       {moduleMeta[activeModule].title}
                    </h1>
                 </div>
                 <div className="flex-1 max-w-xs ml-auto mr-0 hidden md:block">
                    <div className="relative group">
                       <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={14} />
                       <input 
                          type="text" 
                          placeholder="Pesquisar..." 
                          className="w-full h-8 bg-slate-50/50 border border-slate-200 rounded-md pl-8 pr-3 text-[13px] text-slate-700 placeholder:text-slate-400 cursor-default outline-none" 
                          readOnly 
                       />
                    </div>
                 </div>
              </header>

              {/* Mobile Navigation (Horizontal Scroll) */}
              <div className="lg:hidden bg-white border-b border-slate-100 overflow-x-auto shrink-0 hide-scrollbar">
                 <div className="flex px-4 py-2 gap-2 min-w-max">
                   {previewSections.flatMap(s => s.items).map(item => (
                     <button
                       key={item.id}
                       onClick={() => setActiveModule(item.id as PreviewModule)}
                       className={`px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors flex items-center gap-2 ${
                         activeModule === item.id ? 'bg-slate-100 font-bold text-slate-900 border border-slate-200/50 shadow-sm' : 'text-slate-500 font-medium hover:text-slate-800 hover:bg-slate-50'
                       }`}
                     >
                       <item.icon size={14} className={activeModule === item.id ? 'text-slate-800' : 'text-slate-400'} />
                       {item.label}
                     </button>
                   ))}
                 </div>
              </div>

              <div className="flex items-center justify-between px-5 py-4 lg:hidden border-b border-slate-100 bg-white">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{moduleMeta[activeModule].title}</h2>
                    <p className="text-xs font-medium text-slate-500">{moduleMeta[activeModule].subtitle}</p>
                  </div>
              </div>

              <div className="flex-1 overflow-auto p-4 sm:p-5">
                {renderPreviewContent()}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Explaining the parts Section */}
      <section className="py-16 px-6 bg-white border-b border-slate-100">
         <div className="max-w-5xl mx-auto space-y-12">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">O que você está vendo?</h2>
              <p className="text-base text-slate-600">A interface foi desenhada para dar foco total no andamento da operação e na resolução de demandas, cortando ruídos.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
               <div className="space-y-3 p-5 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                     <AlertCircle size={20} />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">SLA e Prioridades Visuais</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">Em vermelho, amarelo e verde. Bater o olho na fila é suficiente para saber exatamente o que precisa ser feito agora.</p>
               </div>
               <div className="space-y-3 p-5 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                     <LayoutDashboard size={20} />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Dashboard Direto ao Ponto</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">Cards de indicadores que mostram volume de chamados, repasses e gargalos de tempo de forma clara.</p>
               </div>
               <div className="space-y-3 p-5 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4">
                     <Building2 size={20} />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Gestão B2B Centrada</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">Controle por base de cliente ou contrato, não apenas e-mails isolados soltos em uma caixa de entrada caótica.</p>
               </div>
            </div>
         </div>
      </section>
    </div>
  );
};

// --- Preview Components ---

const TicketsPreview = () => (
  <div className="flex h-full w-full bg-white rounded-lg border border-slate-200">
    <div className="p-5 flex-1 overflow-auto">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div className="text-[13px] font-semibold text-slate-500 mb-1">Abertos</div>
          <div className="text-2xl font-bold text-slate-900">24</div>
        </div>
        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
          <div className="text-[13px] font-semibold text-red-600 mb-1 flex items-center gap-1"><AlertCircle size={14}/> SLA Crítico</div>
          <div className="text-2xl font-bold text-red-700">3</div>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div className="text-[13px] font-semibold text-slate-500 mb-1">Em Andamento</div>
          <div className="text-2xl font-bold text-slate-900">12</div>
        </div>
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
          <div className="text-[13px] font-semibold text-emerald-600 mb-1 flex items-center gap-1"><CheckCircle2 size={14}/> Resolvidos Hoje</div>
          <div className="text-2xl font-bold text-emerald-700 flex items-center gap-2">9</div>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
          <div className="flex-1 flex gap-2">
             <div className="h-8 px-3 bg-white text-slate-500 font-medium text-[13px] rounded items-center border border-slate-200 flex sm:hidden">
               Buscar...
             </div>
             <div className="h-8 px-3 bg-white text-slate-500 font-medium text-[13px] rounded hidden sm:flex items-center border border-slate-200 cursor-default" title="Elemento ilustrativo">
               <Search size={14} className="mr-2 text-slate-400" /> Consultar chamados...
             </div>
          </div>
          <button className="h-8 px-3 bg-white text-slate-600 font-medium text-[13px] border border-slate-200 hover:bg-slate-50 rounded flex items-center gap-2 cursor-default" title="Elemento ilustrativo">
            Status: Todos <ChevronRight size={14} className="text-slate-400 rotate-90" />
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] whitespace-nowrap">
            <thead>
              <tr className="bg-white text-slate-500 font-semibold border-b border-slate-200">
                <th className="px-4 py-3 font-medium">Chamado</th>
                <th className="px-4 py-3 font-medium">Assunto</th>
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium text-center">Prioridade</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Responsável</th>
                <th className="px-4 py-3 font-medium">SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              <tr className="hover:bg-slate-50 transition-colors cursor-pointer">
                <td className="px-4 py-3 font-mono font-medium text-slate-600">#4092</td>
                <td className="px-4 py-3 font-medium text-slate-900 border-l-2 border-orange-400">Dúvida no extrato de comissões</td>
                <td className="px-4 py-3 text-slate-600">TechCorp S/A</td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-orange-100 text-orange-700">Média</span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Em andamento
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">Lucas</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-slate-600">
                     <Clock size={12} className="text-slate-400" />
                     <span className="font-mono text-[12px]">2h</span>
                  </div>
                </td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors cursor-pointer bg-red-50/20">
                <td className="px-4 py-3 font-mono font-medium text-slate-600">#4091</td>
                <td className="px-4 py-3 font-medium text-slate-900 border-l-2 border-red-500">Sistema fora do ar</td>
                <td className="px-4 py-3 text-slate-600">Logística Brasil</td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-700">Urgente</span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Novo
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400">—</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-red-600">
                     <AlertCircle size={12} />
                     <span className="font-mono text-[12px] font-bold">Atrasado</span>
                  </div>
                </td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors cursor-pointer">
                <td className="px-4 py-3 font-mono font-medium text-slate-500">#4089</td>
                <td className="px-4 py-3 font-medium text-slate-600 border-l-2 border-slate-300">Acesso negado no portal</td>
                <td className="px-4 py-3 text-slate-500">Agência XYZ</td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-600">Baixa</span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    <Check size={12} /> Resolvido
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">Ana</td>
                <td className="px-4 py-3">
                  <span className="font-mono text-[12px] text-slate-400">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
);

const DashboardPreview = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
        <span className="text-[13px] font-semibold text-slate-500 mb-1">Novos Hoje</span>
        <span className="text-3xl font-bold text-slate-900">18</span>
      </div>
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
        <span className="text-[13px] font-semibold text-slate-500 mb-1">Atrasados</span>
        <span className="text-3xl font-bold text-red-600">2</span>
      </div>
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
        <span className="text-[13px] font-semibold text-slate-500 mb-1">Aguardando Terceiros</span>
        <span className="text-3xl font-bold text-amber-600">5</span>
      </div>
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
        <span className="text-[13px] font-semibold text-slate-500 mb-1">CSAT Atual</span>
        <span className="text-3xl font-bold text-emerald-600">98%</span>
      </div>
    </div>
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
       <h3 className="text-sm font-bold text-slate-900 mb-4">Volume dos últimos 7 dias</h3>
       <div className="h-48 flex items-end gap-2 sm:gap-6 pt-4 border-b border-slate-100">
         {[40, 60, 30, 80, 50, 90, 70].map((h, i) => (
           <div key={i} className="flex-1 flex flex-col justify-end group">
             <div className="w-full bg-blue-100 rounded-t-sm group-hover:bg-blue-200 transition-colors relative" style={{ height: `${h}%` }}>
               <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 rounded-t-sm"></div>
             </div>
             <div className="text-[10px] text-center text-slate-400 mt-2 font-medium">Dia {i+1}</div>
           </div>
         ))}
       </div>
    </div>
  </div>
);

const CompaniesPreview = () => (
   <div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
         {[{name: 'TechCorp S/A', users: 5, sla: '98%', status: 'Ativo'},
           {name: 'Logística Brasil', users: 12, sla: '82%', status: 'Bloqueado'},
           {name: 'Agência XYZ', users: 2, sla: '100%', status: 'Ativo'}
         ].map((c, i) => (
           <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-4">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xl">{c.name.charAt(0)}</div>
                    <div>
                       <h3 className="font-bold text-slate-900 text-[14px]">{c.name}</h3>
                       <span className="text-xs text-slate-500">Contrato B2B</span>
                    </div>
                 </div>
                 <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${c.status === 'Ativo' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                   {c.status}
                 </span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-auto text-[13px]">
                 <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                    <span className="block text-[11px] text-slate-500 font-semibold mb-0.5">Usuários Vinculados</span>
                    <span className="font-bold text-slate-900">{c.users}</span>
                 </div>
                 <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                    <span className="block text-[11px] text-slate-500 font-semibold mb-0.5">SLA Cumprido</span>
                    <span className={`font-bold ${c.sla === '100%' || c.sla === '98%' ? 'text-emerald-600' : 'text-orange-600'}`}>{c.sla}</span>
                 </div>
              </div>
           </div>
         ))}
      </div>
   </div>
);

const KnowledgePreview = () => (
   <div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center max-w-2xl mx-auto mb-8">
         <h3 className="text-lg font-bold text-slate-900 mb-2">Base de Conhecimento</h3>
         <p className="text-[13px] text-slate-500 mb-4">Gerencie os tutoriais, manuais e dicas que seus clientes ou equipe podem acessar.</p>
         <div className="relative max-w-md mx-auto">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input type="text" placeholder="Buscar artigo..." className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-md text-[13px] focus:outline-none cursor-default" readOnly />
         </div>
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
         <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h4 className="font-bold text-slate-900 flex items-center gap-2 mb-3 text-[14px]">
               <FileText size={16} className="text-blue-500" /> Manuais de Acesso
            </h4>
            <ul className="space-y-2 text-[13px]">
               <li className="text-blue-600 hover:underline cursor-pointer">Como abrir um chamado pelo portal</li>
               <li className="text-blue-600 hover:underline cursor-pointer">Recuperar senha de cliente</li>
            </ul>
         </div>
         <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h4 className="font-bold text-slate-900 flex items-center gap-2 mb-3 text-[14px]">
               <FileText size={16} className="text-blue-500" /> Financeiro / Comercial
            </h4>
            <ul className="space-y-2 text-[13px]">
               <li className="text-blue-600 hover:underline cursor-pointer">Emitindo a 2ª via de boleto</li>
               <li className="text-blue-600 hover:underline cursor-pointer">Dúvidas sobre faturamento</li>
            </ul>
         </div>
         <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h4 className="font-bold text-slate-900 flex items-center gap-2 mb-3 text-[14px]">
               <FileText size={16} className="text-blue-500" /> Equipe de Suporte
            </h4>
            <ul className="space-y-2 text-[13px]">
               <li className="text-slate-600 flex items-center gap-2"><LockIcon /> Script de suporte padrão</li>
               <li className="text-slate-600 flex items-center gap-2"><LockIcon /> Política de descontos</li>
            </ul>
         </div>
      </div>
   </div>
);
const LockIcon = () => <Shield size={12} className="text-amber-500" />;

const ReportsPreview = () => (
   <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
         <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-center">
            <span className="text-[13px] font-semibold text-slate-500 block">Chamados no Período</span>
            <span className="text-2xl font-bold text-slate-900 block mt-1">142</span>
         </div>
         <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-center">
            <span className="text-[13px] font-semibold text-slate-500 block">Tempo Médio Resposta</span>
            <span className="text-2xl font-bold text-slate-900 block mt-1">22m</span>
         </div>
         <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-center">
            <span className="text-[13px] font-semibold text-slate-500 block">Taxa de Resolução</span>
            <span className="text-2xl font-bold text-emerald-600 block mt-1">94%</span>
         </div>
         <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-center">
            <span className="text-[13px] font-semibold text-slate-500 block">TMA Geral</span>
            <span className="text-2xl font-bold text-blue-600 block mt-1">3h 15m</span>
         </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
         <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="text-[14px] font-bold text-slate-900">Desempenho por Atendente</h3>
         </div>
         <div className="overflow-x-auto">
           <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead>
                 <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-white">
                    <th className="px-5 py-3">Atendente</th>
                    <th className="px-5 py-3 text-center">Resolvidos</th>
                    <th className="px-5 py-3 text-center">CSAT</th>
                    <th className="px-5 py-3">TMA médio</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                 <tr>
                    <td className="px-5 py-3 font-medium text-slate-900 flex items-center gap-2"><div className="w-6 h-6 rounded bg-slate-100 text-[11px] flex items-center justify-center font-bold text-slate-600 border border-slate-200">M</div> Marina</td>
                    <td className="px-5 py-3 text-center text-slate-600 font-medium">45</td>
                    <td className="px-5 py-3 text-center text-emerald-600 font-bold">4.9/5</td>
                    <td className="px-5 py-3 text-slate-600 font-mono text-[12px]">3h 40m</td>
                 </tr>
                 <tr>
                    <td className="px-5 py-3 font-medium text-slate-900 flex items-center gap-2"><div className="w-6 h-6 rounded bg-slate-100 text-[11px] flex items-center justify-center font-bold text-slate-600 border border-slate-200">L</div> Lucas</td>
                    <td className="px-5 py-3 text-center text-slate-600 font-medium">38</td>
                    <td className="px-5 py-3 text-center text-emerald-600 font-bold">4.7/5</td>
                    <td className="px-5 py-3 text-slate-600 font-mono text-[12px]">4h 10m</td>
                 </tr>
                 <tr>
                    <td className="px-5 py-3 font-medium text-slate-900 flex items-center gap-2"><div className="w-6 h-6 rounded bg-slate-100 text-[11px] flex items-center justify-center font-bold text-slate-600 border border-slate-200">A</div> Ana</td>
                    <td className="px-5 py-3 text-center text-slate-600 font-medium">32</td>
                    <td className="px-5 py-3 text-center text-emerald-600 font-bold">4.8/5</td>
                    <td className="px-5 py-3 text-slate-600 font-mono text-[12px]">4h 50m</td>
                 </tr>
              </tbody>
           </table>
         </div>
      </div>
   </div>
);

const UsersPreview = () => (
   <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
         <h3 className="text-[14px] font-bold text-slate-900">Contas de Acesso</h3>
         <button className="h-8 px-3 bg-blue-600 text-white rounded text-[13px] font-bold shadow-sm" title="Ilustrativo" cursor-default>Novo Usuário</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px] whitespace-nowrap">
          <thead>
            <tr className="bg-white text-slate-500 font-semibold border-b border-slate-200">
              <th className="px-5 py-3">Nome</th>
              <th className="px-5 py-3">E-mail</th>
              <th className="px-5 py-3">Perfil</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
             <tr>
               <td className="px-5 py-3 font-semibold text-slate-900">Lucas Diretor</td>
               <td className="px-5 py-3 text-slate-600">lucas@empresa.com.br</td>
               <td className="px-5 py-3"><span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-bold text-[11px]">Administrador</span></td>
               <td className="px-5 py-3"><span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[11px]">Ativo</span></td>
             </tr>
             <tr>
               <td className="px-5 py-3 font-semibold text-slate-900">Marina Lopes</td>
               <td className="px-5 py-3 text-slate-600">marina@empresa.com.br</td>
               <td className="px-5 py-3"><span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[11px]">Atendente</span></td>
               <td className="px-5 py-3"><span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[11px]">Ativo</span></td>
             </tr>
             <tr>
               <td className="px-5 py-3 font-semibold text-slate-900">João Silva</td>
               <td className="px-5 py-3 text-slate-600">joao@techcorp.com</td>
               <td className="px-5 py-3"><span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold text-[11px]">Cliente</span></td>
               <td className="px-5 py-3"><span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[11px]">Ativo</span></td>
             </tr>
          </tbody>
        </table>
      </div>
   </div>
);

const SettingsPreview = () => (
   <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-white border border-slate-200 rounded-xl pt-5 pb-2 px-5 shadow-sm">
         <h3 className="text-[14px] font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2"><SlidersHorizontal size={16} className="text-slate-400" /> Geral da Operação</h3>
         <div className="space-y-5">
            <div className="flex items-center justify-between">
               <div>
                  <span className="block text-[13px] font-semibold text-slate-900">Pausar SLA Finais de Semana</span>
                  <span className="block text-xs text-slate-500 mt-0.5">O tempo não corre sábados e domingos</span>
               </div>
               <div className="w-9 h-5 bg-blue-600 rounded-full relative cursor-default"><div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow"></div></div>
            </div>
            <div className="flex items-center justify-between">
               <div>
                  <span className="block text-[13px] font-semibold text-slate-900">Avisos por Email Automáticos</span>
                  <span className="block text-xs text-slate-500 mt-0.5">Notificar quando o chamado atualiza</span>
               </div>
               <div className="w-9 h-5 bg-blue-600 rounded-full relative cursor-default"><div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow"></div></div>
            </div>
         </div>
      </div>
      
      <div className="bg-white border border-slate-200 rounded-xl pt-5 pb-2 px-5 shadow-sm">
         <h3 className="text-[14px] font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2"><Ticket size={16} className="text-slate-400" /> Categorias de chamados</h3>
         <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-slate-100">
               <span className="block text-[13px] font-semibold text-slate-900">Suporte Técnico</span>
               <span className="text-[11px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">SLA 4h</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-slate-100">
               <span className="block text-[13px] font-semibold text-slate-900">Financeiro</span>
               <span className="text-[11px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">SLA 12h</span>
            </div>
         </div>
      </div>
   </div>
);

const LogsPreview = () => (
   <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50">
         <h3 className="text-[14px] font-bold text-slate-900">Auditoria (Últimas 24h)</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px] whitespace-nowrap">
           <thead>
              <tr className="bg-white text-slate-500 font-semibold border-b border-slate-200">
                 <th className="px-5 py-3">Data / Hora</th>
                 <th className="px-5 py-3">Ação</th>
                 <th className="px-5 py-3">Usuário</th>
                 <th className="px-5 py-3">Detalhes</th>
              </tr>
           </thead>
           <tbody className="divide-y divide-slate-100 bg-white">
              <tr>
                 <td className="px-5 py-3 text-slate-500 font-mono text-[12px]">Hoje, 14:12</td>
                 <td className="px-5 py-3 font-medium text-slate-900"><span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[11px]">CRIAR</span></td>
                 <td className="px-5 py-3 text-slate-600">Marina Lopes</td>
                 <td className="px-5 py-3 text-slate-500">Chamado #4093 aberto referente a "Acesso bloqueado"</td>
              </tr>
              <tr>
                 <td className="px-5 py-3 text-slate-500 font-mono text-[12px]">Hoje, 10:45</td>
                 <td className="px-5 py-3 font-medium text-slate-900"><span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold text-[11px]">ATUALIZAR</span></td>
                 <td className="px-5 py-3 text-slate-600">João Silva</td>
                 <td className="px-5 py-3 text-slate-500">Adicionou comentário no chamado #4092</td>
              </tr>
           </tbody>
        </table>
      </div>
   </div>
);

const ProfilePreview = () => (
   <div className="max-w-2xl bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="p-6 border-b border-slate-200 flex items-center gap-5">
         <div className="w-20 h-20 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
            <User size={32} className="text-slate-400" />
         </div>
         <div>
            <h2 className="text-xl font-bold text-slate-900">Lucas Diretor</h2>
            <p className="text-sm text-slate-500 mb-2">lucas@empresa.com.br</p>
            <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">Administrador</span>
         </div>
      </div>
      <div className="p-6">
         <h3 className="text-[13px] font-bold text-slate-900 mb-4 uppercase tracking-wider text-slate-500">Informações</h3>
         <div className="space-y-4 max-w-sm">
            <div>
               <label className="block text-[13px] font-semibold text-slate-700 mb-1">Nome Completo</label>
               <input type="text" className="w-full h-9 px-3 rounded-md border border-slate-200 bg-slate-50 text-[13px] cursor-not-allowed" value="Lucas Diretor" disabled />
            </div>
            <div>
               <label className="block text-[13px] font-semibold text-slate-700 mb-1">Cargo</label>
               <input type="text" className="w-full h-9 px-3 rounded-md border border-slate-200 bg-slate-50 text-[13px] cursor-not-allowed" value="Diretor de Operações" disabled />
            </div>
         </div>
      </div>
   </div>
);
