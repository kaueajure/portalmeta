import React from 'react';
import { TicketTimelineItem } from '../../../types';
import { 
  MessageCircle, 
  Lock, 
  RefreshCw, 
  CheckCircle,
  Activity,
  History,
  Tag,
  FileText,
  ShieldCheck,
  RotateCcw,
  Zap
} from 'lucide-react';
import { cn, formatRelativeTime } from '../../../lib/utils';

interface TicketTimelineProps {
  timeline: TicketTimelineItem[];
  loading?: boolean;
}

const getIcon = (type: string) => {
  switch (type) {
    case 'creation': return History;
    case 'response': return MessageCircle;
    case 'internal_note': return Lock;
    case 'completion': return CheckCircle;
    case 'reopen': return RotateCcw;
    case 'system': return ShieldCheck;
    case 'tag_change': return Tag;
    case 'custom_field': return FileText;
    default: return Activity;
  }
};

const getEventColor = (type: string) => {
  switch (type) {
    case 'creation': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    case 'response': return 'bg-blue-50 text-blue-600 border-blue-100/50';
    case 'internal_note': return 'bg-amber-50 text-amber-600 border-amber-100/50';
    case 'completion': return 'bg-slate-900 text-white border-slate-900';
    case 'reopen': return 'bg-orange-50 text-orange-600 border-orange-100';
    case 'system': return 'bg-slate-50 text-slate-500 border-slate-100';
    case 'tag_change': return 'bg-rose-50 text-rose-600 border-rose-100';
    case 'custom_field': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
    default: return 'bg-slate-50 text-slate-400 border-slate-100';
  }
};

const normalizeTimelineText = (value?: string | null) =>
  String(value || '')
    .replace(/\bTickets\b/g, 'Chamados')
    .replace(/\btickets\b/g, 'chamados')
    .replace(/\bTicket\b/g, 'Chamado')
    .replace(/\bticket\b/g, 'chamado');

const formatTimelineAction = (value?: string | null) =>
  normalizeTimelineText(value)
    .replace(/_/g, ' ')
    .toLowerCase();

export const TicketTimeline = ({ timeline, loading }: TicketTimelineProps) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center space-y-3 py-10">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white">
           <RefreshCw size={18} className="animate-spin text-blue-500" />
        </div>
        <p className="text-xs font-semibold text-slate-500">Carregando histórico...</p>
      </div>
    );
  }

  if (!timeline || timeline.length === 0) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-300 shadow-sm">
          <History size={22} />
        </div>
        <h4 className="text-sm font-semibold text-slate-900 mb-1">Timeline Vazia</h4>
        <p className="text-xs text-slate-500">Nenhuma atividade registrada.</p>
      </div>
    );
  }

  return (
    <div className="relative pl-5">
      {/* Vertical Track */}
      <div className="absolute bottom-4 left-[9px] top-4 w-px bg-slate-200" />
      
      <div className="relative space-y-4">
        {timeline.map((item, index) => {
          const Icon = getIcon(item.type);
          const colorClasses = getEventColor(item.type);
          const date = new Date(item.date);
          const description = normalizeTimelineText(item.description);
          const action = item.action ? formatTimelineAction(item.action) : '';
          
          return (
            <div key={index} className="group relative animate-in fade-in slide-in-from-left-4 duration-500">
              {/* Event Marker */}
              <div className={cn(
                "absolute -left-[24px] top-1 z-10 flex h-5 w-5 items-center justify-center rounded-md border-2 border-white shadow-sm transition-transform group-hover:scale-110",
                colorClasses
              )}>
                <Icon size={10} />
              </div>
              
              <div className="flex flex-col gap-0.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold tracking-tight text-slate-900">
                       {item.type === 'internal_note' ? 'Nota Interna' : 
                        item.type === 'system' ? 'Sistema' : 
                        item.type === 'response' ? 'Resposta' : 
                        item.type === 'creation' ? 'Abertura' : 
                        item.type === 'reopen' ? 'Reabertura' :
                        item.type === 'tag_change' ? 'Tags' :
                        item.type === 'custom_field' ? 'Campo Extra' : 'Conclusão'}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span className="text-[10px] font-medium text-slate-500">
                       {item.author}
                    </span>
                  </div>
                  <time className="shrink-0 rounded-sm border border-slate-100 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                    {date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </time>
                </div>
                
                <div className={cn(
                  "pr-4 text-xs font-medium leading-relaxed",
                  item.type === 'internal_note' ? "text-amber-700 italic" : "text-slate-600"
                )}>
                  {description}
                </div>
                
                {action && (
                   <div className="mt-1 flex w-fit items-center gap-1 rounded border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
                     <Zap size={10} />
                     {action}
                   </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
