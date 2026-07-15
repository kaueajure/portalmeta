import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { TicketMacro, Ticket, User } from '../../../types';
import { Search, Loader2, MessageSquare, X } from 'lucide-react';

interface TicketMacroListProps {
  ticket: Ticket;
  currentUser: User;
  onSelect: (content: string) => void;
  onClose: () => void;
}

export const TicketMacroList = ({ ticket, currentUser, onSelect, onClose }: TicketMacroListProps) => {
  const [macros, setMacros] = useState<TicketMacro[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchMacros = async () => {
      setLoading(true);
      try {
        const data = await api.get<TicketMacro[]>('/macros');
        setMacros(data.filter(m => m.ativo !== false));
      } catch (err) {
        console.error('Erro ao carregar macros:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMacros();
  }, []);

  const handleSelect = async (macro: TicketMacro) => {
    try {
      if (macro.id) {
        const response = await api.post<{ conteudo: string }>(`/macros/${macro.id}/apply`, { ticket_id: ticket.id });
        onSelect(response.conteudo);
      } else {
         onSelect(macro.conteudo);
      }
    } catch (e) {
      console.warn('Erro ao aplicar macro:', e);
      // fallback
      onSelect(macro.conteudo);
    }
  };

  const filteredMacros = macros.filter(m => 
    m.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.conteudo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.categoria?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group by category
  const groupedMacros = filteredMacros.reduce((acc: Record<string, TicketMacro[]>, macro) => {
    const cat = macro.categoria || 'Geral';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(macro);
    return acc;
  }, {});

  const canManage = currentUser.administrador || currentUser.desenvolvedor;

  return (
    <div className="flex h-[400px] w-[min(340px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-2">
          <MessageSquare size={14} className="text-blue-500" /> Respostas Prontas
        </h3>
        <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-md text-slate-400 transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="p-3 border-b border-slate-100">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            autoFocus
            type="text" 
            placeholder="Buscar por título, categoria ou conteúdo..." 
            className="w-full h-8 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-md outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-900"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar bg-white">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-2">
            <Loader2 size={24} className="text-blue-500 animate-spin" />
            <span className="text-xs font-medium text-slate-500">Carregando...</span>
          </div>
        ) : filteredMacros.length > 0 ? (
          <div className="space-y-4 py-1">
            {(Object.entries(groupedMacros) as [string, TicketMacro[]][]).map(([category, items]) => (
              <div key={category} className="space-y-1">
                <div className="px-2 pb-1">
                  <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                    {category}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {items.map((macro) => (
                    <button
                      key={macro.id}
                      onClick={() => handleSelect(macro)}
                      className="w-full text-left p-2.5 hover:bg-slate-50 rounded-lg transition-all group border border-transparent hover:border-slate-100"
                    >
                      <div className="font-semibold text-sm text-slate-900 mb-0.5 group-hover:text-blue-700 transition-colors">
                        {macro.titulo}
                      </div>
                      <div className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {macro.conteudo}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
              <MessageSquare size={24} className="text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Nada encontrado</p>
            <p className="text-xs text-slate-500 mt-1">Experimente outros termos</p>
          </div>
        )}
      </div>

      <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-500 font-medium">
          {macros.length} {macros.length === 1 ? 'Resposta' : 'Respostas'}
        </span>
        {canManage && (
          <button 
            type="button"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            Gerenciar
          </button>
        )}
      </div>
    </div>
  );
};
