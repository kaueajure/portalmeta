import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Ticket, Message, User, TicketAttachment, TicketTimelineItem, TicketOption, TicketStatus } from '../../types';
import { AlertCircle, Loader2 } from 'lucide-react';
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
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';

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
  const [attachmentToDelete, setAttachmentToDelete] = useState<number | null>(null);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [duplicateTicketId, setDuplicateTicketId] = useState('');
  const [merging, setMerging] = useState(false);

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

      try {
        const statusRows = await api.get<TicketOption[]>('/ticket-settings/statuses');
        setTicketStatusOptions(statusRows);
      } catch (statusErr) {
        console.error('Erro ao carregar status do atendimento:', statusErr);
        setTicketStatusOptions([]);
      }

      // Marcar como lido
      api.post(`/tickets/${ticketId}/read`, {}).catch(err => {
        console.error('Erro ao marcar ticket como lido:', err);
      });

      if (hasAnyPermission(currentUser, ['tickets.assumir', 'tickets.atribuir', 'tickets.transferir', 'tickets.remover_responsavel'])) {
        const usersData = await api.get<User[]>('/users/team');
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
    const socket = getSocket();

    const handleMessagesChanged = (payload: { ticketId: number }) => {
      if (Number(payload.ticketId) !== Number(ticketId)) return;
      refreshConversation();
    };

    socket.on('ticketMessagesChanged', handleMessagesChanged);

    return () => {
      socket.off('ticketMessagesChanged', handleMessagesChanged);
    };
  }, [ticketId]);

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
        setActionError('Por favor, informe o motivo da resolução.');
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
        setActionError(message);
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
      setActionError('Erro ao atualizar tags.');
    }
  };

  const handleUpdateCustomFields = async (fields: any[]) => {
    try {
      await api.put(`/tickets/${ticketId}/custom-fields`, { fields });
      setTicket(prev => prev ? { ...prev, custom_fields: fields } : null);
    } catch (err) {
      console.error('Erro ao atualizar campos personalizados:', err);
      setActionError('Erro ao atualizar campos personalizados.');
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    setAttachmentToDelete(attachmentId);
  };

  const confirmDeleteAttachment = async () => {
    if (attachmentToDelete === null) return;
    try {
      await api.delete(`/attachments/${attachmentToDelete}`);
      setActionSuccess('Anexo removido do sistema.');
      refreshConversation();
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir anexo.';
      setActionError(message);
    }
  };

  const handleMergeTicket = async () => {
    const sourceId = Number(duplicateTicketId);
    if (!Number.isInteger(sourceId) || sourceId <= 0 || sourceId === ticketId) {
      setActionError('Informe o número de outro chamado válido.');
      return;
    }
    setMerging(true);
    setActionError(null);
    try {
      await api.post(`/tickets/${ticketId}/unir`, { chamado_duplicado_id: sourceId });
      setIsMergeModalOpen(false);
      setDuplicateTicketId('');
      setActionSuccess(`Chamado #${sourceId} unido com sucesso.`);
      await fetchData({ silent: true });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao unir chamados.');
    } finally {
      setMerging(false);
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
  const currentUserIsResponsible = Number(ticket.responsavel_id) === Number(currentUser.id);
  const canEditResponsavel = ticket.responsavel_id
    ? currentUserIsResponsible && hasAnyPermission(currentUser, [
        'tickets.transferir',
        'tickets.remover_responsavel',
      ])
    : hasAnyPermission(currentUser, ['tickets.assumir', 'tickets.atribuir']);
  const canSendPublicReply = hasPermission(currentUser, 'ticket_mensagens.responder');
  const canAddInternalNote = hasPermission(currentUser, 'ticket_mensagens.comentar_interno');
  const canAttachFiles = hasPermission(currentUser, 'ticket_mensagens.anexar');
  const canDeleteAttachments = hasPermission(currentUser, 'ticket_mensagens.excluir_anexos');
  const canMergeTickets = hasPermission(currentUser, 'tickets.unir');
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
            canMerge={canMergeTickets}
            onMerge={() => setIsMergeModalOpen(true)}
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

      <Modal
        isOpen={isResolveModalOpen}
        onClose={() => setIsResolveModalOpen(false)}
        title="Concluir chamado"
        size="sm"
        footer={<><Button variant="ghost" size="sm" onClick={() => setIsResolveModalOpen(false)}>Desistir</Button><Button size="sm" onClick={handleConfirmResolution} disabled={!resolutionData.resolucao_motivo} className="bg-emerald-600 hover:bg-emerald-700">Finalizar agora</Button></>}
      >
             <div className="space-y-4">
                <p className="text-sm text-slate-600">Informe como este chamado foi resolvido.</p>
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
      </Modal>
      <ConfirmDialog
        isOpen={attachmentToDelete !== null}
        onClose={() => setAttachmentToDelete(null)}
        onConfirm={confirmDeleteAttachment}
        title="Excluir anexo?"
        description="O arquivo será removido permanentemente do chamado e não poderá ser recuperado."
        confirmLabel="Excluir anexo"
        variant="danger"
      />
      <Modal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        title="Unir chamado duplicado"
        size="sm"
        footer={<><Button variant="ghost" size="sm" onClick={() => setIsMergeModalOpen(false)}>Cancelar</Button><Button size="sm" loading={merging} onClick={handleMergeTicket}>Unir chamados</Button></>}
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">As mensagens, anexos, tags, campos e histórico do chamado duplicado serão movidos para o chamado #{ticketId}. O duplicado será arquivado.</p>
          <Input
            label="Número do chamado duplicado"
            type="number"
            min={1}
            value={duplicateTicketId}
            onChange={event => setDuplicateTicketId(event.target.value)}
            placeholder="Ex: 123"
          />
          {actionError && <div className="rounded-md border border-red-100 bg-red-50 p-2 text-xs font-medium text-red-600">{actionError}</div>}
        </div>
      </Modal>
    </PageShell>
  );
};
