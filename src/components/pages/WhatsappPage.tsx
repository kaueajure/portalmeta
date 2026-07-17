import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MessageCircle,
  RefreshCw,
  Send,
  Check,
  AlertTriangle,
  Phone,
  Search,
  Plus,
  ArrowLeft,
  Folder,
  FolderOpen,
  Hand,
  UserRoundCheck,
  Clock3,
  ArrowRightLeft,
  CircleStop,
  TicketCheck,
  ExternalLink,
} from "lucide-react";
import { PageShell } from "../layout/PageShell";
import { Button } from "../ui/Button";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";
import { Notification as SystemNotification, User } from "../../types";
import { hasPermission } from "../../lib/permissions";
import { getSocket } from "../../lib/socket";
import { Modal } from "../ui/Modal";
import { Select } from "../ui/Select";
import { ConfirmDialog } from "../ui/ConfirmDialog";

interface WhatsappPageProps {
  currentUser: User;
  onOpenSettings?: () => void;
  onOpenTicket?: (ticketId: number) => void;
}

interface WhatsAppStatus {
  configured: boolean;
}

interface WhatsAppConversation {
  contact_phone: string;
  contact_name: string | null;
  last_body: string | null;
  last_direction: "inbound" | "outbound" | null;
  last_message_at: string;
  message_count: number;
  service_id: string | null;
  service_title: string | null;
  attendance_status: "idle" | "pending" | "active" | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  assigned_at: string | null;
  registered_ticket_id: number | null;
}

interface WhatsAppMessage {
  id: number;
  wa_message_id: string | null;
  direction: "inbound" | "outbound";
  from_phone: string | null;
  to_phone: string | null;
  contact_name: string | null;
  message_type: string;
  body: string | null;
  status: string | null;
  created_at: string;
}

function formatPhoneLabel(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 9) {
      return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    }
    if (rest.length === 8) {
      return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
  }
  return digits ? `+${digits}` : phone;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (sameDay) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string | null, phone: string) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
  }
  return phone.slice(-2) || "?";
}

interface WhatsAppAssignment {
  user_id: number;
  user_name: string;
  assigned_at: string;
}

interface WhatsAppAssignmentHistoryItem extends WhatsAppAssignment {
  id: number;
}

interface WhatsAppAssignmentDetails {
  current: WhatsAppAssignment | null;
  history: WhatsAppAssignmentHistoryItem[];
}

interface TeamMember { id: number; nome: string; email: string; cargo: string | null; perfil?: string | null; }

function hasActiveService(conversation: WhatsAppConversation | null): boolean {
  return Boolean(
    conversation?.attendance_status === "active" && conversation.service_id?.trim(),
  );
}

