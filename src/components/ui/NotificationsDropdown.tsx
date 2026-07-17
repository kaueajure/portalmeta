import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Bell, Check, Clock, Inbox, MessageCircle, Ticket as TicketIcon, UserCheck, ArrowRightLeft } from "lucide-react";
import { api } from "../../lib/api";
import { Notification, User } from "../../types";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { cn } from "../../lib/utils";
import { getSocket } from "../../lib/socket";

type UnreadCountResponse =
  | { count: number }
  | { success?: boolean; data?: { count: number } };

type NotificationsListResponse =
  | { items: Notification[]; unread_count: number }
  | {
      success?: boolean;
      data?: { items: Notification[]; unread_count: number };
    };

interface NotificationsDropdownProps {
  currentUser: User;
  onNavigate: (link: string) => void;
  compact?: boolean;
}

export const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({
  currentUser,
  onNavigate,
  compact,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get<UnreadCountResponse>(
        "/notifications/unread-count",
      );
      let count = 0;
      if (res) {
        if ("count" in res) {
          count = res.count;
        } else if (res.success && res.data) {
          count = res.data.count;
        }
      }
      setUnreadCount(count || 0);
    } catch (err) {
      console.error("Erro ao buscar contagem de notificações:", err);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<NotificationsListResponse>(
        "/notifications?limit=20",
      );
      let items: Notification[] = [];
      let unread_count = 0;

      if (res) {
        if ("items" in res) {
          items = res.items;
          unread_count = res.unread_count;
        } else if (res.success && res.data) {
          items = res.data.items;
          unread_count = res.data.unread_count;
        }
      }

      setNotifications(Array.isArray(items) ? items : []);
      setUnreadCount(unread_count || 0);
    } catch (err) {
      console.error("Erro ao buscar notificações:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000); // recuperação caso a conexão realtime falhe

    return () => clearInterval(interval);
  }, [currentUser, fetchUnreadCount]);

  useEffect(() => {
    const socket = getSocket();
    const onCreated = (event: Event) => {
      const notification = (event as CustomEvent<Notification>).detail;
      if (!notification) return;
      setNotifications((current) => [notification, ...current.filter((item) => item.id !== notification.id)].slice(0, 20));
      setUnreadCount((count) => count + 1);
    };
    const onRead = (payload: { id?: number; all?: boolean }) => {
      if (payload.all) {
        setNotifications((items) => items.map((item) => ({ ...item, lida: true })));
        setUnreadCount(0);
      } else if (payload.id) {
        setNotifications((items) => items.map((item) => item.id === payload.id ? { ...item, lida: true } : item));
        void fetchUnreadCount();
      }
    };
    const onReconnect = () => { void fetchUnreadCount(); if (isOpen) void fetchNotifications(); };
    window.addEventListener('portalmeta:notification', onCreated);
    socket.on('notificationsRead', onRead);
    socket.on('connect', onReconnect);
    return () => {
      window.removeEventListener('portalmeta:notification', onCreated);
      socket.off('notificationsRead', onRead);
      socket.off('connect', onReconnect);
    };
  }, [fetchNotifications, fetchUnreadCount, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const updatePanelPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const gap = 8;
    const viewportPadding = 8;
    const width = window.matchMedia("(min-width: 640px)").matches ? 320 : 288;
    const left = Math.min(
      Math.max(compact ? rect.left : rect.right - width, viewportPadding),
      window.innerWidth - width - viewportPadding,
    );

    setPanelStyle(
      compact
        ? {
            left,
            bottom: window.innerHeight - rect.top + gap,
          }
        : {
            left,
            top: rect.bottom + gap,
          },
    );
  }, [compact]);

  useEffect(() => {
    if (!isOpen) return;

    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [isOpen, updatePanelPosition]);

  const toggleDropdown = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      fetchNotifications();
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await api.patch(`/notifications/${id}/read`, {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, lida: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Erro ao marcar como lida:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch("/notifications/read-all", {});
      setNotifications((prev) => prev.map((n) => ({ ...n, lida: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Erro ao marcar todas como lidas:", err);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.lida) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      onNavigate(notification.link);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative z-20 shrink-0 overflow-visible" ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className={cn(
          "relative flex items-center justify-center rounded-lg transition-all focus:outline-none",
          compact
            ? "h-8 w-8 bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
            : "p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50",
        )}
        title="Notificações"
      >
        <Bell size={compact ? 16 : 20} />
      </button>
      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute z-30 flex items-center justify-center rounded-full border-2 border-white bg-red-500 font-bold leading-none text-white shadow-sm",
            compact
              ? "-right-1.5 -top-1.5 h-4 min-w-4 px-0.5 text-[9px]"
              : "right-0 top-0 h-4 min-w-4 px-0.5 text-[10px]",
          )}
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}

      {isOpen && createPortal(
        <div
          ref={panelRef}
          style={panelStyle}
          className={cn(
            "fixed z-[10001] w-72 sm:w-80 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right",
            compact && "origin-bottom-left",
          )}
        >
          <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
              Notificações
              {unreadCount > 0 && (
                <Badge variant="blue" className="px-1.5 py-0 text-[10px]">
                  {unreadCount} novas
                </Badge>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors"
              >
                <Check size={12} />
                Ler tudo
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-6 text-center">
                <div className="inline-block animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full mb-2"></div>
                <p className="text-xs text-slate-500">Carregando...</p>
              </div>
            ) : notifications.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-3 hover:bg-slate-50 cursor-pointer transition-all flex gap-2.5 relative group ${
                      !notification.lida ? "bg-blue-50/30" : ""
                    }`}
                  >
                    {Number(notification.lida) === 0 && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-500 rounded-r-full"></div>
                    )}

                    <div className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                      notification.tipo.toLowerCase().includes('ticket_transfer') ? 'border-violet-200 bg-violet-50 text-violet-700' :
                      notification.tipo.toLowerCase().includes('whatsapp_assigned') ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                      notification.tipo.toLowerCase().includes('whatsapp') ? 'border-teal-200 bg-teal-50 text-teal-700' :
                      'border-blue-200 bg-blue-50 text-blue-700',
                    )}>
                      {notification.tipo.toLowerCase().includes('ticket_transfer') ? <ArrowRightLeft size={15} /> :
                       notification.tipo.toLowerCase().includes('whatsapp_assigned') ? <UserCheck size={15} /> :
                       notification.tipo.toLowerCase().includes('whatsapp') ? <MessageCircle size={15} /> : <TicketIcon size={15} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-0.5">
                        <p
                          className={`text-[13px] truncate pr-2 ${!notification.lida ? "font-semibold text-slate-900" : "font-medium text-slate-700"}`}
                        >
                          {notification.titulo}
                        </p>
                        <div className="flex items-center text-[10px] text-slate-400 whitespace-nowrap mt-0.5">
                          <Clock size={10} className="mr-1" />
                          {formatDistanceToNow(
                            new Date(notification.created_at),
                            { addSuffix: true, locale: ptBR },
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {notification.mensagem}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center">
                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center mx-auto mb-3 border border-slate-100 text-slate-400">
                  <Inbox size={20} />
                </div>
                <p className="text-[13px] text-slate-900 font-semibold">
                  Nenhuma notificação
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Você está em dia com tudo!
                </p>
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-2 bg-slate-50 border-t border-slate-100 text-center">
              <button
                className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                Fechar
              </button>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
};
