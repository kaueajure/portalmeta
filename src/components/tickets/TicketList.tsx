import React from 'react';
import { Ticket, TicketStatus, TicketStatusSpecial, User } from '../../types';
import { 
  MessageSquare, 
  ChevronRight, 
  User as UserIcon, 
  Tag, 
  Search, 
  Clock, 
  ShieldAlert, 
  UserPlus, 
  Play, 
  Copy, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  History,
  Mail
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { cn, formatRelativeTime, getSlaInfo, getFirstResponseSlaInfo } from '../../lib/utils';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import { hasPermission } from '../../lib/permissions';

interface TicketListProps {
  tickets: Ticket[];
  onSelectTicket: (id: number) => void;
  currentUser: User;
  onStatusChange: () => void;
  searchTerm?: string;
  hasFilters?: boolean;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
  selectedTicketIds?: number[];
  onSelectionChange?: (ids: number[]) => void;
  canSelectBulk?: boolean;
  sortKey?: TicketSortKey;
  sortOrder?: TicketSortOrder;
  onSortChange?: (key: TicketSortKey, order: TicketSortOrder) => void;
  statusOptions?: { value: TicketStatus; label: string; special?: TicketStatusSpecial | string | null }[];
  onTicketContextMenu?: (event: React.MouseEvent, ticket: Ticket) => void;
}

export type TicketSortKey = 'operacional' | 'id' | 'updated_at' | 'prioridade' | 'status' | 'titulo';
export type TicketSortOrder = 'asc' | 'desc';

export const TicketList = ({ 
  tickets, onSelectTicket, currentUser, onStatusChange, searchTerm, hasFilters, meta, 
  onPageChange, selectedTicketIds = [], onSelectionChange, canSelectBulk,
  sortKey = 'operacional', sortOrder = 'desc', onSortChange, statusOptions = [], onTicketContextMenu
}: TicketListProps) => {

  const canAssumeTicket = hasPermission(currentUser, 'tickets.assumir');
  const canEditStatus = hasPermission(currentUser, 'tickets.editar_status');
  const statusSpecialMap = new Map(statusOptions.map((status) => [status.value, status.special || 'normal']));
  const inProgressStatus = statusOptions.find((status) => status.special === 'normal')?.value;

  const handleAssumirTicket = async (e: React.MouseEvent, ticketId: number) => {
    e.stopPropagation();
    try {
      await api.patch(`/tickets/${ticketId}`, { responsavel_id: currentUser.id });
      onStatusChange();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleMudarStatus = async (e: React.MouseEvent, ticketId: number, status: string) => {
    e.stopPropagation();
    try {
      await api.patch(`/tickets/${ticketId}/status`, { status });
      onStatusChange();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCopyId = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id.toString());
  };

  const handleSort = (key: TicketSortKey) => {
    const nextOrder = sortKey === key && sortOrder === 'asc' ? 'desc' : 'asc';
    onSortChange?.(key, nextOrder);
  };

  const getPriorityInfo = (prio: string) => {
    switch (prio) {
      case 'urgente': return { color: 'text-red-700', bg: 'bg-red-100', label: 'Urgente' };
      case 'alta': return { color: 'text-orange-700', bg: 'bg-orange-100', label: 'Alta' };
      case 'media': return { color: 'text-amber-700', bg: 'bg-amber-100', label: 'Média' };
      case 'baixa': return { color: 'text-blue-700', bg: 'bg-blue-100', label: 'Baixa' };
      default: return { color: 'text-slate-700', bg: 'bg-slate-100', label: prio.substring(0, 1).toUpperCase() + prio.substring(1).toLowerCase() };
    }
  };

  const getEstadoAtendimentoInfo = (estado?: string) => {
    switch (estado) {
      case 'cliente_respondeu':
        return { label: 'Cliente respondeu', color: 'text-blue-700', dot: 'bg-blue-500' };
      case 'aguardando_cliente':
        return { label: 'Aguardando cliente', color: 'text-amber-700', dot: 'bg-amber-500' };
      case 'atendente_respondeu':
        return { label: 'Atendente respondeu', color: 'text-slate-600', dot: 'bg-slate-500' };
      case 'sem_resposta':
        return { label: 'Sem resposta', color: 'text-rose-700', dot: 'bg-rose-500' };
      default:
        return null;
    }
  };

  const statusColors: Record<string, { color: string, bg: string }> = {
    aberto: { color: 'text-blue-700', bg: 'bg-blue-50' },
    em_andamento: { color: 'text-indigo-700', bg: 'bg-indigo-50' },
    aguardando_cliente: { color: 'text-amber-700', bg: 'bg-amber-50' },
    resolvido: { color: 'text-emerald-700', bg: 'bg-emerald-50' },
    fechado: { color: 'text-slate-600', bg: 'bg-slate-50' }
  };
  const getStatusColor = (status: string) =>
    statusColors[status] || { color: 'text-slate-700', bg: 'bg-slate-100' };

  const SortHeader = ({ label, k, className }: { label: string, k: TicketSortKey, className?: string }) => (
    <th 
      className={cn("cursor-pointer px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-800 group/th", className)}
      onClick={() => handleSort(k)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === k ? (
          sortOrder === 'asc' ? <ArrowUp size={12} className="text-blue-500" /> : <ArrowDown size={12} className="text-blue-500" />
        ) : (
          <ArrowUpDown size={12} className="text-slate-300 opacity-0 group-hover/th:opacity-100 transition-opacity" />
        )}
      </div>
    </th>
  );

  const currentPageIds = tickets.map(t => t.id);
  const selectedOnPage = currentPageIds.filter(id => selectedTicketIds.includes(id));
  const isAllSelected = tickets.length > 0 && selectedOnPage.length === tickets.length;

  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onSelectionChange) return;
    if (e.target.checked) {
      const newSelections = [...new Set([...selectedTicketIds, ...currentPageIds])];
      onSelectionChange(newSelections);
    } else {
      const newSelections = selectedTicketIds.filter(id => !currentPageIds.includes(id));
      onSelectionChange(newSelections);
    }
  };

  const toggleSelectTicket = (id: number) => {
    if (!onSelectionChange) return;
    if (selectedTicketIds.includes(id)) {
      onSelectionChange(selectedTicketIds.filter(tid => tid !== id));
    } else {
      onSelectionChange([...selectedTicketIds, id]);
    }
  };

  if (tickets.length === 0) {
    return (
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="px-4 py-8 text-center flex flex-col items-center">
          <div className="w-10 h-10 bg-slate-50 text-slate-300 rounded-lg flex items-center justify-center mb-3 border border-slate-100/50">
            <Search size={20} />
          </div>
          {hasFilters ? (
            <>
              <h4 className="text-sm font-semibold text-slate-800">Nenhum resultado</h4>
              <p className="text-xs text-slate-500 max-w-[250px] mx-auto mt-1">Ajuste os filtros ou tente outro termo.</p>
            </>
          ) : (
            <>
              <h4 className="text-sm font-semibold text-slate-800">Fila vazia</h4>
              <p className="text-xs text-slate-500 max-w-[250px] mx-auto mt-1">Não há chamados registrados.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="divide-y divide-slate-100 md:hidden">
        {tickets.map((ticket) => {
          const sla = getSlaInfo(ticket.prazo_sla, ticket.status, ticket.sla_status_operacional);
          const statusColor = getStatusColor(ticket.status);
          const isInitialStatus = statusSpecialMap.get(ticket.status) === 'inicial' || ticket.status === 'aberto';
          const isAbertoESemResp = isInitialStatus && !ticket.responsavel_id;
          const isSelected = selectedTicketIds.includes(ticket.id);
          const priority = getPriorityInfo(ticket.prioridade);
          const estadoInfo = getEstadoAtendimentoInfo(ticket.estado_atendimento);
          const firstResponse = getFirstResponseSlaInfo(ticket);

          return (
            <div
              key={ticket.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectTicket(ticket.id)}
              onContextMenu={(event) => onTicketContextMenu?.(event, ticket)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectTicket(ticket.id);
                }
              }}
              className={cn(
                "group cursor-pointer bg-white p-3 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500",
                isSelected ? "bg-blue-50" : "active:bg-slate-50",
                ticket.nao_lido && "font-semibold"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-1.5">
                    {ticket.nao_lido && (
                      <span className="h-2 w-2 rounded-full bg-blue-600" title="Mensagem não lida" />
                    )}
                    <span className="text-[11px] font-semibold text-slate-500">#{ticket.id}</span>
                    {ticket.origem === 'email' && (
                      <Mail size={12} className="text-slate-400" aria-label="Origem: E-mail" />
                    )}
                    {isAbertoESemResp && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        Novo
                      </span>
                    )}
                  </div>
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
                    {ticket.titulo}
                  </h3>
                </div>

                {canSelectBulk && (
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-opacity-20"
                    checked={isSelected}
                    onChange={() => toggleSelectTicket(ticket.id)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Selecionar chamado ${ticket.id}`}
                  />
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className={cn("inline-flex rounded px-2 py-1 text-[11px] font-semibold", statusColor.bg, statusColor.color)}>
                  {ticket.status.replace('_', ' ')}
                </span>
                <span className={cn("inline-flex rounded px-2 py-1 text-[11px] font-semibold", priority.bg, priority.color)}>
                  {priority.label}
                </span>
                <span className={cn("inline-flex items-center gap-1 rounded bg-slate-50 px-2 py-1 text-[11px] font-semibold", sla.color)}>
                  <Clock size={11} />
                  {sla.compactText || sla.label}
                </span>
                {!ticket.primeira_resposta_em && ticket.prazo_primeira_resposta && (
                  <span className={cn("inline-flex rounded bg-slate-50 px-2 py-1 text-[11px] font-semibold", firstResponse.color)}>
                    1ª resposta: {firstResponse.compactText || firstResponse.label}
                  </span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 text-[12px] text-slate-600">
                <div className="flex items-center gap-1.5 min-w-0">
                  <UserIcon size={13} className="shrink-0 text-slate-400" />
                  <span className="truncate">{ticket.cliente_nome || 'Cliente não informado'}</span>
                  {ticket.empresa_nome && (
                    <span className="truncate text-slate-400">/ {ticket.empresa_nome}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <ShieldAlert size={13} className="shrink-0 text-slate-400" />
                  <span className="truncate">
                    {ticket.responsavel_nome || 'Sem responsável'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("inline-flex items-center gap-1.5 font-medium", estadoInfo?.color || "text-slate-500")}>
                    {estadoInfo && <span className={cn("h-1.5 w-1.5 rounded-full", estadoInfo.dot)} />}
                    {estadoInfo?.label || 'Sem resposta'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Clock size={12} />
                    {formatRelativeTime(ticket.updated_at)}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
                <div className="flex min-w-0 gap-1">
                  {ticket.tags && ticket.tags.filter(tag => !tag.startsWith('ia-')).slice(0, 2).map(tag => (
                    <span key={tag} className="truncate rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                  {canAssumeTicket && isAbertoESemResp && (
                    <button onClick={(event) => handleAssumirTicket(event, ticket.id)} title="Assumir chamado" className="flex h-9 w-9 items-center justify-center rounded-md text-blue-600 hover:bg-blue-50">
                      <UserPlus size={16} />
                    </button>
                  )}
                  {canEditStatus && inProgressStatus && isInitialStatus && ticket.responsavel_id === currentUser.id && (
                    <button onClick={(event) => handleMudarStatus(event, ticket.id, inProgressStatus)} title="Iniciar atendimento" className="flex h-9 w-9 items-center justify-center rounded-md text-indigo-600 hover:bg-indigo-50">
                      <Play size={16} />
                    </button>
                  )}
                  <button onClick={(event) => handleCopyId(event, ticket.id)} title="Copiar ID" className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100">
                    <Copy size={16} />
                  </button>
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto no-scrollbar md:block">
        <table className="w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90">
              {canSelectBulk && (
                <th className="w-10 px-3 py-2 text-center">
                  <input 
                    type="checkbox" 
                    className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-opacity-20 cursor-pointer shadow-sm"
                    onChange={toggleSelectAll}
                    checked={isAllSelected}
                  />
                </th>
              )}
              <SortHeader label="Chamado" k="titulo" className="w-[300px]" />
              <th className="w-[140px] px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Situação</th>
              <th className="hidden px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 md:table-cell">Cliente</th>
              <SortHeader label="Status" k="status" className="w-[120px]" />
              <SortHeader label="Prioridade" k="prioridade" className="w-[100px]" />
              <th className="hidden w-[100px] px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 xl:table-cell">SLA</th>
              <th className="w-[140px] px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Responsável</th>
              <th className="w-[40px] px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tickets.map((ticket) => {
              const sla = getSlaInfo(ticket.prazo_sla, ticket.status, ticket.sla_status_operacional);
              const statusColor = getStatusColor(ticket.status);
              const isInitialStatus = statusSpecialMap.get(ticket.status) === 'inicial' || ticket.status === 'aberto';
              const isAbertoESemResp = isInitialStatus && !ticket.responsavel_id;
              const isSelected = selectedTicketIds.includes(ticket.id);
              const priority = getPriorityInfo(ticket.prioridade);
              const estadoInfo = getEstadoAtendimentoInfo(ticket.estado_atendimento);
              
              return (
                <tr 
                  key={ticket.id}
                  onClick={() => onSelectTicket(ticket.id)}
                  onContextMenu={(event) => onTicketContextMenu?.(event, ticket)}
                  className={cn(
                    "group relative cursor-pointer transition-colors",
                    isSelected ? "bg-blue-50" : "hover:bg-slate-50/80",
                    ticket.nao_lido && "font-semibold"
                  )}
                >
                  {canSelectBulk && (
                  <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-opacity-20 cursor-pointer shadow-sm"
                      checked={isSelected}
                      onChange={() => toggleSelectTicket(ticket.id)}
                    />
                  </td>
                )}
                <td className="px-3 py-2.5">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      {ticket.nao_lido && (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" title="Mensagem não lida" />
                      )}
                      <span className="text-[10px] text-slate-500 font-medium">#{ticket.id}</span>
                      
                      {ticket.origem === 'email' && (
                        <div className="text-slate-400" title="Origem: E-mail">
                          <Mail size={12} />
                        </div>
                      )}
                      
                      <span className="truncate text-xs font-semibold text-slate-900 transition-colors group-hover:text-slate-950">{ticket.titulo}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap min-w-0 mt-0.5">
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Clock size={10} /> {formatRelativeTime(ticket.updated_at)}
                      </span>
                      
                      {isAbertoESemResp && (
                        <span className="text-[9px] font-medium text-amber-700 bg-amber-100 px-1 rounded-sm">Novo</span>
                      )}
                      
                      {ticket.tags && ticket.tags.filter(tag => !tag.startsWith('ia-')).length > 0 && (
                        <div className="flex gap-1">
                          {ticket.tags.filter(tag => !tag.startsWith('ia-')).slice(0, 2).map(tag => (
                             <span key={tag} className="text-[9px] font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-sm px-1.5">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {estadoInfo ? (
                    <div className={cn(
                      "inline-flex items-center gap-1.5 text-[11px] font-medium",
                      estadoInfo.color
                    )}>
                      <div className={cn("w-1.5 h-1.5 rounded-full", estadoInfo.dot)} />
                      <span className="whitespace-nowrap">{estadoInfo.label}</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium">Nenhuma</span>
                  )}
                </td>
                <td className="hidden px-3 py-2.5 md:table-cell">
                  <div className="flex flex-col min-w-0 leading-tight">
                    <span className="text-xs font-medium text-slate-700 truncate">{ticket.cliente_nome || 'N/A'}</span>
                    <span className="text-[10px] text-slate-500 truncate">{ticket.empresa_nome}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                   <div className={cn(
                     "inline-flex rounded border border-transparent px-1.5 py-0.5 text-[11px] font-semibold",
                     statusColor.bg,
                     statusColor.color
                   )}>
                     {ticket.status.replace('_', ' ')}
                   </div>
                </td>
                <td className="px-3 py-2.5">
                   <div className={cn(
                     "inline-flex rounded border border-transparent px-1.5 py-0.5 text-[11px] font-semibold",
                     priority.bg,
                     priority.color
                   )}>
                     {priority.label}
                   </div>
                </td>
                <td className="hidden px-3 py-2.5 xl:table-cell">
                   <div className="flex flex-col items-start gap-0.5">
                     <div className={cn(
                       "inline-flex items-center gap-1 text-[11px] font-medium",
                       sla.color
                     )} title={`Resolução: ${sla.label}`}>
                       <Clock size={10} />
                       {sla.compactText || sla.label}
                     </div>
                     {!ticket.primeira_resposta_em && ticket.prazo_primeira_resposta && (
                       <div className={cn(
                         "text-[9px] font-medium",
                         getFirstResponseSlaInfo(ticket).color
                       )} title={`Primeira Resposta: ${getFirstResponseSlaInfo(ticket).label}`}>
                         PR: {getFirstResponseSlaInfo(ticket).compactText}
                       </div>
                     )}
                   </div>
                 </td>
                 <td className="px-3 py-2.5 text-right">
                  <div className="flex items-center justify-end">
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                      {canAssumeTicket && isAbertoESemResp && (
                        <button onClick={(e) => handleAssumirTicket(e, ticket.id)} title="Assumir" className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 text-blue-600 rounded transition-all">
                          <UserPlus size={14} />
                        </button>
                      )}
                      {canEditStatus && inProgressStatus && isInitialStatus && ticket.responsavel_id === currentUser.id && (
                        <button onClick={(e) => handleMudarStatus(e, ticket.id, inProgressStatus)} title="Iniciar" className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 text-indigo-600 rounded transition-all">
                          <Play size={14} />
                        </button>
                      )}
                      <button onClick={(e) => handleCopyId(e, ticket.id)} title="Copiar ID" className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 text-slate-500 rounded transition-all">
                        <Copy size={14} />
                      </button>
                    </div>
                    <div className="p-1 text-slate-300 group-hover:text-slate-600 transition-colors duration-200">
                       <ChevronRight size={16} />
                    </div>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-500 font-medium">Página {meta.page} de {meta.totalPages}</span>
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">{meta.total} chamados</span>
          </div>
          <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-6 px-2 text-[10px]"
              disabled={meta.page <= 1} 
              onClick={() => onPageChange?.(meta.page - 1)}
            >
              Anterior
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-6 px-2 text-[10px]"
              disabled={meta.page >= meta.totalPages} 
              onClick={() => onPageChange?.(meta.page + 1)}
            >
              Próximo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
