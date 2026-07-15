import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MessageCircle,
  RefreshCw,
  Send,
  Copy,
  Check,
  AlertTriangle,
  ShieldCheck,
  Link2,
  Phone,
  Settings2,
  Search,
  Plus,
  ArrowLeft,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import { PageShell } from "../layout/PageShell";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";
import { User } from "../../types";
import { hasPermission } from "../../lib/permissions";

interface WhatsappPageProps {
  currentUser: User;
}

interface WhatsAppStatus {
  enabled: boolean;
  configured: boolean;
  phoneNumberId: string | null;
  businessAccountId: string | null;
  apiVersion: string;
  hasAccessToken: boolean;
  accessTokenPreview: string | null;
  hasAppSecret: boolean;
  verifyToken: string | null;
  callbackUrl: string;
  displayPhoneNumber: string | null;
}

interface WhatsAppConversation {
  contact_phone: string;
  contact_name: string | null;
  last_body: string | null;
  last_direction: "inbound" | "outbound" | null;
  last_message_at: string;
  message_count: number;
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

const META_CREDENTIALS = [
  {
    env: "ENABLE_WHATSAPP",
    value: "true",
    where:
      "Você define. Coloque true para ligar o módulo no Gestifique.",
  },
  {
    env: "WHATSAPP_PHONE_NUMBER_ID",
    where:
      "Meta → App → WhatsApp → Configuração da API → Número de telefone → campo Phone number ID (não é o número em si).",
  },
  {
    env: "WHATSAPP_BUSINESS_ACCOUNT_ID",
    where:
      "Meta → App → WhatsApp → Configuração da API → WhatsApp Business Account ID.",
  },
  {
    env: "WHATSAPP_ACCESS_TOKEN",
    where:
      "Meta → App → WhatsApp → Configuração da API → Token de acesso temporário (teste) ou token permanente do usuário do sistema.",
  },
  {
    env: "WHATSAPP_VERIFY_TOKEN",
    where:
      "Você inventa (string secreta). Use o mesmo valor no .env e em Meta → Webhook → Verificar token.",
  },
  {
    env: "META_APP_SECRET",
    where:
      "Meta → App → Configurações → Básico → Segredo do app (mostrar).",
  },
  {
    env: "WHATSAPP_DISPLAY_PHONE_NUMBER",
    where:
      "O número exibido (DDI + DDD + número), ex.: 5511999999999. Mesmo número da tela Números de telefone.",
  },
  {
    env: "FRONTEND_URL",
    where:
      "URL pública HTTPS do Gestifique, ex.: https://gestifique.com.br — usada para montar a callback do webhook.",
  },
] as const;

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

export const WhatsappPage = ({ currentUser }: WhatsappPageProps) => {
  const canManage = hasPermission(currentUser, "integracoes.whatsapp.gerenciar");
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [thread, setThread] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [search, setSearch] = useState("");
  const [composer, setComposer] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.contact_phone === selectedPhone) || null,
    [conversations, selectedPhone],
  );

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const hay = `${c.contact_name || ""} ${c.contact_phone} ${c.last_body || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [conversations, search]);

  const loadStatusAndConversations = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const [statusData, conversationData] = await Promise.all([
        api.get<WhatsAppStatus>("/whatsapp/status"),
        api.get<WhatsAppConversation[]>("/whatsapp/conversations?limit=100"),
      ]);
      setStatus(statusData);
      setConversations(conversationData);
      if (!statusData.configured) setShowSetup(true);
    } catch (err: any) {
      setError(err?.message || "Não foi possível carregar o WhatsApp.");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  const loadThread = useCallback(async (phone: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setThreadLoading(true);
    try {
      const messages = await api.get<WhatsAppMessage[]>(
        `/whatsapp/conversations/${encodeURIComponent(phone)}/messages?limit=300`,
      );
      setThread(messages);
    } catch (err: any) {
      setError(err?.message || "Não foi possível carregar a conversa.");
    } finally {
      if (!opts?.silent) setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatusAndConversations();
  }, [loadStatusAndConversations]);

  useEffect(() => {
    if (!selectedPhone) {
      setThread([]);
      return;
    }
    loadThread(selectedPhone);
  }, [selectedPhone, loadThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread, selectedPhone]);

  useEffect(() => {
    pollRef.current = window.setInterval(() => {
      loadStatusAndConversations({ silent: true });
      if (selectedPhone) loadThread(selectedPhone, { silent: true });
    }, 12_000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [loadStatusAndConversations, loadThread, selectedPhone]);

  const copyValue = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), 1600);
    } catch {
      setError("Não foi possível copiar para a área de transferência.");
    }
  };

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
        },
        ...prev,
      ];
    });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || !selectedPhone || !composer.trim()) return;
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
        loadStatusAndConversations({ silent: true }),
      ]);
    } catch (err: any) {
      setError(err?.message || "Falha ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  };

  const headerTitle = selectedConversation?.contact_name
    ? selectedConversation.contact_name
    : selectedPhone
      ? formatPhoneLabel(selectedPhone)
      : "Inbox WhatsApp";

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <PageShell
        title="WhatsApp"
        subtitle="Inbox de conversas — receba pelo webhook e responda pelo Gestifique."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSetup((v) => !v)}>
              <Settings2 size={14} />
              {showSetup ? "Fechar setup" : "Configuração"}
            </Button>
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
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-5">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {showSetup && (
          <SetupPanel
            status={status}
            copiedField={copiedField}
            onCopy={copyValue}
            onClose={() => setShowSetup(false)}
          />
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
                  onClick={() => setShowSetup(true)}
                  className="flex w-full items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-left text-xs text-amber-900"
                >
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  Integração incompleta. Abra a configuração e preencha o .env.
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="px-4 py-10 text-center text-sm text-slate-500">Carregando…</div>
              ) : filteredConversations.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                    <Phone size={20} />
                  </div>
                  <p className="text-sm font-medium text-slate-800">Nenhuma conversa ainda</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    Configure o webhook e peça para alguém enviar uma mensagem ao número
                    registrado — ou inicie um chat novo.
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
                              <span className="truncate text-sm font-semibold text-slate-900">
                                {conv.contact_name || formatPhoneLabel(conv.contact_phone)}
                              </span>
                              <span className="shrink-0 text-[11px] text-slate-400">
                                {formatTime(conv.last_message_at)}
                              </span>
                            </div>
                            {conv.contact_name && (
                              <p className="truncate text-[11px] text-slate-400">
                                {formatPhoneLabel(conv.contact_phone)}
                              </p>
                            )}
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
                    <p className="truncate text-sm font-semibold text-slate-900">{headerTitle}</p>
                    <p className="truncate text-xs text-slate-500">
                      {formatPhoneLabel(selectedPhone)}
                      {selectedConversation?.message_count
                        ? ` · ${selectedConversation.message_count} msgs`
                        : ""}
                    </p>
                  </div>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
                  {threadLoading ? (
                    <div className="py-16 text-center text-sm text-slate-500">Carregando conversa…</div>
                  ) : thread.length === 0 ? (
                    <div className="py-16 text-center text-sm text-slate-500">
                      Nenhuma mensagem nesta conversa. Envie a primeira abaixo.
                    </div>
                  ) : (
                    <div className="mx-auto flex max-w-3xl flex-col gap-2">
                      {thread.map((msg) => {
                        const outbound = msg.direction === "outbound";
                        return (
                          <div
                            key={msg.id}
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

                {canManage ? (
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
                        disabled={!status?.configured || sending}
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
                        disabled={!status?.configured || !composer.trim()}
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
                ) : (
                  <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 text-center text-xs text-slate-500">
                    Você pode visualizar o inbox, mas precisa da permissão{" "}
                    <span className="font-medium">integracoes.whatsapp.gerenciar</span> para
                    responder.
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </PageShell>
    </div>
  );
};

function SetupPanel({
  status,
  copiedField,
  onCopy,
  onClose,
}: {
  status: WhatsAppStatus | null;
  copiedField: string | null;
  onCopy: (field: string, value: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-blue-600" />
            <h2 className="text-sm font-semibold text-slate-900">
              Onde pegar as credenciais na Meta
            </h2>
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
            Cole no arquivo <code className="rounded bg-white px-1 py-0.5 text-[11px]">.env</code>{" "}
            na raiz do projeto, reinicie o servidor e configure o webhook. Aprovação do app sozinha
            não mostra mensagens — o Gestifique precisa receber o webhook.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          Fechar
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-900">Status no Gestifique</h3>
          </div>
          <dl className="space-y-2 text-sm">
            <StatusRow label="Habilitado" value={status?.enabled ? "Sim" : "Não"} ok={!!status?.enabled} />
            <StatusRow
              label="Configurado"
              value={status?.configured ? "Pronto" : "Incompleto"}
              ok={!!status?.configured}
            />
            <StatusRow label="Phone Number ID" value={status?.phoneNumberId || "—"} />
            <StatusRow label="WABA ID" value={status?.businessAccountId || "—"} />
            <StatusRow label="Token" value={status?.accessTokenPreview || "Ausente"} ok={!!status?.hasAccessToken} />
            <StatusRow
              label="App Secret"
              value={status?.hasAppSecret ? "Configurado" : "Não definido"}
              ok={!!status?.hasAppSecret}
            />
          </dl>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <Link2 size={16} className="text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900">Webhook (Meta)</h3>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Meta for Developers → seu app →{" "}
            <span className="font-medium text-slate-700">WhatsApp → Configuração</span> → Webhooks
            → depois assine o campo <span className="font-medium">messages</span>.
          </p>
          <CopyField
            label="URL de callback"
            value={status?.callbackUrl || "https://seu-dominio.com.br/api/whatsapp/webhook"}
            fieldKey="callback"
            copiedField={copiedField}
            onCopy={onCopy}
          />
          <CopyField
            label="Verificar token"
            value={status?.verifyToken || "—"}
            fieldKey="verify"
            copiedField={copiedField}
            onCopy={onCopy}
            className="mt-3"
          />
          <a
            href="https://developers.facebook.com/apps/"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"
          >
            Abrir Meta for Developers
            <ExternalLink size={12} />
          </a>
        </section>
      </div>

      <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-2.5">
          <h3 className="text-sm font-semibold text-slate-900">Variáveis do .env</h3>
        </div>
        <ul className="divide-y divide-slate-100">
          {META_CREDENTIALS.map((item) => (
            <li key={item.env} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,240px)_1fr] sm:gap-4">
              <div>
                <code className="text-xs font-semibold text-emerald-800">{item.env}</code>
                {"value" in item && item.value ? (
                  <p className="mt-0.5 text-[11px] text-slate-400">ex.: {item.value}</p>
                ) : null}
              </div>
              <p className="text-xs leading-relaxed text-slate-600">{item.where}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatusRow({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd
        className={cn(
          "text-right font-medium",
          ok === true && "text-emerald-700",
          ok === false && "text-amber-700",
          ok === undefined && "text-slate-900",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function CopyField({
  label,
  value,
  fieldKey,
  copiedField,
  onCopy,
  className,
}: {
  label: string;
  value: string;
  fieldKey: string;
  copiedField: string | null;
  onCopy: (field: string, value: string) => void;
  className?: string;
}) {
  const copied = copiedField === fieldKey;
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-semibold text-slate-700">{label}</label>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-800">
          {value}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onCopy(fieldKey, value)}
          disabled={!value || value === "—"}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
    </div>
  );
}
