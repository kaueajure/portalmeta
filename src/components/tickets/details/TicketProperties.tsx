import React, { useState, useEffect } from 'react';
import { User, Ticket, TicketAttachment } from '../../../types';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Select } from '../../ui/Select';
import { api } from '../../../lib/api';
import { cn, getSlaInfo, getFirstResponseSlaInfo } from '../../../lib/utils';
import { 
  Building2, 
  Trash2, 
  Clock, 
  Globe,
  Layers,
  Tag as TagIcon,
  Briefcase,
  Paperclip,
  CheckCircle2,
  Bot,
  Sparkles,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { AttachmentList } from '../../ui/AttachmentList';
import { TicketTags } from '../TicketTags';
import { TicketCustomFields } from './TicketCustomFields';
import { useTicketOptions } from '../../../hooks/useTicketOptions';
import { hasPermission } from '../../../lib/permissions';
import { getCategoryShortLabel } from '../../../lib/ticketOptions';

const PropertyRow = ({ label, icon: Icon, children, className }: { label: string, icon?: any, children: React.ReactNode, className?: string }) => (
  <div className={cn("flex flex-col gap-1.5 py-2 first:pt-0", className)}>
    <div className="flex items-center gap-1 text-[9px] font-bold uppercase leading-none tracking-wider text-slate-500">
       {Icon && <Icon size={10} />}
       {label}
    </div>
    <div className="w-full">
      {children}
    </div>
  </div>
);

const Section = ({ title, icon: Icon, children, badge }: { title: string, icon?: any, children: React.ReactNode, badge?: React.ReactNode }) => (
  <div className="rounded-xl border border-slate-200 bg-white text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <div className="flex items-center justify-between rounded-t-[11px] border-b border-slate-100 bg-white px-3 py-2.5">
      <h3 className="flex items-center gap-1.5 text-[11px] font-bold text-slate-900">
        {Icon && <Icon size={12} className="text-slate-500" />}
        {title}
      </h3>
      {badge}
    </div>
    <div className="space-y-0 divide-y divide-slate-100 p-3">
      {children}
    </div>
  </div>
);

interface TicketPropertiesProps {
  ticket: Ticket;
  currentUser: User;
  attachments: TicketAttachment[];
  onUpdate: (data: Partial<Ticket>) => void;
  onArchive: () => void;
  canArchiveStatus: boolean;
  onUpdateTags?: (tags: string[]) => void;
  onUpdateCustomFields?: (fields: any[]) => void;
}

export const TicketProperties = ({ 
  ticket, 
  currentUser, 
  attachments,
  onUpdate,
  onArchive,
  canArchiveStatus,
  onUpdateTags,
  onUpdateCustomFields
}: TicketPropertiesProps) => {
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);

  const fetchSummaryAndStatus = async () => {
    try {
      const statusRes = await api.get<{ available: boolean }>('/ai/status');
      setAiAvailable(statusRes.available);
      
      if (statusRes.available) {
        setLoadingSummary(true);
        const res = await api.get<{ summary: string | null }>(`/ai/tickets/${ticket.id}/summary`);
        setSummary(res.summary);
      }
    } catch (err) {
      console.error('Erro ao buscar resumo/status da IA:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    fetchSummaryAndStatus();
  }, [ticket.id]);

  const handleRefreshSummary = async () => {
    if (!aiAvailable) return;
    setLoadingSummary(true);
    try {
      const res = await api.get<{ summary: string | null }>(`/ai/tickets/${ticket.id}/summary`);
      setSummary(res.summary);
    } catch (err) {
      console.error('Erro ao atualizar resumo da timeline:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const aiSentimentoTag = ticket.tags?.find(t => t.startsWith('ia-sentimento:'));
  const aiCategoriaTag = ticket.tags?.find(t => t.startsWith('ia-categoria:'));
  const isTicketFinalized = ticket.estado_atendimento === 'finalizado' || ticket.status === 'resolvido' || ticket.status === 'fechado';

  const sentimento = aiSentimentoTag ? aiSentimentoTag.split(':')[1] : null;
  const categoriaSugerida = aiCategoriaTag ? aiCategoriaTag.split(':')[1] : null;

  const companyId = ticket.empresa_id ? String(ticket.empresa_id) : undefined;
  const { activeCategories, activeServices } = useTicketOptions(companyId);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const canEditOrigem = hasPermission(currentUser, 'tickets.editar_origem');
  const canEditCategoria = hasPermission(currentUser, 'tickets.editar_categoria');
  const canEditServico = hasPermission(currentUser, 'tickets.editar_servico');
  const canManageTags = hasPermission(currentUser, 'tickets.gerenciar_tags');
  const canEditCustomFields = hasPermission(currentUser, 'tickets.editar_campos_customizados');
  const canCloseTicket = hasPermission(currentUser, 'tickets.fechar');

  const defaultCategories = [
    { value: 'suporte_tecnico', label: 'Suporte Técnico' },
    { value: 'financeiro', label: 'Financeiro' },
    { value: 'recursos_humanos', label: 'RH' },
    { value: 'comercial', label: 'Comercial' },
    { value: 'outros', label: 'Outros' }
  ];
  
  const defaultServices = [
    { value: 'suporte', label: 'Suporte' },
    { value: 'implantacao', label: 'Implantação' },
    { value: 'treinamento', label: 'Treinamento' },
    { value: 'outros', label: 'Outros' }
  ];

  const categoryOptions = activeCategories.length > 0 
    ? activeCategories.map(c => ({ value: c.valor, label: getCategoryShortLabel(c) }))
    : defaultCategories;

  const serviceOptions = activeServices.length > 0 
    ? activeServices.map(s => ({ value: s.valor, label: s.nome }))
    : defaultServices;

  const slaInfo = getSlaInfo(ticket.prazo_sla, ticket.status);
  const firstResponseSla = getFirstResponseSlaInfo(ticket);

  return (
    <div className="flex flex-col gap-3">
      <ConfirmDialog 
        isOpen={isArchiveConfirmOpen}
        onClose={() => setIsArchiveConfirmOpen(false)}
        onConfirm={() => {
            setIsArchiveConfirmOpen(false);
            onArchive();
        }}
        title="Arquivar chamado?"
        description="O chamado será fechado e continuará disponível para consulta."
        confirmLabel="Arquivar"
        cancelLabel="Cancelar"
        variant="danger"
      />

      {/* Resumo IA Section */}
      {aiAvailable && (
        <Section 
          title="Resumo da Conversa (IA)" 
          icon={Sparkles}
          badge={
            <button
              onClick={handleRefreshSummary}
              disabled={loadingSummary}
              className="p-1 hover:bg-slate-200/60 text-slate-500 rounded transition-colors disabled:opacity-50"
              title="Atualizar Resumo"
            >
              <RefreshCw size={11} className={cn(loadingSummary && "animate-spin text-indigo-600")} />
            </button>
          }
        >
          <div className="p-1 text-slate-700 leading-relaxed text-xs">
            {loadingSummary ? (
              <div className="flex items-center gap-2 py-3 text-slate-500 font-medium">
                <Loader2 size={12} className="animate-spin text-indigo-600" />
                <span>Analisando conversas...</span>
              </div>
            ) : summary ? (
              <p className="rounded-lg border border-indigo-100/70 bg-indigo-50/60 p-2.5 text-xs font-medium leading-relaxed text-slate-700">
                {summary}
              </p>
            ) : (
              <p className="font-medium text-slate-400">Histórico insuficiente para gerar resumo.</p>
            )}
          </div>
        </Section>
      )}

      {/* Triagem Inteligente (IA) */}
      {aiAvailable && (sentimento || categoriaSugerida) && (
        <Section title="Triagem Inteligente (IA)" icon={Bot}>
          {sentimento && (
            <PropertyRow label="Sentimento Detectado" icon={Bot}>
              <div className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide shadow-sm mt-0.5",
                sentimento === 'frustrado' && "bg-rose-50 border-rose-100 text-rose-700",
                sentimento === 'negativo' && "bg-rose-50 border-rose-100 text-rose-600",
                sentimento === 'neutro' && "bg-slate-50 border-slate-200 text-slate-600",
                sentimento === 'positivo' && "bg-emerald-50 border-emerald-100 text-emerald-700"
              )}>
                {sentimento === 'frustrado' && "😡 Frustrado"}
                {sentimento === 'negativo' && "⚠️ Negativo"}
                {sentimento === 'neutro' && "😐 Neutro"}
                {sentimento === 'positivo' && "😊 Positivo"}
                {!['frustrado', 'negativo', 'neutro', 'positivo'].includes(sentimento) && `✨ ${sentimento}`}
              </div>
            </PropertyRow>
          )}

          {categoriaSugerida && (
            <PropertyRow label="Categoria Sugerida" icon={Layers}>
              <div className="mt-0.5 flex items-center justify-between gap-2 rounded-md border border-indigo-100/70 bg-indigo-50/50 px-2 py-1">
                <span className="text-xs font-semibold text-slate-700">{categoriaSugerida}</span>
                {ticket.categoria !== categoriaSugerida.toLowerCase() && !['financeiro', 'suporte_tecnico', 'comercial', 'outros'].filter(catValue => {
                   const matchingLabelMap: Record<string, string> = {
                     financeiro: 'Financeiro',
                     suporte_tecnico: 'Suporte Técnico',
                     comercial: 'Comercial'
                   };
                   return ticket.categoria === catValue && matchingLabelMap[catValue] === categoriaSugerida;
                }).length && (
                  <Button 
                    size="xs" 
                    variant="outline" 
                    disabled={!canEditCategoria}
                    className="h-5 px-1.5 text-[9px] font-bold text-indigo-600 bg-white hover:text-white hover:bg-indigo-600 border-indigo-200 rounded transition-all shadow-sm"
                    onClick={() => {
                      if (!canEditCategoria) return;
                      const valueMap: Record<string, string> = {
                        'Financeiro': 'financeiro',
                        'Suporte Técnico': 'suporte_tecnico',
                        'Comercial': 'comercial'
                      };
                      const val = valueMap[categoriaSugerida] || 'outros';
                      onUpdate({ categoria: val });
                    }}
                  >
                    Aplicar
                  </Button>
                )}
              </div>
            </PropertyRow>
          )}
        </Section>
      )}

      {/* Seção 2: SLA & Prazos */}
      <Section 
        title="Controle de SLA" 
        icon={Clock}
        badge={
          <div className={cn(
            "text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider",
            slaInfo.status === 'vencido' ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
          )}>
            {slaInfo.label}
          </div>
        }
      >
        <div className="space-y-1.5 py-1">
          {/* Primeira Resposta */}
          <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50/80 p-2">
             <div className="flex flex-col">
                <span className="text-[10px] font-medium text-slate-500 mb-0.5">Resposta Inicial</span>
                <span className="text-xs font-semibold text-slate-700">
                  {ticket.prazo_primeira_resposta ? formatDate(ticket.prazo_primeira_resposta) : 'Não definido'}
                </span>
             </div>
             <Badge 
               variant={firstResponseSla.status === 'finalizado' ? 'emerald' : firstResponseSla.status === 'vencido' ? 'red' : 'amber'}
               className="text-[9px] px-1.5 py-0 rounded"
             >
               {firstResponseSla.label}
             </Badge>
          </div>

          {/* Resolução Final */}
          <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50/80 p-2">
             <div className="flex flex-col">
                <span className="text-[10px] font-medium text-slate-500 mb-0.5">Resolução SLA</span>
                <span className="text-xs font-semibold text-slate-700">
                  {ticket.prazo_sla ? formatDate(ticket.prazo_sla) : 'Não definido'}
                </span>
             </div>
             <Badge 
               variant={slaInfo.status === 'vencido' ? 'red' : slaInfo.status === 'finalizado' ? 'emerald' : 'amber'}
               className="text-[9px] px-1.5 py-0 rounded"
             >
               {slaInfo.label}
             </Badge>
          </div>

          {ticket.primeira_resposta_em && (
             <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium px-1 mt-1">
                <CheckCircle2 size={12} className="text-emerald-500" />
                <span>Interação às {new Date(ticket.primeira_resposta_em).toLocaleTimeString()}</span>
             </div>
          )}
        </div>
      </Section>

      {/* Seção 3: Cliente & Origem */}
      <Section title="Solicitante e origem" icon={Globe}>
        <PropertyRow label="Solicitante">
           <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
              <div className="text-sm font-semibold text-slate-900 mb-0.5">{ticket.cliente_nome || 'Desconhecido'}</div>
              <div className="text-[11px] text-slate-500 truncate">{ticket.cliente_email || 'n/a'}</div>
              {ticket.empresa_nome && (
                <div className="mt-2 flex w-fit items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                  <Building2 size={10} /> {ticket.empresa_nome}
                </div>
              )}
           </div>
        </PropertyRow>
        
        <PropertyRow label="Canal de Origem">
           <Select 
             value={ticket.origem || 'portal'}
             onChange={(value) => onUpdate({ origem: value })}
             options={[
               { value: 'portal', label: 'Portal' },
               { value: 'email', label: 'E-mail' },
               { value: 'whatsapp', label: 'WhatsApp' },
               { value: 'chat', label: 'Chat' },
               { value: 'manual', label: 'Manual' }
             ]}
             buttonClassName="w-full h-7 text-[11px] font-semibold bg-white border-slate-200 rounded text-slate-700"
             disabled={!canEditOrigem}
           />
        </PropertyRow>
      </Section>

      {/* Seção 4: Classificação */}
      <Section title="Classificação" icon={Layers}>
        <PropertyRow label="Categoria">
           <Select 
             value={ticket.categoria || ''}
             onChange={(value) => onUpdate({ categoria: value })}
             options={categoryOptions}
             buttonClassName="w-full h-7 text-[11px] font-semibold bg-white border-slate-200 rounded text-slate-700"
             disabled={!canEditCategoria}
           />
        </PropertyRow>
        <PropertyRow label="Serviço / Produto">
           <Select 
             value={ticket.servico || ''}
             onChange={(value) => onUpdate({ servico: value })}
             options={serviceOptions}
             buttonClassName="w-full h-7 text-[11px] font-semibold bg-white border-slate-200 rounded text-slate-700"
             disabled={!canEditServico}
           />
        </PropertyRow>

        <PropertyRow label="Tags / Etiquetas" icon={TagIcon}>
           <TicketTags 
              tags={(ticket.tags || []).filter(tag => !tag.startsWith('ia-'))}
              onAdd={(tag) => onUpdateTags?.([...(ticket.tags || []), tag])}
              onRemove={(tag) => onUpdateTags?.((ticket.tags || []).filter(t => t !== tag))}
              readOnly={!canManageTags}
            />
        </PropertyRow>
      </Section>

      {/* Seção 5: Extras & Anexos */}
      <Section title="Atributos Extras" icon={Briefcase}>
        <PropertyRow label="Dados Adicionais">
           <TicketCustomFields 
             fields={ticket.custom_fields || []}
             onUpdate={onUpdateCustomFields || (() => {})}
             readOnly={!canEditCustomFields}
           />
        </PropertyRow>
        <PropertyRow label="Documentos em Anexo" icon={Paperclip}>
           {attachments.length > 0 ? (
             <AttachmentList attachments={attachments} compact />
           ) : (
             <div className="flex flex-col items-center justify-center p-4 bg-slate-50/50 border border-slate-200 border-dashed rounded-lg text-slate-400">
                <Paperclip size={16} className="mb-1 opacity-50" />
                <span className="text-[10px] font-medium">Nenhum anexo</span>
             </div>
           )}
        </PropertyRow>
      </Section>

      {/* Seção 6: Resolução info se finalizado */}
      {isTicketFinalized && (
        <Section title="Conclusão" icon={CheckCircle2}>
           <div className="space-y-3 py-1">
              <div className="flex flex-col px-1">
                 <span className="text-[10px] font-semibold text-slate-500 mb-0.5">Motivo</span>
                 <span className="text-xs font-semibold text-slate-900">{ticket.resolucao_motivo?.replace('_', ' ') || 'Não inf.'}</span>
              </div>
              <div className="flex flex-col px-1">
                 <span className="text-[10px] font-semibold text-slate-500 mb-0.5">Observação</span>
                 <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-900">
                    "{ticket.resolucao_observacao || 'Nenhuma observação registrada.'}"
                 </div>
              </div>
           </div>
        </Section>
      )}

      {/* Seção 7: Arquivar */}
      {canCloseTicket && canArchiveStatus && !isTicketFinalized && (
        <div className="pt-2">
           <Button 
             variant="outline"
             size="sm"
             onClick={() => setIsArchiveConfirmOpen(true)}
             className="h-8 w-full rounded-md border border-rose-200 text-xs font-semibold text-rose-600 transition-all hover:bg-rose-600 hover:text-white"
           >
             <Trash2 size={14} className="mr-1.5" /> 
             Encerrar Definitivamente
           </Button>
        </div>
      )}
    </div>
  );
};