export const WhatsappPage = ({ currentUser, onOpenSettings, onOpenTicket }: WhatsappPageProps) => {
  const canManage = hasPermission(currentUser, "integracoes.whatsapp.gerenciar");
  const canCreateTicket = hasPermission(currentUser, "tickets.criar");
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [thread, setThread] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [registeringTicket, setRegisteringTicket] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [targetUserId, setTargetUserId] = useState('');
  const [assignmentDetails, setAssignmentDetails] = useState<WhatsAppAssignmentDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [composer, setComposer] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);
  const selectedPhoneRef = useRef<string | null>(selectedPhone);
  const conversationsRef = useRef<WhatsAppConversation[]>(conversations);
  const threadRequestRef = useRef(0);
  const conversationRequestRef = useRef(0);
  selectedPhoneRef.current = selectedPhone;
  conversationsRef.current = conversations;

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.contact_phone === selectedPhone) || null,
    [conversations, selectedPhone],
  );

  const selectedAssignment = assignmentDetails !== null
    ? assignmentDetails.current
    : (
        selectedConversation?.assigned_user_id &&
        selectedConversation.assigned_user_name &&
        selectedConversation.assigned_at
          ? {
              user_id: selectedConversation.assigned_user_id,
              user_name: selectedConversation.assigned_user_name,
              assigned_at: selectedConversation.assigned_at,
            }
          : null
      );
  const isCurrentUserResponsible = selectedAssignment?.user_id === Number(currentUser.id);
  const isSelectedAttendanceActive = hasActiveService(selectedConversation);

  const serviceFolders = useMemo(() => {
    const map = new Map<string, { id: string; title: string; count: number }>();
    for (const conv of conversations) {
      if (!hasActiveService(conv)) continue;
      const id = String(conv.service_id || "").trim().toUpperCase();
      const current = map.get(id);
      if (current) {
        current.count += 1;
      } else {
        map.set(id, {
          id,
          title: conv.service_title || id,
          count: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      const activeServiceId = hasActiveService(c)
        ? String(c.service_id).trim().toUpperCase()
        : "";
      if (activeFolder === "none") {
        if (activeServiceId) return false;
      } else if (activeFolder !== "all") {
        if (activeServiceId !== activeFolder) return false;
      }
      if (!q) return true;
      const activeServiceTitle = activeServiceId ? c.service_title || "" : "";
      const hay = `${c.contact_name || ""} ${c.contact_phone} ${c.last_body || ""} ${activeServiceId} ${activeServiceTitle}`.toLowerCase();
      return hay.includes(q);
    });
  }, [conversations, search, activeFolder]);

  const withoutServiceCount = useMemo(
    () => conversations.filter((c) => !hasActiveService(c)).length,
    [conversations],
  );

  const loadStatusAndConversations = useCallback(async (opts?: { silent?: boolean }) => {
    const requestId = ++conversationRequestRef.current;
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const [statusData, conversationData] = await Promise.all([
        api.get<WhatsAppStatus>("/whatsapp/status"),
        api.get<WhatsAppConversation[]>("/whatsapp/conversations?limit=100"),
      ]);
      if (requestId === conversationRequestRef.current) {
        setStatus(statusData);
        setConversations(conversationData);
      }
    } catch (err: any) {
      setError(err?.message || "Não foi possível carregar o WhatsApp.");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  const loadThread = useCallback(async (phone: string, opts?: { silent?: boolean }) => {
    const requestId = ++threadRequestRef.current;
    if (!opts?.silent) setThreadLoading(true);
    try {
      const messages = await api.get<WhatsAppMessage[]>(
        `/whatsapp/conversations/${encodeURIComponent(phone)}/messages?limit=300`,
      );
      if (requestId === threadRequestRef.current && selectedPhoneRef.current === phone) {
        setThread(messages);
      }
    } catch (err: any) {
      setError(err?.message || "Não foi possível carregar a conversa.");
    } finally {
      if (!opts?.silent && requestId === threadRequestRef.current) setThreadLoading(false);
    }
  }, []);

  const loadAssignment = useCallback(async (phone: string) => {
    try {
      const details = await api.get<WhatsAppAssignmentDetails>(
        `/whatsapp/conversations/${encodeURIComponent(phone)}/assignment`,
      );
      setAssignmentDetails(details);
    } catch (err: any) {
      setError(err?.message || "N\u00e3o foi poss\u00edvel carregar o respons\u00e1vel pelo atendimento.");
    }
  }, []);

  useEffect(() => {
    loadStatusAndConversations();
    const requestedPhone = window.sessionStorage.getItem("portalmeta.whatsapp.openPhone");
    if (requestedPhone) {
      window.sessionStorage.removeItem("portalmeta.whatsapp.openPhone");
      setSelectedPhone(requestedPhone);
    }
  }, [loadStatusAndConversations]);

  useEffect(() => {
    const openConversation = (event: Event) => {
      const phone = String((event as CustomEvent<{ phone?: string }>).detail?.phone || '').replace(/\D/g, '');
      if (phone) setSelectedPhone(phone);
    };
    window.addEventListener('portalmeta:open-whatsapp', openConversation);
    return () => window.removeEventListener('portalmeta:open-whatsapp', openConversation);
  }, []);

  useEffect(() => {
    if (!selectedPhone) {
      setThread([]);
      setAssignmentDetails(null);
      return;
    }
    setAssignmentDetails(null);
    void Promise.all([loadThread(selectedPhone), loadAssignment(selectedPhone)]);
  }, [selectedPhone, loadThread, loadAssignment]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread, selectedPhone]);

  useEffect(() => {
    pollRef.current = window.setInterval(() => {
      loadStatusAndConversations({ silent: true });
      if (selectedPhone) {
        loadThread(selectedPhone, { silent: true });
        loadAssignment(selectedPhone);
      }
    }, 4_000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [loadStatusAndConversations, loadThread, loadAssignment, selectedPhone]);

  useEffect(() => {
    const socket = getSocket();
    let refreshTimer: number | null = null;

    const handleWhatsAppChanged = () => {
      if (selectedPhoneRef.current) {
        void loadThread(selectedPhoneRef.current, { silent: true });
      }
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        void loadStatusAndConversations({ silent: true });
        if (selectedPhoneRef.current) {
          void loadAssignment(selectedPhoneRef.current);
        }
      }, 50);
    };

    socket.on("whatsappChanged", handleWhatsAppChanged);

    return () => {
      socket.off("whatsappChanged", handleWhatsAppChanged);
      if (refreshTimer) window.clearTimeout(refreshTimer);
    };
  }, [loadStatusAndConversations, loadThread, loadAssignment]);

  useEffect(() => {
    const socket = getSocket();
    let confirmTimer: number | null = null;
    const handleNotification = (notification: SystemNotification) => {
      const metadata = notification?.metadata || {};
      const category = String(metadata.category || '');
      if (category !== 'whatsapp_general' && category !== 'whatsapp_assigned') return;

      const phone = String(metadata.phone || '').replace(/\D/g, '');
      const messageId = Number(metadata.messageId);
      if (!phone) return;
      if (!Number.isInteger(messageId) || messageId <= 0) {
        void loadStatusAndConversations({ silent: true });
        if (selectedPhoneRef.current === phone) void loadThread(phone, { silent: true });
        return;
      }
      const createdAt = String(metadata.createdAt || notification.created_at || new Date().toISOString());
      const notificationPreview = String(notification.mensagem || '').split(' · ').slice(1).join(' · ') || null;
      const body = metadata.body == null ? notificationPreview : String(metadata.body);
      const contactName = metadata.contactName == null ? null : String(metadata.contactName);
      const message: WhatsAppMessage = {
        id: messageId,
        wa_message_id: null,
        direction: 'inbound',
        from_phone: phone,
        to_phone: null,
        contact_name: contactName,
        message_type: 'text',
        body,
        status: 'received',
        created_at: createdAt,
      };
      const previousConversation = conversationsRef.current.find((conversation) => conversation.contact_phone === phone);
      const beginsNewCycle = previousConversation?.attendance_status === 'idle';

      conversationRequestRef.current += 1;
      setConversations((current) => {
        const existing = current.find((conversation) => conversation.contact_phone === phone);
        if (!existing) {
          return [{
            contact_phone: phone,
            contact_name: contactName,
            last_body: body,
            last_direction: 'inbound',
            last_message_at: createdAt,
            message_count: 1,
            service_id: null,
            service_title: null,
            attendance_status: null,
            assigned_user_id: null,
            assigned_user_name: null,
            assigned_at: null,
            registered_ticket_id: null,
          }, ...current];
        }
        const updated = {
          ...existing,
          contact_name: contactName || existing.contact_name,
          last_body: body,
          last_direction: 'inbound' as const,
          last_message_at: createdAt,
          message_count: beginsNewCycle ? 1 : existing.message_count + 1,
          ...(beginsNewCycle ? {
            service_id: null,
            service_title: null,
            attendance_status: 'pending' as const,
            assigned_user_id: null,
            assigned_user_name: null,
            assigned_at: null,
            registered_ticket_id: null,
          } : {}),
        };
        return [updated, ...current.filter((conversation) => conversation.contact_phone !== phone)];
      });

      if (selectedPhoneRef.current === phone) {
        threadRequestRef.current += 1;
        if (beginsNewCycle) {
          setThread([message]);
          setAssignmentDetails(null);
        } else {
          setThread((current) => current.some((item) => item.id === messageId)
            ? current
            : [...current, message].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.id - b.id));
        }
      }

      if (confirmTimer) window.clearTimeout(confirmTimer);
      confirmTimer = window.setTimeout(() => {
        void loadStatusAndConversations({ silent: true });
        if (selectedPhoneRef.current === phone) {
          void loadThread(phone, { silent: true });
          void loadAssignment(phone);
        }
      }, 400);
    };
    const handleReconnect = () => {
      void loadStatusAndConversations({ silent: true });
      if (selectedPhoneRef.current) void loadThread(selectedPhoneRef.current, { silent: true });
    };
    socket.on('notificationCreated', handleNotification);
    socket.on('connect', handleReconnect);
    return () => {
      socket.off('notificationCreated', handleNotification);
      socket.off('connect', handleReconnect);
      if (confirmTimer) window.clearTimeout(confirmTimer);
    };
  }, [loadStatusAndConversations, loadThread, loadAssignment]);

  const selectConversation = (phone: string) => {
    setSelectedPhone(phone);
    setNewChatOpen(false);
    setSuccess(null);
    setComposer("");
  };

  const startNewChat = () => {
    const phone = newPhone.replace(/\D/g, "");
    if (phone.length < 10) {
      setError("Informe o número com DDI (ex.: 5511999999999).");
      return;
    }
    setError(null);
    setSelectedPhone(phone);
    setNewChatOpen(false);
    setNewPhone("");
    setConversations((prev) => {
      if (prev.some((c) => c.contact_phone === phone)) return prev;
      return [
        {
          contact_phone: phone,
          contact_name: null,
          last_body: null,
          last_direction: null,
          last_message_at: new Date().toISOString(),
          message_count: 0,
          service_id: null,
          service_title: null,
          attendance_status: null,
          assigned_user_id: null,
          assigned_user_name: null,
          assigned_at: null,
          registered_ticket_id: null,
        },
        ...prev,
      ];
    });
  };

  const handleClaimAttendance = async () => {
    if (!canManage || !selectedPhone || selectedAssignment || !isSelectedAttendanceActive) return;
    setClaiming(true);
    setError(null);
    setSuccess(null);
    try {
      const details = await api.post<WhatsAppAssignmentDetails>(
        `/whatsapp/conversations/${encodeURIComponent(selectedPhone)}/claim`,
        {},
      );
      setAssignmentDetails(details);
      setSuccess("O atendimento agora est\u00e1 sob sua responsabilidade.");
      await loadStatusAndConversations({ silent: true });
    } catch (err: any) {
      setError(err?.message || "N\u00e3o foi poss\u00edvel iniciar o atendimento.");
      await Promise.all([
        loadAssignment(selectedPhone),
        loadStatusAndConversations({ silent: true }),
      ]);
    } finally {
      setClaiming(false);
    }
  };

  const openTransfer = async () => {
    setTransferOpen(true); setTargetUserId(''); setError(null);
    try {
      const members = await api.get<TeamMember[]>('/users/team');
      setTeam(members.filter((member) => member.perfil !== 'cliente' && member.id !== selectedAssignment?.user_id));
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar os atendentes.');
    }
  };

  const handleTransfer = async () => {
    if (!selectedPhone || !targetUserId) return;
    setTransferring(true); setError(null); setSuccess(null);
    try {
      const details = await api.post<WhatsAppAssignmentDetails>(
        `/whatsapp/conversations/${encodeURIComponent(selectedPhone)}/transfer`,
        { userId: Number(targetUserId) },
      );
      setAssignmentDetails(details); setTransferOpen(false);
      setSuccess(`Atendimento transferido para ${details.current?.user_name || 'o novo responsável'}.`);
      await loadStatusAndConversations({ silent: true });
    } catch (err: any) {
      setError(err?.message || 'Não foi possível transferir o atendimento.');
    } finally { setTransferring(false); }
  };

  const handleFinish = async () => {
    if (!selectedPhone || !isCurrentUserResponsible) return;
    setFinishing(true); setError(null); setSuccess(null);
    try {
      await api.post(`/whatsapp/conversations/${encodeURIComponent(selectedPhone)}/finish`, {});
      setFinishConfirmOpen(false);
      setAssignmentDetails({ current: null, history: assignmentDetails?.history || [] });
      setSuccess('Atendimento encerrado. Você pode registrar esta conversa como ticket.');
      await loadStatusAndConversations({ silent: true });
    } catch (err: any) {
      setError(err?.message || 'Não foi possível encerrar o atendimento.');
    } finally { setFinishing(false); }
  };

  const handleRegisterTicket = async () => {
    if (!selectedPhone) return;
    setRegisteringTicket(true); setError(null); setSuccess(null);
    try {
      const result = await api.post<{ id: number; existing: boolean }>(
        `/whatsapp/conversations/${encodeURIComponent(selectedPhone)}/ticket`, {},
      );
      setConversations((current) => current.map((conversation) => conversation.contact_phone === selectedPhone
        ? { ...conversation, registered_ticket_id: result.id }
        : conversation));
      setSuccess(result.existing ? `Esta conversa já está no ticket #${result.id}.` : `Ticket #${result.id} criado com a conversa completa.`);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível registrar a conversa como ticket.');
    } finally { setRegisteringTicket(false); }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || !selectedPhone || !composer.trim() || !isCurrentUserResponsible) return;
    setSending(true);
    setError(null);
    setSuccess(null);
    const text = composer.trim();
    try {
      await api.post("/whatsapp/messages", { to: selectedPhone, text });
      setComposer("");
      setSuccess("Mensagem enviada.");
      await Promise.all([
        loadThread(selectedPhone, { silent: true }),
        loadAssignment(selectedPhone),
        loadStatusAndConversations({ silent: true }),
      ]);
    } catch (err: any) {
      setError(err?.message || "Falha ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  };

  const timelineItems = useMemo(() => {
    const messages = thread.map((message) => ({
      kind: "message" as const,
      date: message.created_at,
      id: `message-${message.id}`,
      message,
    }));
    const assignments = (assignmentDetails?.history || []).map((assignment, index) => ({
      kind: "assignment" as const,
      date: assignment.assigned_at,
      id: `assignment-${assignment.id}`,
      assignment,
      firstAssignment: index === 0,
    }));
    return [...messages, ...assignments].sort((a, b) => {
      const byDate = new Date(a.date).getTime() - new Date(b.date).getTime();
      return byDate || a.id.localeCompare(b.id);
    });
  }, [thread, assignmentDetails?.history]);

  const headerTitle = selectedConversation?.contact_name
    ? selectedConversation.contact_name
    : selectedPhone
      ? formatPhoneLabel(selectedPhone)
      : "Inbox WhatsApp";

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <PageShell
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadStatusAndConversations()}
              disabled={loading}
            >
              <RefreshCw size={14} className={cn(loading && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        }
        className="h-full"
        flush
        contentClassName="flex h-full min-h-0 flex-col overflow-hidden p-0"
      >
        {error && (
          <div className="mx-3 mt-2 flex shrink-0 items-start gap-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 sm:mx-4">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mx-3 mt-2 shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800 sm:mx-4">
            {success}
          </div>
        )}

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Conversation list */}
          <aside
            className={cn(
              "flex w-full shrink-0 flex-col border-r border-slate-200 bg-white md:w-[320px] lg:w-[360px]",
              selectedPhone ? "hidden md:flex" : "flex",
            )}
          >
            <div className="shrink-0 space-y-3 border-b border-slate-100 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <MessageCircle size={16} className="text-emerald-600" />
                  Conversas
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    {conversations.length}
                  </span>
                </div>
                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewChatOpen((v) => !v)}
                    disabled={!status?.configured}
                  >
                    <Plus size={14} />
                    Nova
                  </Button>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Pastas
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <FolderChip
                    active={activeFolder === "all"}
                    icon={<FolderOpen size={12} />}
                    label="Todas"
                    count={conversations.length}
                    onClick={() => setActiveFolder("all")}
                  />
                  {serviceFolders.map((folder) => (
                    <FolderChip
                      key={folder.id}
                      active={activeFolder === folder.id}
                      icon={<Folder size={12} />}
                      label={folder.title}
                      badge={folder.id}
                      count={folder.count}
                      onClick={() => setActiveFolder(folder.id)}
                    />
                  ))}
                  <FolderChip
                    active={activeFolder === "none"}
                    icon={<Folder size={12} />}
                    label="Sem serviço"
                    count={withoutServiceCount}
                    onClick={() => setActiveFolder("none")}
                  />
                </div>
              </div>

              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar nome ou número…"
                  className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-800 outline-none ring-blue-500/30 placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-2"
                />
              </div>

              {newChatOpen && canManage && (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Número com DDI
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="5511999999999"
                      className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          startNewChat();
                        }
                      }}
                    />
                    <Button size="sm" onClick={startNewChat}>
                      Abrir
                    </Button>
                  </div>
                </div>
              )}

              {!status?.configured && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  disabled={!onOpenSettings}
                  className="flex w-full items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-left text-xs text-amber-900"
                >
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  Integração incompleta. Acesse Configurações → WhatsApp.
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="px-4 py-10 text-center text-sm text-slate-500">Carregando…</div>
              ) : filteredConversations.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                    <Folder size={20} />
                  </div>
                  <p className="text-sm font-medium text-slate-800">
                    {activeFolder === "all" ? "Nenhuma conversa ainda" : "Pasta vazia"}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    {activeFolder === "all"
                      ? "Configure o webhook e peça para alguém enviar uma mensagem ao número registrado — ou inicie um chat novo."
                      : "Nenhum cliente nesta pasta no momento."}
                  </p>
                </div>
              ) : (
                <ul>
                  {filteredConversations.map((conv) => {
                    const active = conv.contact_phone === selectedPhone;
                    return (
                      <li key={conv.contact_phone}>
                        <button
                          type="button"
                          onClick={() => selectConversation(conv.contact_phone)}
                          className={cn(
                            "flex w-full gap-3 border-b border-slate-100 px-3 py-3 text-left transition-colors",
                            active ? "bg-emerald-50/80" : "hover:bg-slate-50",
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                              active
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-200 text-slate-700",
                            )}
                          >
                            {initials(conv.contact_name, conv.contact_phone)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <span className="truncate text-sm font-semibold text-slate-900">
                                  {conv.contact_name || formatPhoneLabel(conv.contact_phone)}
                                </span>
                                {hasActiveService(conv) ? (
                                  <span
                                    title={conv.service_title || conv.service_id}
                                    className="shrink-0 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white"
                                  >
                                    {conv.service_id}
                                  </span>
                                ) : null}
                              </div>
                              <span className="shrink-0 text-[11px] text-slate-400">
                                {formatTime(conv.last_message_at)}
                              </span>
                            </div>
                            {conv.contact_name && (
                              <p className="truncate text-[11px] text-slate-400">
                                {formatPhoneLabel(conv.contact_phone)}
                              </p>
                            )}
                            {hasActiveService(conv) && conv.service_title ? (
                              <p className="mt-0.5 truncate text-[11px] font-medium text-emerald-700/80">
                                {conv.service_title}
                              </p>
                            ) : null}
                            {hasActiveService(conv) && conv.assigned_user_name ? (
                              <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-medium text-blue-700">
                                <UserRoundCheck size={11} className="shrink-0" />
                                <span className="truncate">Com {conv.assigned_user_name}</span>
                              </p>
                            ) : hasActiveService(conv) ? (
                              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-amber-700">
                                <Clock3 size={11} className="shrink-0" />
                                {"Aguardando respons\u00e1vel"}
                              </p>
                            ) : null}
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {conv.last_direction === "outbound" ? "Você: " : ""}
                              {conv.last_body || "Sem mensagens"}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          {/* Thread */}
          <section
            className={cn(
              "min-w-0 flex-1 flex-col bg-[#f0f2f5]",
              selectedPhone ? "flex" : "hidden md:flex",
            )}
          >
            {!selectedPhone ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                  <MessageCircle size={28} className="text-emerald-600" />
                </div>
                <h2 className="text-base font-semibold text-slate-900">Selecione uma conversa</h2>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  As mensagens recebidas pelo webhook aparecem à esquerda. Clique para ler e
                  responder.
                </p>
              </div>
            ) : (
              <>
                <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-4">
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 md:hidden"
                    onClick={() => setSelectedPhone(null)}
                    aria-label="Voltar"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
                    {initials(selectedConversation?.contact_name || null, selectedPhone)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-slate-900">{headerTitle}</p>
                      {hasActiveService(selectedConversation) ? (
                        <span
                          title={selectedConversation?.service_title || selectedConversation?.service_id || ""}
                          className="shrink-0 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white"
                        >
                          {selectedConversation?.service_id}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-slate-500">
                      {hasActiveService(selectedConversation) && selectedConversation?.service_title
                        ? `${selectedConversation.service_title} · `
                        : ""}
                      {formatPhoneLabel(selectedPhone)}
                      {selectedConversation?.message_count
                        ? ` · ${selectedConversation.message_count} msgs`
                        : ""}
                    </p>
                  </div>
                  {selectedAssignment ? (
                    <div
                      className="hidden shrink-0 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 sm:flex"
                      title={`Respons\u00e1vel desde ${formatMessageTime(selectedAssignment.assigned_at)}`}
                    >
                      <UserRoundCheck size={16} className="text-blue-700" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                          {"Respons\u00e1vel"}
                        </p>
                        <p className="max-w-40 truncate text-xs font-semibold text-blue-950">
                          {selectedAssignment.user_name}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </header>

                {isSelectedAttendanceActive ? (
                <div
                  className={cn(
                    "flex shrink-0 flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                    selectedAssignment
                      ? "border-blue-100 bg-blue-50/70"
                      : "border-amber-200 bg-amber-50",
                  )}
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                        selectedAssignment
                          ? "bg-blue-100 text-blue-700"
                          : "bg-amber-100 text-amber-700",
                      )}
                    >
                      {selectedAssignment ? <UserRoundCheck size={15} /> : <Clock3 size={15} />}
                    </div>
                    <div className="min-w-0">
                      <p className={cn(
                        "text-xs font-semibold",
                        selectedAssignment ? "text-blue-950" : "text-amber-950",
                      )}>
                        {selectedAssignment
                          ? `Atendimento conduzido por ${selectedAssignment.user_name}`
                          : "Atendimento dispon\u00edvel para in\u00edcio"}
                      </p>
                      <p className={cn(
                        "mt-0.5 text-[11px] leading-relaxed",
                        selectedAssignment ? "text-blue-700" : "text-amber-800",
                      )}>
                        {selectedAssignment
                          ? `Responsabilidade registrada em ${formatMessageTime(selectedAssignment.assigned_at)}.`
                          : "Nenhum atendente est\u00e1 vinculado a esta conversa no momento."}
                      </p>
                    </div>
                  </div>
                  {!selectedAssignment && canManage ? (
                    <Button
                      type="button"
                      size="sm"
                      loading={claiming}
                      onClick={handleClaimAttendance}
                      className="shrink-0"
                    >
                      <Hand size={14} />
                      Assumir atendimento
                    </Button>
                  ) : selectedAssignment && canManage && isCurrentUserResponsible ? (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={openTransfer}><ArrowRightLeft size={14} />Transferir</Button>
                      <Button type="button" size="sm" variant="outline" loading={finishing} onClick={() => setFinishConfirmOpen(true)} className="border-rose-200 text-rose-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800"><CircleStop size={14} />Encerrar</Button>
                    </div>
                  ) : null}
                </div>
                ) : null}

                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
                  {threadLoading ? (
                    <div className="py-16 text-center text-sm text-slate-500">Carregando conversa…</div>
                  ) : timelineItems.length === 0 ? (
                    <div className="py-16 text-center text-sm text-slate-500">
                      Nenhuma mensagem nesta conversa. Envie a primeira abaixo.
                    </div>
                  ) : (
                    <div className="mx-auto flex max-w-3xl flex-col gap-2">
                      {timelineItems.map((item) => {
                        if (item.kind === "assignment") {
                          return (
                            <div key={item.id} className="my-2 flex justify-center">
                              <div className="flex max-w-[92%] items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] text-blue-800 shadow-sm">
                                <UserRoundCheck size={13} className="shrink-0" />
                                <span>
                                  <strong>{item.assignment.user_name}</strong> {item.firstAssignment ? 'iniciou o atendimento' : 'assumiu a responsabilidade'} em{" "}
                                  {formatMessageTime(item.assignment.assigned_at)}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        const msg = item.message;
                        const outbound = msg.direction === "outbound";
                        return (
                          <div
                            key={item.id}
                            className={cn("flex", outbound ? "justify-end" : "justify-start")}
                          >
                            <div
                              className={cn(
                                "max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm sm:max-w-[70%]",
                                outbound
                                  ? "rounded-br-sm bg-[#d9fdd3] text-slate-900"
                                  : "rounded-bl-sm bg-white text-slate-900",
                              )}
                            >
                              <p className="whitespace-pre-wrap break-words leading-relaxed">
                                {msg.body || `[${msg.message_type}]`}
                              </p>
                              <div
                                className={cn(
                                  "mt-1 flex items-center justify-end gap-1.5 text-[10px]",
                                  outbound ? "text-emerald-800/70" : "text-slate-400",
                                )}
                              >
                                <span>{formatMessageTime(msg.created_at)}</span>
                                {outbound && msg.status && (
                                  <span className="capitalize">{msg.status}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={bottomRef} />
                    </div>
                  )}
                </div>

                {canManage && isSelectedAttendanceActive ? (
                  <form
                    onSubmit={handleSend}
                    className="shrink-0 border-t border-slate-200 bg-white px-3 py-3 sm:px-4"
                  >
                    {success && (
                      <p className="mb-2 flex items-center gap-1.5 text-xs text-emerald-700">
                        <Check size={12} />
                        {success}
                      </p>
                    )}
                    {!isCurrentUserResponsible ? (
                      <p className="mx-auto mb-2 max-w-3xl text-xs font-medium text-slate-500">
                        {selectedAssignment
                          ? `Somente ${selectedAssignment.user_name}, respons\u00e1vel por esta conversa, pode responder.`
                          : "Inicie o atendimento para liberar o envio de mensagens."}
                      </p>
                    ) : (
                      <p className="mx-auto mb-2 max-w-3xl text-[11px] text-emerald-700">
                        {"Sua identifica\u00e7\u00e3o ser\u00e1 inclu\u00edda automaticamente na mensagem."}
                      </p>
                    )}
                    <div className="mx-auto flex max-w-3xl items-end gap-2">
                      <textarea
                        value={composer}
                        onChange={(e) => setComposer(e.target.value)}
                        rows={1}
                        placeholder={
                          status?.configured
                            ? "Digite uma mensagem…"
                            : "Configure a integração para enviar"
                        }
                        disabled={!status?.configured || sending || !isCurrentUserResponsible}
                        className="max-h-32 min-h-[42px] flex-1 resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void handleSend(e);
                          }
                        }}
                      />
                      <Button
                        type="submit"
                        loading={sending}
                        disabled={!status?.configured || !composer.trim() || !isCurrentUserResponsible}
                      >
                        <Send size={14} />
                        Enviar
                      </Button>
                    </div>
                    <p className="mx-auto mt-2 max-w-3xl text-[11px] text-slate-400">
                      Enter envia · Shift+Enter quebra linha · Fora da janela de 24h a Meta exige
                      template aprovado.
                    </p>
                  </form>
                ) : !canManage ? (
                  <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 text-center text-xs text-slate-500">
                    Você pode visualizar o inbox, mas precisa da permissão{" "}
                    <span className="font-medium">integracoes.whatsapp.gerenciar</span> para
                    responder.
                  </div>
                ) : selectedConversation?.attendance_status === 'idle' ? (
                  <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
                    <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-2.5 text-left"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-200 text-slate-600"><CircleStop size={15} /></span><div><p className="text-xs font-semibold text-slate-900">Atendimento encerrado</p><p className="mt-0.5 text-[11px] text-slate-500">Registre a conversa nos chamados se ela precisar de acompanhamento formal.</p></div></div>
                      {selectedConversation?.registered_ticket_id ? <Button type="button" size="sm" variant="outline" onClick={() => onOpenTicket?.(selectedConversation.registered_ticket_id!)}><ExternalLink size={14} />Abrir ticket #{selectedConversation.registered_ticket_id}</Button> : canCreateTicket ? <Button type="button" size="sm" loading={registeringTicket} onClick={handleRegisterTicket}><TicketCheck size={14} />Registrar como ticket</Button> : null}
                    </div>
                  </div>
                ) : (
                  <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs text-slate-500">Aguardando o cliente selecionar um serviço para abrir o atendimento.</div>
                )}
              </>
            )}
          </section>
        </div>
      </PageShell>
      <Modal isOpen={transferOpen} onClose={() => setTransferOpen(false)} title="Transferir responsável" size="sm">
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800"><strong className="block text-blue-950">Atendimento de {headerTitle}</strong>O novo atendente passa a responder imediatamente e a transferência fica registrada na linha do tempo.</div>
          <label className="block space-y-1.5 text-xs font-semibold text-slate-700">Novo responsável<Select value={targetUserId} onChange={setTargetUserId} options={[{ value: '', label: 'Selecione um atendente' }, ...team.map((member) => ({ value: String(member.id), label: member.cargo ? `${member.nome} · ${member.cargo}` : member.nome }))]} /></label>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="outline" onClick={() => setTransferOpen(false)}>Cancelar</Button><Button disabled={!targetUserId} loading={transferring} onClick={handleTransfer}><ArrowRightLeft size={14} />Transferir atendimento</Button></div>
        </div>
      </Modal>
      <ConfirmDialog isOpen={finishConfirmOpen} onClose={() => setFinishConfirmOpen(false)} onConfirm={handleFinish} title="Encerrar atendimento?" description="A conversa deixará a fila ativa. Depois do encerramento, você poderá registrá-la como um ticket real nos chamados do sistema." confirmLabel="Encerrar atendimento" variant="danger" />
    </div>
  );
};

function FolderChip({
  active,
  icon,
  label,
  badge,
  count,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={badge ? `${label} (${badge})` : label}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-left text-[11px] transition-colors",
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
      )}
    >
      <span className={cn("shrink-0", active ? "text-emerald-600" : "text-slate-400")}>{icon}</span>
      <span className="max-w-[7.5rem] truncate font-medium">{label}</span>
      {badge ? (
        <span
          className={cn(
            "shrink-0 rounded px-1 py-px text-[9px] font-bold tracking-wide",
            active ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600",
          )}
        >
          {badge}
        </span>
      ) : null}
      <span className="shrink-0 tabular-nums text-[10px] text-slate-400">{count}</span>
    </button>
  );
}
