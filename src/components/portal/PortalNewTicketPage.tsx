import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { PortalTab } from './PortalLayout';
import { User } from '../../types';
import { Send, Sparkles, BookOpen } from 'lucide-react';
import { useTicketOptions } from '../../hooks/useTicketOptions';

interface PortalNewTicketPageProps {
  onNavigate: (tab: PortalTab, ticketId?: number) => void;
  currentUser: User;
}

export const PortalNewTicketPage = ({ onNavigate, currentUser }: PortalNewTicketPageProps) => {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [servico, setServico] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [suggestions, setSuggestions] = useState<any[]>([]);
  
  const shouldLoadInternalOptions = currentUser.perfil !== 'cliente';
  const { activeCategories, activeServices } = useTicketOptions(
    shouldLoadInternalOptions ? currentUser.empresa_id || undefined : undefined
  );

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (titulo.length < 5 && descricao.length < 10) {
        setSuggestions([]);
        return;
      }
      try {
        const query = encodeURIComponent(`${titulo} ${descricao}`.trim());
        const result = await api.get<any[]>(`/portal/knowledge/search?q=${query}`);
        setSuggestions(result);
      } catch(e) {}
    };
    
    const timeout = setTimeout(fetchSuggestions, 500);
    return () => clearTimeout(timeout);
  }, [titulo, descricao]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo || !descricao) {
      setError('Por favor, preencha o título e a descrição.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.post<{message: string, ticketId: number}>('/portal/tickets', {
        titulo,
        descricao,
        categoria,
        servico
      });
      onNavigate('tickets', data.ticketId);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar chamado');
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <div>
          <h1 className="mb-1 text-lg font-semibold tracking-tight text-slate-950">Abrir novo chamado</h1>
          <p className="text-slate-500 text-sm">Preencha os detalhes abaixo para que possamos te ajudar da melhor forma.</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-md border border-red-100">
                {error}
              </div>
            )}
            
            <Input
              label="Assunto do Chamado"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Problema de acesso, Dúvida sobre funcionalidade..."
              required
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 px-1">Categoria (Opcional)</label>
                <Select
                  value={categoria}
                  onChange={setCategoria}
                  options={[
                    { value: '', label: 'Selecione...' },
                    ...activeCategories.map(c => ({ value: c.valor, label: c.nome }))
                  ]}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 px-1">Serviço (Opcional)</label>
                <Select
                  value={servico}
                  onChange={setServico}
                  options={[
                    { value: '', label: 'Selecione...' },
                    ...activeServices.map(s => ({ value: s.valor, label: s.nome }))
                  ]}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 px-1">Descrição Detalhada</label>
              <textarea
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                required
                rows={4}
                placeholder="Descreva o máximo de detalhes possível para agilizarmos seu atendimento..."
                className="w-full resize-y rounded-md border border-slate-200 bg-slate-50/80 p-3 text-sm outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" disabled={loading} className="w-full sm:w-auto h-9 px-6 text-sm">
                {loading ? 'Criando...' : <span className="flex items-center"><Send size={16} className="mr-2" /> Enviar Chamado</span>}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <div className="lg:col-span-1">
        {suggestions.length > 0 && (
          <div className="sticky top-24 rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="mb-2 flex items-center gap-2 font-semibold text-slate-950">
              <Sparkles size={16} className="text-slate-500" />
              Talvez isso ajude?
            </div>
            <p className="mb-3 text-xs font-medium text-slate-500">
              Encontramos alguns artigos que podem resolver sua dúvida antes mesmo de abrir o chamado:
            </p>
            <div className="space-y-2">
              {suggestions.map(article => (
                <button
                  key={article.id}
                  onClick={() => onNavigate('knowledge', article.id)}
                  className="group flex w-full items-start gap-2.5 rounded-lg border border-slate-200 bg-white p-3 text-left transition-all hover:border-slate-300 hover:bg-slate-50"
                >
                  <BookOpen size={14} className="text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-medium text-sm text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">{article.titulo}</h4>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
