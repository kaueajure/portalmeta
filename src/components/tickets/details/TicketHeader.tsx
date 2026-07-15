import React from 'react';
import { Button } from '../../ui/Button';
import { Select } from '../../ui/Select';
import { 
  ArrowLeft, 
  CheckCircle2,
  RefreshCw,
  Clock,
  Mail,
  UserRound,
  CalendarDays,
  Building2
} from 'lucide-react';
import { Ticket, TicketOption, TicketStatus, User } from '../../../types';
import { cn, getSlaInfo } from '../../../lib/utils';

interface TicketHeaderProps {
  ticket: Ticket;
  currentUser: User;
  onUpdate: (data: Partial<Ticket>) => Promise<void>;
  onResolve: () => void;
  onBack: () => void;
  canEditStatus: boolean;
  canFinalize: boolean;
  canCloseTicket: boolean;
  canReopen: boolean;
  canEditPriority: boolean;
  canEditResponsavel: boolean;
  agents: User[];
  statusOptions: TicketOption[];
}

export const TicketHeader = ({ 
  ticket, 
  currentUser, 
  onUpdate, 
  onResolve, 
  onBack,
  canEditStatus,
  canFinalize,
  canCloseTicket,
  canReopen,
  canEditPriority,
  canEditResponsavel,
  agents,
  statusOptions: configuredStatusOptions
}: TicketHeaderProps) => {
  const { 
    id, 
    titulo, 
    status, 
    prioridade, 
    origem, 
    cliente_nome,
    empresa_nome,
    responsavel_nome,
    prazo_sla,
    sla_status_operacional,
    created_at
  } = ticket;

  const slaInfo = getSlaInfo(prazo_sla, status, sla_status_operacional);
  const activeStatusOptions = configuredStatusOptions
    .filter(option => Number(option.ativo) === 1)
    .map(option => ({
      value: option.valor,
      label: option.nome,
      special: option.especial || 'normal'
    }));
  const statusOptions = activeStatusOptions.some(option => option.value === status)
    ? activeStatusOptions
    : [
        ...activeStatusOptions,
        {
          value: status || 'aberto',
          label: (status || 'aberto').replace(/_/g, ' '),
          special: 'normal'
        }
      ];
  const currentStatusOption = statusOptions.find(option => option.value === status);
  const isFinalStatus = currentStatusOption?.special === 'finalizado' || currentStatusOption?.special === 'encerrado';
  const hasFinalizableStatus = statusOptions.some(option => option.special === 'finalizado');
  const hasCloseStatus = statusOptions.some(option => option.special === 'encerrado');
  const reopenTargetStatus = statusOptions.find(option => option.special === 'inicial')?.value
    || statusOptions.find(option => option.special !== 'finalizado' && option.special !== 'encerrado')?.value;
  const showResolveButton = !isFinalStatus && ((canFinalize && hasFinalizableStatus) || (canCloseTicket && hasCloseStatus));
  const showReopenButton = canReopen && isFinalStatus && Boolean(reopenTargetStatus);
  const filteredStatusOptions = statusOptions.filter(option => {
    if (option.value === status) return true;
    if (option.special === 'finalizado') return canFinalize;
    if (option.special === 'encerrado') return canCloseTicket;
    if (isFinalStatus) return canReopen && canEditStatus;
    return true;
  });

  const getPriorityInfo = (prio: string) => {
    switch (prio) {
      case 'urgente': return { dot: 'bg-red-500' };
      case 'alta': return { dot: 'bg-orange-500' };
      case 'media': return { dot: 'bg-amber-500' };
      case 'baixa': return { dot: 'bg-blue-500' };
      default: return { dot: 'bg-slate-400' };
    }
  };
  const priorityColor = getPriorityInfo(prioridade);
  const openedAt = new Date(created_at).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur sm:px-5">
      <div className="flex flex-col gap-3">
        
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onBack}
              className="h-8 w-8 shrink-0 rounded-md p-0 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <ArrowLeft size={17} />
            </Button>
            
            <div className="min-w-0 flex-1">
              {origem === 'email' && (
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
                    <Mail size={11} />
                    E-mail
                  </span>
                </div>
              )}
              <h2 className="text-base font-semibold leading-snug tracking-tight text-slate-950 sm:text-lg">
                {titulo || 'Sem título'} <span className="font-medium text-slate-400">#{id}</span>
              </h2>
            </div>
          </div>

          <div className="flex shrink-0 items-center">
            {showResolveButton && (
              <Button 
                onClick={onResolve}
                size="sm"
                className="h-8 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500"
              >
                <CheckCircle2 size={14} className="mr-1.5" />
                Finalizar
              </Button>
            )}

            {showReopenButton && (
              <Button 
                variant="outline"
                size="sm"
                onClick={() => onUpdate({ status: reopenTargetStatus as TicketStatus })}
                className="h-8 rounded-md border-blue-200 px-3 text-xs font-semibold text-blue-600 shadow-sm hover:bg-blue-50"
              >
                <RefreshCw size={14} className="mr-1.5" />
                Reabrir
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-7">
          <HeaderSelectMeta
            label="Status"
            icon={<span className={cn("w-2 h-2 rounded-full", ticketStatusColors[status] || "bg-slate-400")} />}
          >
            <Select 
              value={status || 'aberto'}
              onChange={(value) => onUpdate({ status: value as TicketStatus })}
              options={filteredStatusOptions}
              buttonClassName="h-7 rounded-md border-slate-200 bg-white text-xs font-semibold text-slate-800 capitalize"
              dropdownClassName="min-w-[180px]"
              disabled={!canEditStatus || filteredStatusOptions.length <= 1 || (isFinalStatus && !canReopen)}
            />
          </HeaderSelectMeta>
          <HeaderSelectMeta
            label="Prioridade"
            icon={<span className={cn("w-2 h-2 rounded-sm", priorityColor.dot)} />}
          >
            <div className="relative">
              <span className={cn("absolute left-2 top-1/2 -translate-y-1/2 z-10 w-2 h-2 rounded-sm pointer-events-none", priorityColor.dot)} />
              <Select 
                value={prioridade || 'media'}
                onChange={(value) => onUpdate({ prioridade: value as any })}
                options={[
                  { value: 'baixa', label: 'Baixa' },
                  { value: 'media', label: 'Média' },
                  { value: 'alta', label: 'Alta' },
                  { value: 'urgente', label: 'Urgente' }
                ]}
                buttonClassName="h-7 rounded-md border-slate-200 bg-white pl-6 text-xs font-semibold text-slate-800"
                dropdownClassName="min-w-[150px]"
                disabled={!canEditPriority}
              />
            </div>
          </HeaderSelectMeta>
          <HeaderSelectMeta
            label="Responsável"
            icon={<UserRound size={14} />}
          >
            <Select 
              value={ticket.responsavel_id ? String(ticket.responsavel_id) : ''}
              onChange={(value) => onUpdate({ responsavel_id: value ? Number(value) : null })}
              options={[
                { value: '', label: 'Sem responsável' },
                ...agents.map(a => ({ value: String(a.id), label: a.nome }))
              ]}
              buttonClassName="h-7 rounded-md border-slate-200 bg-white text-xs font-semibold text-slate-800"
              dropdownClassName="min-w-[220px]"
              disabled={!canEditResponsavel}
            />
          </HeaderSelectMeta>
          <HeaderMeta
            label="Solicitante"
            value={cliente_nome || 'Não informado'}
            icon={<UserRound size={14} />}
          />
          <HeaderMeta
            label="SLA"
            value={slaInfo.compactText || slaInfo.label}
            icon={<Clock size={14} />}
            className={slaInfo.color}
          />
          <HeaderMeta
            label="Abertura"
            value={openedAt}
            icon={<CalendarDays size={14} />}
          />
          <HeaderMeta
            label="Empresa"
            value={empresa_nome || 'Não informada'}
            icon={<Building2 size={14} />}
          />
        </div>
      </div>
    </div>
  );
};

const HeaderMeta = ({
  label,
  value,
  icon,
  className
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  className?: string;
}) => (
  <div className={cn(
    "min-w-0 rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2 transition-colors",
    className
  )}>
    <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
      {icon}
      {label}
    </div>
    <div className="truncate text-xs font-semibold text-slate-950" title={value}>
      {value}
    </div>
  </div>
);

const HeaderSelectMeta = ({
  label,
  icon,
  children
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2">
    <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
      {icon}
      {label}
    </div>
    {children}
  </div>
);

const ticketStatusColors: Record<string, string> = {
  aberto: "bg-blue-500",
  em_andamento: "bg-indigo-500",
  aguardando_cliente: "bg-amber-500",
  resolvido: "bg-emerald-500",
  fechado: "bg-slate-400",
};
