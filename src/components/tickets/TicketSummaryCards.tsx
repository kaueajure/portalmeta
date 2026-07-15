import React from 'react';
import { TicketStatus } from '../../types';

interface SummaryProps {
  summary: Record<TicketStatus | 'total', number> & { [key: string]: number };
}

export const TicketSummaryCards = ({ summary }: SummaryProps) => {
  const metrics = [
    { label: 'Aberto', value: summary.aberto || 0, color: 'text-blue-600', dot: 'bg-blue-500' },
    { label: 'Andamento', value: summary.em_andamento || 0, color: 'text-indigo-600', dot: 'bg-indigo-500' },
    { label: 'Pend. Cliente', value: summary.aguardando_cliente || 0, color: 'text-amber-600', dot: 'bg-amber-500' },
    { label: 'SLA Crítico', value: summary.sla_vencido || 0, color: 'text-rose-600', dot: 'bg-rose-500' },
    { label: 'Resolvidos', value: summary.resolvido || 0, color: 'text-emerald-600', dot: 'bg-emerald-500' },
  ];

  return (
    <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-1">
      {metrics.map((metric, idx) => (
        <div key={metric.label} className="flex items-center gap-1.5 shrink-0">
          <div className={`w-1.5 h-1.5 rounded-full ${metric.dot}`} />
          <span className="text-[11px] font-medium text-slate-500">{metric.label}</span>
          <span className={`text-[11px] font-bold ${metric.color}`}>{metric.value}</span>
          {idx < metrics.length - 1 && (
            <div className="w-px h-3 bg-slate-200 ml-3" />
          )}
        </div>
      ))}
    </div>
  );
};
