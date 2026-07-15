import React, { useState, useEffect } from 'react';
import { PortalTab } from './PortalLayout';
import { Card } from '../ui/Card';
import { Ticket, PlusCircle, Search, Clock, CheckCircle2, ArrowRight, FileText } from 'lucide-react';
import { api } from '../../lib/api';

interface PortalHomePageProps {
  onNavigate: (tab: PortalTab, ticketId?: number) => void;
}

export const PortalHomePage = ({ onNavigate }: PortalHomePageProps) => {
  const [stats, setStats] = useState({ open: 0, pending: 0, closed: 0 });
  const [recentTickets, setRecentTickets] = useState<any[]>([]);
  const [popularArticles, setPopularArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        const [ticketsData, knowledgeData] = await Promise.all([
          api.get<any[]>('/portal/tickets?limit=5'),
          api.get<any[]>('/portal/knowledge')
        ]);
        
        setRecentTickets(ticketsData);
        setPopularArticles(knowledgeData.slice(0, 4));
        
        const open = ticketsData.filter(t => t.status === 'aberto' || t.status === 'em_andamento').length;
        const pending = ticketsData.filter(t => t.status === 'aguardando_cliente').length;
        const closed = ticketsData.filter(t => t.status === 'resolvido' || t.status === 'fechado').length;
        
        setStats({ open, pending, closed });
        setLoading(false);
      } catch (err) {
        setLoading(false);
      }
    };
    
    fetchHomeData();
  }, []);

  return (
    <div className="space-y-4">
      {/* Hero Section */}
      <div className="relative flex flex-col items-center justify-between gap-6 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:flex-row md:p-5 md:text-left">
        <div className="relative z-10 w-full">
          <h1 className="mb-1.5 text-lg font-semibold tracking-tight text-slate-950 md:text-xl">
            Como podemos te ajudar hoje?
          </h1>
          <p className="text-slate-500 text-sm mb-4">
            Busque em nossa base de conhecimento ou abra um novo chamado.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button 
              onClick={() => onNavigate('new-ticket')}
              className="flex h-9 items-center justify-center gap-2 rounded-md border border-blue-600 bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-600/15 transition-colors hover:bg-blue-700"
            >
              <PlusCircle size={16} /> Novo chamado
            </button>
            <button 
              onClick={() => onNavigate('knowledge')}
              className="flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950"
            >
              <Search size={16} /> Base de Conhecimento
            </button>
          </div>
        </div>
      </div>

      {/* Knowledge Base Teaser */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Consulta Rápida</h2>
          <button 
            onClick={() => onNavigate('knowledge')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            Ver base <ArrowRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
            ))
          ) : popularArticles.length > 0 ? (
            popularArticles.map(article => (
              <button
                key={article.id}
                onClick={() => onNavigate('knowledge')} 
                className="group flex h-full flex-col rounded-lg border border-slate-200 bg-white p-3 text-left transition-all hover:border-slate-300 hover:shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
              >
                <div className="w-8 h-8 rounded-md bg-slate-50 text-slate-500 flex items-center justify-center mb-2 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                  <FileText size={16} />
                </div>
                <h3 className="font-semibold text-sm text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-tight mb-1">{article.titulo}</h3>
                <p className="text-xs text-slate-500 mt-auto truncate">{article.categoria || 'Geral'}</p>
              </button>
            ))
          ) : (
            <div className="col-span-full py-8 text-center bg-slate-50/50 border border-dashed border-slate-200 rounded-xl text-slate-500 text-sm">
              Nenhum artigo disponível no momento.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="flex items-center gap-3 border-slate-200 p-3">
          <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <Clock size={16} />
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight text-slate-900 leading-none mb-0.5">{stats.open}</div>
            <div className="text-xs text-slate-500 font-medium">Em Andamento</div>
          </div>
        </Card>
        
        <Card className="p-3 flex items-center gap-3 border-slate-200">
          <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
            <Ticket size={16} />
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight text-slate-900 leading-none mb-0.5">{stats.pending}</div>
            <div className="text-xs text-slate-500 font-medium">Aguardando Você</div>
          </div>
        </Card>
        
        <Card className="p-3 flex items-center gap-3 border-slate-200">
          <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center shrink-0">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight text-slate-900 leading-none mb-0.5">{stats.closed}</div>
            <div className="text-xs text-slate-500 font-medium">Finalizados</div>
          </div>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Seus chamados recentes</h2>
          <button 
            onClick={() => onNavigate('tickets')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            Ver histórico <ArrowRight size={14} />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-2.5">
             {Array(3).fill(0).map((_, i) => (
                <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
             ))}
          </div>
        ) : recentTickets.length > 0 ? (
          <div className="grid grid-cols-1 gap-2.5">
            {recentTickets.map(ticket => (
              <button
                key={ticket.id}
                onClick={() => onNavigate('tickets', ticket.id)}
                className="group flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50/60"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-slate-50 flex items-center justify-center text-slate-500 font-semibold text-xs group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                    #{ticket.id}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-slate-900 truncate mb-0.5">{ticket.titulo}</h3>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                       <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-medium">{ticket.categoria || 'Geral'}</span>
                       <span>•</span>
                       <span>Atualizado em {new Date(ticket.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="text-slate-300 group-hover:text-blue-500 transition-colors">
                  <ArrowRight size={18} />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-slate-50/50 border border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-500 text-sm">
            Você ainda não possui nenhum chamado aberto.
          </div>
        )}
      </div>
    </div>
  );
};
