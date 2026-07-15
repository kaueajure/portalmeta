import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Badge } from '../ui/Badge';
import { Search, Loader2, Ticket } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PortalTicketsPageProps {
  onSelectTicket: (id: number) => void;
}

export const PortalTicketsPage = ({ onSelectTicket }: PortalTicketsPageProps) => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const data = await api.get<any[]>('/portal/tickets');
        setTickets(data);
        setLoading(false);
      } catch (err) {
        setLoading(false);
      }
    };
    fetchTickets();
  }, []);

  const getStatusBadge = (status: string) => {
    const badges: Record<string, React.ReactNode> = {
      aberto: <Badge variant="blue">Aberto</Badge>,
      em_andamento: <Badge variant="amber">Em Andamento</Badge>,
      aguardando_cliente: <Badge variant="indigo">Aguardando Você</Badge>,
      resolvido: <Badge variant="emerald">Resolvido</Badge>,
      fechado: <Badge variant="slate">Fechado</Badge>
    };
    return badges[status] || <Badge variant="slate">{status}</Badge>;
  };

  const filteredTickets = tickets.filter(t => 
    t.titulo.toLowerCase().includes(search.toLowerCase()) || 
    String(t.id).includes(search)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-slate-950">Meus chamados</h1>
        
        <div className="w-full sm:w-72 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text"
            placeholder="Buscar chamado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-slate-300" size={24} />
        </div>
      ) : filteredTickets.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:text-left">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">ID</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Assunto</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Atualização</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTickets.map(ticket => (
                  <tr 
                    key={ticket.id} 
                    onClick={() => onSelectTicket(ticket.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors group"
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-xs font-semibold text-slate-500 group-hover:text-slate-900">#{ticket.id}</td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-sm text-slate-900 truncate max-w-[200px] sm:max-w-xs">{ticket.titulo}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{ticket.categoria || 'Sem categoria'}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {getStatusBadge(ticket.status)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-500">
                      {format(new Date(ticket.updated_at), "dd MMM, HH:mm", { locale: ptBR })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-slate-500 shadow-sm flex flex-col items-center justify-center">
          <Ticket size={32} className="text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-600">Nenhum chamado encontrado.</p>
        </div>
      )}
    </div>
  );
};
