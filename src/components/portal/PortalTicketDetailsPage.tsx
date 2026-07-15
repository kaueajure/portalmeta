import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { Badge } from '../ui/Badge';
import { User } from '../../types';
import { Button } from '../ui/Button';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../../lib/utils';

interface PortalTicketDetailsPageProps {
  ticketId: number;
  onBack: () => void;
  currentUser: User;
}

export const PortalTicketDetailsPage = ({ ticketId, onBack, currentUser }: PortalTicketDetailsPageProps) => {
  const [ticket, setTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchTicket = async () => {
    try {
      const t = await api.get(`/portal/tickets/${ticketId}`);
      setTicket(t);
      const m = await api.get<any[]>(`/portal/tickets/${ticketId}/messages`);
      setMessages(m);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch {}
  };

  useEffect(() => {
    fetchTicket();
  }, [ticketId]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim()) return;
    setSending(true);
    try {
      await api.post(`/portal/tickets/${ticketId}/messages`, {
        mensagem: replyMessage
      });
      setReplyMessage('');
      fetchTicket();
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

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

  if (!ticket) return <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-slate-300" size={24}/></div>;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-sm font-bold text-slate-400">#{ticket.id}</span>
            {getStatusBadge(ticket.status)}
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">{ticket.titulo}</h1>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col min-h-[400px]">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="prose prose-sm prose-slate max-w-none text-slate-700 whitespace-pre-wrap">
            {ticket.descricao}
          </div>
        </div>

        <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-slate-50">
          {messages.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm font-medium">Nenhuma mensagem ainda.</div>
          ) : (
            messages.map((msg, i) => {
              const isMine = msg.usuario_id === currentUser.id;
              
              if (msg.tipo === 'status_change') {
                 return (
                   <div key={i} className="flex justify-center my-3">
                     <span className="text-xs font-medium text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full">{msg.mensagem}</span>
                   </div>
                 );
              }
              
              return (
                <div key={i} className={cn("flex flex-col", isMine ? "items-end" : "items-start")}>
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-sm font-semibold text-slate-900">{msg.usuario_nome || 'Equipe de suporte'}</span>
                    <span className="text-xs text-slate-500">{format(new Date(msg.created_at), "dd MMM, HH:mm", { locale: ptBR })}</span>
                  </div>
                  <div className={cn(
                    "max-w-[85%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap",
                    isMine 
                      ? "bg-blue-600 text-white rounded-tr-sm shadow-sm" 
                      : "bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm"
                  )}>
                    {msg.mensagem}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-white border-t border-slate-200">
          <form onSubmit={handleReply} className="flex flex-col gap-2.5">
            <textarea
              value={replyMessage}
              onChange={e => setReplyMessage(e.target.value)}
              placeholder="Escreva sua mensagem..."
              className="w-full resize-none h-16 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all outline-none"
            />
            <div className="flex justify-end gap-2">
              <Button type="submit" disabled={sending || !replyMessage.trim()} className="font-semibold px-5 text-sm h-9">
                {sending ? 'Enviando...' : <span className="flex items-center"><Send size={16} className="mr-2" /> Enviar</span>}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
