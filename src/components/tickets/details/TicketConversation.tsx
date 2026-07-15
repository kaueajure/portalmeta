import React, { useEffect, useRef } from 'react';
import { Message, Ticket, User } from '../../../types';
import {
  Calendar,
  ClipboardList,
  Clock3,
  Lock,
  MessageSquare,
  Paperclip,
  Reply,
  UserRound
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { AttachmentList } from '../../ui/AttachmentList';
import { TicketReplyBox } from './TicketReplyBox';

interface TicketConversationProps {
  ticket: Ticket;
  messages: Message[];
  currentUser: User;
  onSendMessage: (mensagem: string, isInternal: boolean, files: File[]) => Promise<boolean>;
  onDeleteAttachment: (id: number) => Promise<void>;
  loadingSend: boolean;
  actionError: string | null;
  actionSuccess: string | null;
  canSendPublicReply: boolean;
  canAddInternalNote: boolean;
  canAttachFiles: boolean;
  canDeleteAttachments: boolean;
}

const ticketSubject = (msg: any) =>
  msg.titulo ? `Assunto: ${msg.titulo}` : 'Mensagem inicial do solicitante';

const DateSeparator = ({ label }: { label: string }) => (
  <div className="flex items-center gap-3 py-1">
    <div className="h-px flex-1 bg-slate-200" />
    <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 shadow-sm">
      {label}
    </span>
    <div className="h-px flex-1 bg-slate-200" />
  </div>
);

const EmptyThread = () => (
  <div className="flex flex-col items-center rounded-lg border border-dashed border-slate-200 bg-white py-14 text-center">
    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-300">
      <MessageSquare size={22} />
    </div>
    <h4 className="mb-1 text-sm font-semibold tracking-tight text-slate-900">Aguardando interações</h4>
    <p className="max-w-xs text-xs font-medium leading-relaxed text-slate-500">
      Não há mensagens registradas para este chamado ainda.
    </p>
  </div>
);

type InteractionRole = 'opening' | 'requester' | 'assignee' | 'agent' | 'internal' | 'system';

const ThreadItem = ({
  msg,
  role,
  isCurrentUser = false,
  isAbertura = false,
  onDeleteAttachment
}: {
  msg: any;
  role: InteractionRole;
  isCurrentUser?: boolean;
  isAbertura?: boolean;
  onDeleteAttachment?: (id: number) => Promise<void>;
}) => {
  const isInternal = Number(msg.interno) === 1;
  const isSystem = role === 'system';
  const date = new Date(msg.created_at || msg.data_mensagem);
  const authorName = msg.usuario_nome || (isAbertura ? 'Solicitante' : isSystem ? 'Sistema' : 'Atendente');
  const messageText = msg.mensagem || msg.descricao;
  const attachmentsCount = msg.attachments?.length || 0;
  const interaction = isAbertura
    ? {
        label: 'Abertura',
        icon: ClipboardList,
        badge: 'bg-slate-100 text-slate-700 border-slate-200',
        line: 'border-l-slate-400',
        panel: 'bg-white'
      }
    : isInternal
      ? {
          label: 'Nota interna',
          icon: Lock,
          badge: 'bg-amber-50 text-amber-700 border-amber-200',
          line: 'border-l-amber-400',
          panel: 'bg-amber-50/30'
        }
      : isSystem
        ? {
            label: 'Sistema',
            icon: ClipboardList,
            badge: 'bg-violet-50 text-violet-700 border-violet-200',
            line: 'border-l-violet-300',
            panel: 'bg-white'
          }
      : role === 'requester'
        ? {
            label: 'Solicitante',
            icon: UserRound,
            badge: 'bg-blue-50 text-blue-700 border-blue-200',
            line: 'border-l-blue-400',
            panel: 'bg-white'
          }
      : role === 'assignee'
        ? {
            label: 'Responsável',
            icon: Reply,
            badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            line: 'border-l-emerald-400',
            panel: 'bg-white'
          }
        : {
            label: isCurrentUser ? 'Sua resposta' : 'Atendente',
            icon: Reply,
            badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            line: 'border-l-emerald-400',
            panel: 'bg-white'
          };
  const InteractionIcon = interaction.icon;

  return (
    <article
      className={cn(
        'overflow-hidden rounded-xl border border-l-[3px] border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        interaction.line,
        interaction.panel
      )}
    >
      <div className="flex flex-col gap-3 border-b border-slate-100/80 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
              isInternal
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-slate-200 bg-slate-50 text-slate-500'
            )}
          >
            <InteractionIcon size={15} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold tracking-tight text-slate-950">{authorName}</h3>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                  interaction.badge
                )}
              >
                {interaction.label}
              </span>
              {attachmentsCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                  <Paperclip size={10} />
                  {attachmentsCount}
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-xs font-medium text-slate-500">
              {isAbertura ? ticketSubject(msg) : 'Atualização do chamado'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 text-xs font-medium text-slate-500 sm:justify-end">
          <span className="inline-flex items-center gap-1">
            <Calendar size={12} />
            {date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock3 size={12} />
            {date.toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      <div className="px-4 py-4">
        <div
          className={cn(
            'whitespace-pre-wrap break-words text-sm leading-6 text-slate-700',
            isInternal ? 'text-slate-700' : 'text-slate-700'
          )}
        >
          {messageText}
        </div>

        {msg.attachments && msg.attachments.length > 0 && (
          <div className="mt-4 border-t border-slate-200/80 pt-3">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <Paperclip size={11} />
              Anexos
            </div>
            <AttachmentList attachments={msg.attachments} onRemove={onDeleteAttachment} compact />
          </div>
        )}
      </div>
    </article>
  );
};

export const TicketConversation = ({
  ticket,
  messages,
  currentUser,
  onSendMessage,
  onDeleteAttachment,
  loadingSend,
  actionError,
  actionSuccess,
  canSendPublicReply,
  canAddInternalNote,
  canAttachFiles,
  canDeleteAttachments
}: TicketConversationProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;
    scrollContainer.scrollTo({
      top: scrollContainer.scrollHeight,
      behavior
    });
  };

  const normalizeMessage = (value?: string | null) =>
    String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();

  const normalizeIdentity = (value?: string | null) =>
    normalizeMessage(value).replace(/[<>]/g, '');

  const requesterNames = [
    ticket.cliente_nome,
    ticket.cliente_email,
    ticket.solicitante_nome,
    ticket.solicitante_email
  ]
    .map(normalizeIdentity)
    .filter(Boolean);

  const getInteractionRole = (msg: any): InteractionRole => {
    if (msg.isAbertura) return 'opening';
    if (Number(msg.interno) === 1) return 'internal';

    const authorIdentity = normalizeIdentity(msg.usuario_nome);
    const authorLooksLikeRequester = authorIdentity
      ? requesterNames.some((name) => authorIdentity === name || authorIdentity.includes(name))
      : false;

    if (authorLooksLikeRequester) return 'requester';
    if (!msg.usuario_id) return authorIdentity ? 'system' : 'requester';
    if (ticket.responsavel_id && Number(msg.usuario_id) === Number(ticket.responsavel_id)) return 'assignee';

    return 'agent';
  };

  const normalizedDesc = normalizeMessage(ticket.descricao);
  const hasInitialMessageInMessages = messages
    .filter(msg => !Number(msg.interno))
    .slice(0, 3)
    .some(msg => normalizeMessage(msg.mensagem) === normalizedDesc);

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages]);

  const conversationItems = [
    ...(ticket.descricao && !hasInitialMessageInMessages
      ? [{
          ...ticket,
          id: `ticket-${ticket.id}`,
          usuario_nome: ticket.cliente_nome,
          created_at: ticket.created_at,
          isAbertura: true
        }]
      : []),
    ...messages.map(msg => ({ ...msg, isAbertura: false }))
  ];

  const isTicketFinalized = ticket.estado_atendimento === 'finalizado' || ticket.status === 'resolvido' || ticket.status === 'fechado';
  let lastDateLabel = '';

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#F5F7FA]">
      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-3 py-4 sm:px-5 sm:py-5">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-950">Histórico do chamado</h2>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  Thread iniciada em {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div className="text-xs font-medium text-slate-500">
                {conversationItems.length} {conversationItems.length === 1 ? 'interação' : 'interações'}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {conversationItems.length === 0 ? (
              <EmptyThread />
            ) : (
              conversationItems.map((msg: any) => {
                const dateLabel = new Date(msg.created_at || msg.data_mensagem).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                });
                const showDateSeparator = dateLabel !== lastDateLabel;
                lastDateLabel = dateLabel;

                return (
                  <React.Fragment key={msg.id}>
                    {showDateSeparator && <DateSeparator label={dateLabel} />}
                    <ThreadItem
                      msg={msg}
                      role={getInteractionRole(msg)}
                      isCurrentUser={!!msg.usuario_id && msg.usuario_id === currentUser.id}
                      isAbertura={msg.isAbertura}
                      onDeleteAttachment={canDeleteAttachments ? onDeleteAttachment : undefined}
                    />
                  </React.Fragment>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.04)]">
        <div className="mx-auto w-full max-w-5xl p-3 sm:px-5">
          {isTicketFinalized ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 py-4">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200/50 text-slate-400">
                <Lock size={14} />
              </div>
              <p className="mb-0.5 text-xs font-semibold tracking-tight text-slate-900">Chamado fechado</p>
              <p className="text-[10px] font-medium text-slate-500">
                Reabra o chamado para enviar novas mensagens.
              </p>
            </div>
          ) : !canSendPublicReply && !canAddInternalNote ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 py-4">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200/50 text-slate-400">
                <Lock size={14} />
              </div>
              <p className="mb-0.5 text-xs font-semibold tracking-tight text-slate-900">Sem permissão para responder</p>
              <p className="text-[10px] font-medium text-slate-500">
                Solicite acesso a respostas ou notas internas.
              </p>
            </div>
          ) : (
            <TicketReplyBox
              ticket={ticket}
              currentUser={currentUser}
              onSendMessage={onSendMessage}
              loadingSend={loadingSend}
              actionError={actionError}
              actionSuccess={actionSuccess}
              canSendPublicReply={canSendPublicReply}
              canAddInternalNote={canAddInternalNote}
              canAttachFiles={canAttachFiles}
            />
          )}
          <div className="mt-2 text-center text-[10px] font-medium text-slate-400">
            Respostas públicas notificam o solicitante. Notas internas ficam visíveis apenas para a equipe.
          </div>
        </div>
      </div>
    </div>
  );
};
