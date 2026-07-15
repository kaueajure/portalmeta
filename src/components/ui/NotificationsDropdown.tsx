import React, { useState, useEffect, useCallback, useRef } from "react";
import { Bell, Check, Clock, Inbox, ChevronRight } from "lucide-react";
import { api } from "../../lib/api";
import { Notification, User } from "../../types";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { cn } from "../../lib/utils";

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
        "/notifications?limit=10&unread_only=true",
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
    const interval = setInterval(fetchUnreadCount, 30000); // Polling 30s

    return () => clearInterval(interval);
  }, [currentUser, fetchUnreadCount]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

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
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className={cn(
          "relative flex items-center justify-center rounded-lg transition-all focus:outline-none",
          compact
            ? "w-8 h-8 bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
            : "p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50",
        )}
        title="Notificações"
      >
        <Bell size={compact ? 16 : 20} />
        {unreadCount > 0 && (
          <span
            className={cn(
              "absolute bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white",
              compact
                ? "-top-1 -right-1 w-3.5 h-3.5 text-[8px]"
                : "top-1.5 right-1.5 w-4 h-4",
            )}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute mt-2 w-72 sm:w-80 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right",
            compact ? "bottom-full left-0 mb-2 origin-bottom-left" : "right-0",
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
        </div>
      )}
    </div>
  );
};
