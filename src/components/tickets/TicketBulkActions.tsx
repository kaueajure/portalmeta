import React, { useState } from 'react';
import { 
  CheckCircle2, 
  UserPlus, 
  Tag as TagIcon, 
  Archive, 
  AlertCircle,
  X,
  ChevronDown
} from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import { hasAnyPermission, hasPermission } from '../../lib/permissions';
import { TicketStatus, TicketPriority, TicketStatusSpecial, User } from '../../types';

interface TicketBulkActionsProps {
  selectedCount: number;
  onAction: (action: string, value?: any) => void;
  onClear: () => void;
  agents: User[];
  currentUser: User;
  statusOptions: { value: TicketStatus; label: string; special?: TicketStatusSpecial | string | null }[];
}

export const TicketBulkActions = ({ selectedCount, onAction, onClear, agents, currentUser, statusOptions }: TicketBulkActionsProps) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  if (selectedCount === 0) return null;

  const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
    { value: 'baixa', label: 'Baixa' },
    { value: 'media', label: 'Média' },
    { value: 'alta', label: 'Alta' },
    { value: 'urgente', label: 'Urgente' },
  ];

  const handleAction = (action: string, value?: any) => {
    onAction(action, value);
    setOpenMenu(null);
  };

  const canEditStatus = hasPermission(currentUser, 'tickets.editar_status');
  const canFinalize = hasPermission(currentUser, 'tickets.finalizar');
  const canCloseTicket = hasPermission(currentUser, 'tickets.fechar');
  const canEditPriority = hasPermission(currentUser, 'tickets.editar_prioridade');
  const canAssignResponsavel = hasAnyPermission(currentUser, ['tickets.assumir', 'tickets.atribuir', 'tickets.transferir']);
  const canRemoveResponsavel = hasPermission(currentUser, 'tickets.remover_responsavel');
  const canManageTags = hasPermission(currentUser, 'tickets.gerenciar_tags');

  const visibleStatusOptions = statusOptions.filter((opt) => {
    if (opt.special === 'finalizado') return canFinalize;
    if (opt.special === 'encerrado') return canCloseTicket;
    return canEditStatus;
  });
  const showStatusAction = canEditStatus && visibleStatusOptions.length > 0;
  const showAgentAction = canAssignResponsavel || canRemoveResponsavel;
  const hasSecondaryActions = showStatusAction || canEditPriority || showAgentAction || canManageTags;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 w-[calc(100vw-24px)] md:w-auto max-w-[560px] overflow-x-auto no-scrollbar rounded-xl">
      <div className="bg-white text-slate-900 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200 p-1.5 flex items-center gap-1 w-max mx-auto">
        {/* Count Indicator */}
        <div className="bg-blue-50 text-blue-700 h-8 px-3 rounded-lg flex items-center gap-1.5 mr-2">
            <span className="text-[13px] font-semibold">{selectedCount}</span>
            <span className="text-xs font-medium">Selecionados</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5">
          {/* Status */}
          {showStatusAction && (
          <div className="relative">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setOpenMenu(openMenu === 'status' ? null : 'status')}
              className={cn(
                "text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-[11px] font-medium gap-1.5 px-2 h-8",
                openMenu === 'status' && "bg-slate-100 text-slate-900"
              )}
            >
              <CheckCircle2 size={14} />
              Status
              <ChevronDown size={12} className={cn("transition-transform text-slate-400", openMenu === 'status' && "rotate-180")} />
            </Button>
            {openMenu === 'status' && (
              <div className="absolute bottom-full mb-2 left-0 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden min-w-[140px]">
                {visibleStatusOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleAction('status', opt.value)}
                    className="w-full text-left px-3 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          )}

          {/* Priority */}
          {canEditPriority && (
          <div className="relative">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setOpenMenu(openMenu === 'priority' ? null : 'priority')}
              className={cn(
                "text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-[11px] font-medium gap-1.5 px-2 h-8",
                openMenu === 'priority' && "bg-slate-100 text-slate-900"
              )}
            >
              <AlertCircle size={14} />
              Prioridade
              <ChevronDown size={12} className={cn("transition-transform text-slate-400", openMenu === 'priority' && "rotate-180")} />
            </Button>
            {openMenu === 'priority' && (
              <div className="absolute bottom-full mb-2 left-0 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden min-w-[140px]">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleAction('prioridade', opt.value)}
                    className="w-full text-left px-3 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          )}

          {/* Agent */}
          {showAgentAction && (
          <div className="relative">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setOpenMenu(openMenu === 'agent' ? null : 'agent')}
              className={cn(
                "text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-[11px] font-medium gap-1.5 px-2 h-8",
                openMenu === 'agent' && "bg-slate-100 text-slate-900"
              )}
            >
              <UserPlus size={14} />
              Atribuir
              <ChevronDown size={12} className={cn("transition-transform text-slate-400", openMenu === 'agent' && "rotate-180")} />
            </Button>
            {openMenu === 'agent' && (
              <div className="absolute bottom-full mb-2 left-0 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden min-w-[180px] max-h-[250px] overflow-y-auto custom-scrollbar">
                {canRemoveResponsavel && (
                <button
                  onClick={() => handleAction('responsavel', null)}
                  className="w-full text-left px-3 py-2 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-colors border-b border-slate-100"
                >
                  Remover Responsável
                </button>
                )}
                {canAssignResponsavel && agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => handleAction('responsavel', agent.id)}
                    className="w-full text-left px-3 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    {agent.nome}
                  </button>
                ))}
              </div>
            )}
          </div>
          )}

          {/* Tag */}
          {canManageTags && (
          <div className="relative">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setOpenMenu(openMenu === 'tag' ? null : 'tag')}
              className={cn(
                "text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-[11px] font-medium gap-1.5 px-2 h-8",
                openMenu === 'tag' && "bg-slate-100 text-slate-900"
              )}
            >
              <TagIcon size={14} />
              Tag
            </Button>
            {openMenu === 'tag' && (
              <div className="absolute bottom-full mb-2 left-0 bg-white border border-slate-200 rounded-lg shadow-lg p-2 min-w-[180px]">
                 <input 
                   autoFocus
                   type="text" 
                   placeholder="Nova tag..."
                   className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') {
                       handleAction('add_tag', (e.target as HTMLInputElement).value);
                     }
                   }}
                 />
                 <p className="mt-1.5 text-[10px] text-slate-400 text-center">Pressione Enter para adicionar</p>
              </div>
            )}
          </div>
          )}

          {canCloseTicket && hasSecondaryActions && <div className="w-px h-5 bg-slate-200 mx-1" />}

          {/* Close */}
          {canCloseTicket && statusOptions.some((opt) => opt.special === 'encerrado') && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => handleAction('fechar')}
            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 text-[11px] font-medium gap-1.5 px-2 h-8"
          >
            <Archive size={14} />
            Fechar
          </Button>
          )}
        </div>

        {/* Clear */}
        <button 
          onClick={onClear}
          className="ml-auto w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title="Limpar seleção"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
