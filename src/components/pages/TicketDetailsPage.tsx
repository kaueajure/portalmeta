import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Ticket, Message, User, TicketAttachment, TicketTimelineItem, TicketOption, TicketStatus } from '../../types';
import { AlertCircle, Loader2, CheckCircle2, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { TicketHeader } from '../tickets/details/TicketHeader';
import { TicketProperties } from '../tickets/details/TicketProperties';
import { TicketConversation } from '../tickets/details/TicketConversation';
import { TicketTimeline } from '../tickets/details/TicketTimeline';
import { Select } from '../ui/Select';
import { cn } from '../../lib/utils';
import { hasAnyPermission, hasPermission } from '../../lib/permissions';
import { getSocket } from '../../lib/socket';
import { motion, AnimatePresence } from 'motion/react';
import { PageShell } from '../layout/PageShell';

interface TicketDetailsPageProps {
  ticketId: number;
  onBack: () => void;
  currentUser: User;
}

export const TicketDetailsPage = ({ ticketId, onBack, currentUser }: TicketDetailsPageProps) => {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [timeline, setTimeline] = useState<TicketTimelineItem[]>([]);
  const [activeTab, setActiveTab] = useState<'messages' | 'timeline'>('messages');
  const [loading, setLoading] = useState(true);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [loadingSend, setLoadingSend] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [agents, setAgents] = useState<User[]>([]);
  const [ticketAttachments, setTicketAttachments] = useState<TicketAttachment[]>([]);
  const [ticketStatusOptions, setTicketStatusOptions] = useState<TicketOption[]>([]);

  // Resolution Modal State
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [resolutionData, setResolutionData] = useState({
    status: 'resolvido' as TicketStatus,
    resolucao_motivo: '',
    resolucao_observacao: ''
  });

  const fetchData = async (options: { silent?: boolean } = {}) => {
    const silent = Boolean(options.silent);
    if (!silent) setLoading(true);
    if (!silent || activeTab === 'timeline') setLoadingTimeline(true);
    setError(null);
    try {
      const [ticketData, messagesData, attachmentsData, timelineData] = await Promise.all([
        api.get<Ticket>(`/tickets/${ticketId}`),
        api.get<Message[]>(`/tickets/${ticketId}/messages`),
        api.get<TicketAttachment[]>(`/tickets/${ticketId}/attachments`),
        api.get<TicketTimelineItem[]>(`/tickets/${ticketId}/timeline`).catch(err => {
          console.error('Erro ao carregar linha do tempo:', err);
          return [] as TicketTimelineItem[];
        })
      ]);
      
      setTicket(ticketData);
      setMessages(messagesData);
      setTicketAttachments(attachmentsData);
      setTimeline(timelineData);

      if (ticketData.empresa_id) {
        try {
          const statusRows = await api.get<TicketOption[]>(`/companies/${ticketData.empresa_id}/ticket-statuses`);
          setTicketStatusOptions(statusRows);
        } catch (statusErr) {
          console.error('Erro ao carregar status do atendimento:', statusErr);
          setTicketStatusOptions([]);
        }
      }

      // Marcar como lido
      api.post(`/tickets/${ticketId}/read`, {}).catch(err => {
        console.error('Erro ao marcar ticket como lido:', err);
      });

      if (hasAnyPermission(currentUser, ['tickets.assumir', 'tickets.atribuir', 'tickets.transferir', 'tickets.remover_responsavel'])) {
        const teamEndpoint = currentUser.desenvolvedor && ticketData.empresa_id
          ? `/users/team?empresa_id=${ticketData.empresa_id}`
          : '/users/team';
        const usersData = await api.get<User[]>(teamEndpoint);
        setAgents(usersData);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar detalhes do atendimento.';
      setError(message);
    } finally {
      if (!silent) setLoading(false);
      setLoadingTimeline(false);
    }
  };

  const refreshConversation = async () => {
    try {
      const [messagesData, attachmentsData, timelineData] = await Promise.all([
        api.get<Message[]>(`/tickets/${ticketId}/messages`),
        api.get<TicketAttachment[]>(`/tickets/${ticketId}/attachments`),
        api.get<TicketTimelineItem[]>(`/tickets/${ticketId}/timeline`).catch(() => [] as TicketTimelineItem[])
      ]);
      setMessages(messagesData);
      setTicketAttachments(attachmentsData);
      setTimeline(timelineData);
    } catch (err) {
      console.error('Erro ao atualizar conversa em tempo real:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [ticketId]);

  useEffect(() => {
    if (!ticket?.empresa_id) return;

    const socket = getSocket(ticket.empresa_id);

    const handleMessagesChanged = (payload: { ticketId: number, empresaId: number }) => {
      if (Number(payload.ticketId) !== Number(ticketId)) return;
      refreshConversation();
    };

    socket.on('ticketMessagesChanged', handleMessagesChanged);

    return () => {
      socket.off('ticketMessagesChanged', handleMessagesChanged);
    };
  }, [ticket?.empresa_id, ticketId]);

  const handleSendMessage = async (mensagem: string, isInternal: boolean, files: File[]): Promise<boolean> => {
    setLoadingSend(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      // 1. Create Message
      const messageResponse = await api.post<{ id: number }>(`/tickets/${ticketId}/messages`, {
        mensagem: mensagem.trim() || 'Anexo enviado.',
        interno: isInternal,
        suppress_email: !isInternal && files.length > 0
      });

      const messageId = messageResponse.id;

      // 2. Upload Attachments if any
      if (files.length > 0) {
        const formData = new FormData();
        files.forEach(file => formData.append('files', file));
        formData.append('mensagem_id', messageId.toString());
        formData.append('interno', isInternal.toString());

        await api.post(`/tickets/${ticketId}/attachments`, formData);
      }

      setActionSuccess('Mensagem enviada com sucesso!');
      
      // Reload conversation only instead of everything
      refreshConversation();
      
      setTimeout(() => setActionSuccess(null), 3000);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar mensagem.';
      setActionError(message);
      return false;
    } finally {
      setLoadingSend(false);
    }
  };

  const handleUpdateTicket = async (data: Partial<Ticket>) => {
    setActionError(null);
    setActionSuccess(null);
    try {
        const targetStatusOption = data.status
          ? ticketStatusOptions.find(option => option.valor === data.status)
          : null;
        const targetIsFinal = targetStatusOption?.especial === 'finalizado' || targetStatusOption?.especial === 'encerrado';

        if (data.status && targetIsFinal) {
            setResolutionData(prev => ({ ...prev, status: data.status as TicketStatus }));
            setIsResolveModalOpen(true);
            return;
        }

        if (data.status && isCurrentFinalStatus) {
             await api.patch(`/tickets/${ticketId}/reopen`, {});
             setActionSuccess('Chamado reaberto com sucesso!');
             setTicket(prev => prev ? { ...prev, status: data.status as TicketStatus } : prev);
             void fetchData({ silent: true });
             setTimeout(() => setActionSuccess(null), 3000);
             return;
        }

        if (data.status) {
            await api.patch(`/tickets/${ticketId}/status`, { status: data.status });
        } else {
            await api.patch(`/tickets/${ticketId}`, data);
        }
      setActionSuccess('Chamado atualizado com sucesso!');
      setTicket(prev => prev ? { ...prev, ...data } : prev);
      void fetchData({ silent: true });
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar chamado.';
      setActionError(message);
    }
  };

  const handleConfirmResolution = async () => {
    if (!resolutionData.resolucao_motivo) {
        alert('Por favor, informe o motivo da resolução.');
        return;
    }

    try {
        await api.patch(`/tickets/${ticketId}/resolve`, resolutionData);
        setIsResolveModalOpen(false);
        setActionSuccess(`Chamado ${resolutionData.status} com sucesso!`);
        setTicket(prev => prev ? { ...prev, status: resolutionData.status } : prev);
        void fetchData({ silent: true });
        setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao finalizar chamado.';
        alert(message);
    }
  };

  const handleArchiveTicket = async () => {
    if (!closedStatus) {
      setActionError('Nenhum status especial de encerramento foi configurado.');
      return;
    }
    await handleUpdateTicket({ status: closedStatus.valor });
  };

  const handleUpdateTags = async (tags: string[]) => {
    try {
      await api.put(`/tickets/${ticketId}/tags`, { tags });
      setTicket(prev => prev ? { ...prev, tags } : null);
    } catch (err) {
      console.error('Erro ao atualizar tags:', err);
      alert('Erro ao atualizar tags.');
    }
  };

  const handleUpdateCustomFields = async (fields: any[]) => {
    try {
      await api.put(`/tickets/${ticketId}/custom-fields`, { fields });
      setTicket(prev => prev ? { ...prev, custom_fields: fields } : null);
    } catch (err) {
      console.error('Erro ao atualizar campos personalizados:', err);
      alert('Erro ao atualizar campos personalizados.');
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este anexo permanentemente?')) return;
    
    try {
      await api.delete(`/attachments/${attachmentId}`);
      setActionSuccess('Anexo removido do sistema.');
      refreshConversation();
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir anexo.';
      setActionError(message);
    }
  };

  if (loading && !ticket) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center space-y-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        </div>
        <p className="text-xs font-semibold text-slate-500">Carregando chamado...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <Card className="p-6 border-red-100 bg-red-50/50 flex flex-col items-center justify-center text-center rounded-xl max-w-md mx-auto mt-8">
         <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
         <h2 className="text-base font-semibold text-slate-900 mb-1">Chamado não encontrado</h2>
         <p className="text-slate-600 text-sm mb-4">{error || 'O chamado solicitado pode ter sido removido ou você não tem acesso.'}</p>
         <Button onClick={onBack} size="sm" variant="outline" className="h-8 font-medium">Voltar para chamados</Button>
      </Card>
    );
  }

  const canEditStatus = hasPermission(currentUser, 'tickets.editar_status');
  const canFinalize = hasPermission(currentUser, 'tickets.finalizar');
  const canCloseTicket = hasPermission(currentUser, 'tickets.fechar');
  const canReopen = hasPermission(currentUser, 'tickets.reabrir');
  const canEditPriority = hasPermission(currentUser, 'tickets.editar_prioridade');
  const canEditResponsavel = hasAnyPermission(currentUser, [
    'tickets.assumir',
    'tickets.atribuir',
    'tickets.transferir',
    'tickets.remover_responsavel'
  ]);
  const canSendPublicReply = hasPermission(currentUser, 'ticket_mensagens.responder');
  const canAddInternalNote = hasPermission(currentUser, 'ticket_mensagens.comentar_interno');
  const canAttachFiles = hasPermission(currentUser, 'ticket_mensagens.anexar');
  const canDeleteAttachments = hasPermission(currentUser, 'ticket_mensagens.excluir_anexos');
  const activeTicketStatusOptions = ticketStatusOptions.filter(option => Number(option.ativo) === 1);
  const currentStatusOption = ticketStatusOptions.find(option => option.valor === ticket.status);
  const isCurrentFinalStatus = currentStatusOption?.especial === 'finalizado' || currentStatusOption?.especial === 'encerrado';
  const finalResolutionStatus = activeTicketStatusOptions.find(option => option.especial === 'finalizado')
    || activeTicketStatusOptions.find(option => option.especial === 'encerrado');
  const closedStatus = activeTicketStatusOptions.find(option => option.especial === 'encerrado');

  return (
    <PageShell
      flush
      contentClassName="!overflow-hidden flex flex-col bg-[#F5F7FA]"
    >
      {/* Header Centralizado */}
      <div className="shrink-0 z-20">
         <TicketHeader 
           ticket={ticket}
           currentUser={currentUser}
           onUpdate={handleUpdateTicket}
           onResolve={() => {
              if (!finalResolutionStatus) {
                setActionError('Nenhum status finalizado ou encerrado foi configurado.');
                return;
              }
              setResolutionData(prev => ({ ...prev, status: finalResolutionStatus.valor as TicketStatus }));
              setIsResolveModalOpen(true);
           }}
           onBack={onBack}
           canEditStatus={canEditStatus}
           canFinalize={canFinalize}
           canCloseTicket={canCloseTicket}
           canReopen={canReopen}
            canEditPriority={canEditPriority}
            canEditResponsavel={canEditResponsavel}
            agents={agents}
            statusOptions={ticketStatusOptions}
           />
      </div>

      {/* Main Workspace Grid */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#F5F7FA] md:flex-row md:overflow-hidden">
        {/* Left: Conversation Feed */}
        <div className="z-10 flex min-h-[620px] min-w-0 flex-none flex-col overflow-hidden bg-[#F5F7FA] shadow-[1px_0_0_rgba(15,23,42,0.06)] md:min-h-0 md:flex-1">
          <TicketConversation 
            ticket={ticket}
            messages={messages}
            currentUser={currentUser}
            onSendMessage={handleSendMessage}
            onDeleteAttachment={handleDeleteAttachment}
            loadingSend={loadingSend}
            actionError={actionError}
            actionSuccess={actionSuccess}
            canSendPublicReply={canSendPublicReply}
            canAddInternalNote={canAddInternalNote}
            canAttachFiles={canAttachFiles}
            canDeleteAttachments={canDeleteAttachments}
          />
        </div>

        {/* Right Sidebar: Tabs for Props & Timeline */}
        <div className="flex w-full shrink-0 flex-col overflow-hidden border-t border-slate-200 bg-[#F8FAFC] md:h-full md:w-[320px] md:border-l md:border-t-0 xl:w-[360px]">
          <div className="sticky top-0 z-20 flex shrink-0 border-b border-slate-200 bg-white px-2 pt-2">
             <button 
               onClick={() => setActiveTab('messages')}
               className={cn(
                 "flex-1 rounded-t-md border-b-2 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-all",
                 activeTab === 'messages' ? "border-slate-950 bg-slate-50 text-slate-950" : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"
               )}
             >
               Propriedades
             </button>
             <button 
               onClick={() => setActiveTab('timeline')}
               className={cn(
                 "flex-1 rounded-t-md border-b-2 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-all",
                 activeTab === 'timeline' ? "border-slate-950 bg-slate-50 text-slate-950" : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"
               )}
             >
               Histórico
             </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 pb-8 sm:p-4">
             <AnimatePresence mode="wait">
               {activeTab === 'messages' ? (
                 <motion.div
                   key="props"
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: -10 }}
                   transition={{ duration: 0.2 }}
                 >
                   <TicketProperties 
                     ticket={ticket}
                     currentUser={currentUser}
                      attachments={ticketAttachments}
                      onUpdate={handleUpdateTicket}
                      onArchive={handleArchiveTicket}
                      canArchiveStatus={Boolean(closedStatus)}
                      onUpdateTags={handleUpdateTags}
                      onUpdateCustomFields={handleUpdateCustomFields}
                    />
                 </motion.div>
               ) : (
                 <motion.div
                   key="timeline"
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: -10 }}
                   transition={{ duration: 0.2 }}
                 >
                   <TicketTimeline 
                     timeline={timeline}
                     loading={loadingTimeline}
                   />
                 </motion.div>
               )}
             </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Resolution Modal */}
      {isResolveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-3 sm:p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200"
          >
             <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100 flex justify-between items-center bg-white gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                     <CheckCircle2 size={16} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 tracking-tight truncate">
                       Concluir chamado
                    </h3>
                    <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">
                       Informe como este chamado foi resolvido
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsResolveModalOpen(false)}
                  className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-colors shrink-0 md:hidden"
                >
                  <X size={16} />
                </button>
             </div>

             <div className="p-4 sm:p-5 space-y-4">
                <div className="space-y-1.5">
                   <label className="text-[11px] font-semibold text-slate-600">Motivo da Resolução</label>
                   <Select 
                     value={resolutionData.resolucao_motivo}
                     onChange={(value) => setResolutionData(prev => ({ ...prev, resolucao_motivo: value }))}
                     placeholder="Selecione o motivo..."
                     buttonClassName="h-9 bg-slate-50 border-slate-200 rounded-lg text-xs font-sans"
                     options={[
                       { value: "duvida_sanada", label: "Dúvida sanada" },
                       { value: "problema_corrigido", label: "Problema corrigido" },
                       { value: "solicitacao_atendida", label: "Solicitação atendida" },
                       { value: "cancelamento_realizado", label: "Cancelamento realizado" },
                       { value: "duplicado", label: "Chamado duplicado" },
                       { value: "sem_retorno_cliente", label: "Sem retorno do cliente" },
                       { value: "outros", label: "Outros" }
                     ]}
                   />
                </div>

                <div className="space-y-1.5">
                   <label className="text-[11px] font-semibold text-slate-600">Observação Final</label>
                   <textarea 
                     value={resolutionData.resolucao_observacao}
                     onChange={(e) => setResolutionData(prev => ({ ...prev, resolucao_observacao: e.target.value }))}
                     placeholder="Detalhes sobre a solução..."
                     className="w-full h-16 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:ring-1 focus:ring-blue-400 transition-all resize-none font-sans"
                   />
                </div>
             </div>

             <div className="px-4 sm:px-5 py-3 sm:py-4 bg-slate-50/50 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 border-t border-slate-100">
                <Button 
                   variant="ghost" 
                   size="sm"
                   className="text-slate-500 hover:text-slate-700 font-sans" 
                   onClick={() => setIsResolveModalOpen(false)}
                >
                   Desistir
                </Button>
                <Button 
                   size="sm"
                   onClick={handleConfirmResolution} 
                   disabled={!resolutionData.resolucao_motivo}
                   className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm font-sans"
                >
                   Finalizar Agora
                </Button>
             </div>
          </motion.div>
        </div>
      )}
    </PageShell>
  );
};
