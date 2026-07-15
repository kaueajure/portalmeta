import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Target, Users, LayoutDashboard, Ticket, CheckCircle2, AlertCircle } from 'lucide-react';
import { AppLogo } from '../ui/Logo';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 via-white to-blue-50/40 flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-[1100px] flex gap-8 lg:gap-12 items-center">
        
        {/* Esquerda: Branding Institucional (Oculto no mobile e tablet) */}
        <div className="hidden lg:flex w-[55%] flex-col relative z-10">
          <div className="bg-white/80 backdrop-blur-md border border-slate-200/80 p-10 rounded-xl shadow-sm text-slate-800 flex flex-col justify-between min-h-[560px] relative overflow-hidden">
             
            {/* Efeitos de luz no BG */}
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-100/50 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-emerald-50/50 rounded-full blur-3xl opacity-50 translate-y-1/2 -translate-x-1/2 pointer-events-none" />

            <div className="relative z-10 space-y-8 flex-1">
              <div className="flex items-center gap-2.5">
                <AppLogo size={28} />
                <span className="text-xl font-bold tracking-tight text-slate-900">Gestifique</span>
              </div>
              
              <div className="space-y-4 max-w-md">
                <h1 className="text-3xl font-extrabold tracking-tight leading-[1.15] text-slate-900">
                  Acesse sua central de atendimento
                </h1>
                <p className="text-base font-medium text-slate-600 leading-relaxed">
                  Controle chamados, SLAs, clientes e relatórios em um ambiente seguro e integrado.
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                    <Target className="text-blue-600" size={14} />
                  </div>
                   <span className="text-sm font-semibold text-slate-700">Central de chamados B2B</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                    <ShieldCheck className="text-emerald-600" size={14} />
                  </div>
                   <span className="text-sm font-semibold text-slate-700">Controle de SLA e prioridades</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
                    <Users className="text-purple-600" size={14} />
                  </div>
                   <span className="text-sm font-semibold text-slate-700">Portal de autoatendimento do cliente</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                    <LayoutDashboard className="text-orange-600" size={14} />
                  </div>
                   <span className="text-sm font-semibold text-slate-700">Indicadores gerenciais de atendimento</span>
                </div>
              </div>
            </div>

            {/* Mini preview do sistema */}
            <div className="relative z-10 mt-10 rounded-xl border border-slate-200 bg-[#FDFDFF] shadow-sm overflow-hidden flex">
               {/* Sidebar mini */}
               <div className="w-16 bg-white border-r border-slate-100 flex flex-col items-center py-4 gap-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><AppLogo size={16} /></div>
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><LayoutDashboard size={14} className="text-slate-500" /></div>
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center"><Ticket size={14} className="text-white" /></div>
               </div>
               {/* Main mini */}
               <div className="flex-1 p-4 space-y-3">
                  <div className="h-4 bg-slate-100 rounded w-1/3 mb-4"></div>
                  <div className="flex gap-3">
                     <div className="flex-1 bg-white border border-slate-100 rounded-lg p-2.5">
                        <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase mb-1">Abertos</div>
                        <div className="text-lg font-bold text-slate-800">24</div>
                     </div>
                     <div className="flex-1 bg-red-50 border border-red-100 rounded-lg p-2.5">
                        <div className="flex items-center gap-1 text-[9px] font-bold text-red-600 uppercase mb-1"><AlertCircle size={10} /> SLA</div>
                        <div className="text-lg font-bold text-red-700">3</div>
                     </div>
                  </div>
                  <div className="space-y-2 mt-4">
                     <div className="h-8 bg-white border border-slate-100 rounded-md flex items-center px-2 gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div><div className="h-2 w-3/4 bg-slate-100 rounded"></div>
                     </div>
                     <div className="h-8 bg-white border border-slate-100 rounded-md flex items-center px-2 gap-2">
                        <CheckCircle2 size={10} className="text-emerald-500" /><div className="h-2 w-1/2 bg-slate-100 rounded"></div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="relative z-10 flex items-center gap-2 mt-8 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
               <ShieldCheck size={14} className="text-emerald-500" /> Ambiente protegido • Acesso restrito
            </div>
          </div>
        </div>

        {/* Direita: Formulário de Autenticação */}
        <div className="w-full lg:w-[45%] flex items-center justify-center relative z-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full max-w-[400px]"
          >
            {children}
          </motion.div>
        </div>

      </div>
    </div>
  );
};
