import React, { useEffect } from "react";
import {
  LayoutDashboard,
  Ticket,
  BarChart3,
  Users,
  Shield,
  UserCircle,
  Settings,
  LogOut,
  X,
  BookOpen,
  MessageCircle,
} from "lucide-react";
import { User } from "../../types";
import { cn } from "../../lib/utils";
import { AppLogo } from "../ui/Logo";
import { NotificationsDropdown } from "../ui/NotificationsDropdown";
import { canAccessAppScreen } from "../../lib/permissions";

interface SidebarProps {
  currentUser: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  onNavigate: (link: string) => void;
}

export const Sidebar = ({
  currentUser,
  activeTab,
  setActiveTab,
  isOpen,
  onClose,
  onLogout,
  onNavigate,
}: SidebarProps) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const sections = [
    {
      title: "Operação",
      items: [
        {
          id: "dashboard",
          icon: LayoutDashboard,
          label: "Dashboard",
          access: canAccessAppScreen(currentUser, "dashboard"),
        },
        {
          id: "tickets",
          icon: Ticket,
          label: "Chamados",
          access: canAccessAppScreen(currentUser, "tickets"),
        },
        {
          id: "whatsapp",
          icon: MessageCircle,
          label: "WhatsApp",
          access: canAccessAppScreen(currentUser, "whatsapp"),
        },
        {
          id: "knowledge",
          icon: BookOpen,
          label: "Base de Conhecimento",
          access: canAccessAppScreen(currentUser, "knowledge"),
        },
      ],
    },
    {
      title: "Gestão",
      items: [
        {
          id: "reports",
          icon: BarChart3,
          label: "Relatórios",
          access: canAccessAppScreen(currentUser, "reports"),
        },
        {
          id: "users",
          icon: Users,
          label: "Usuários e Permissões",
          access: canAccessAppScreen(currentUser, "users"),
        },
      ],
    },
    {
      title: "Sistema",
      items: [
        {
          id: "settings",
          icon: Settings,
          label: "Configurações e SLA",
          access: canAccessAppScreen(currentUser, "settings"),
        },
        {
          id: "logs",
          icon: Shield,
          label: "Auditoria",
          access: canAccessAppScreen(currentUser, "logs"),
        },
      ],
    },
    {
      title: "Conta",
      items: [
        { id: "profile", icon: UserCircle, label: "Meu Perfil", access: true },
      ],
    },
  ];

  const handleNav = (id: string) => {
    setActiveTab(id);
    onClose();
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-md transition-opacity duration-300",
          isOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        role={isOpen ? "dialog" : "navigation"}
        aria-modal={isOpen ? "true" : undefined}
        aria-hidden={!isOpen}
        aria-label="Menu principal"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[320px] flex-col border-r border-slate-200/80 bg-white shadow-2xl shadow-slate-900/20 transition-transform duration-300 ease-out will-change-transform sm:w-[300px] sm:max-w-none",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200/80 px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <AppLogo size={24} />
            <span className="max-w-[150px] overflow-hidden whitespace-nowrap text-[14px] font-semibold tracking-tight text-slate-950">
              Portal Meta
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4 custom-scrollbar">
          {sections.map((section) => {
            const accessibleItems = section.items.filter((i) => i.access);
            if (accessibleItems.length === 0) return null;

            return (
              <div key={section.title} className="space-y-1">
                <h3 className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {section.title}
                </h3>
                <div className="space-y-0.5">
                  {accessibleItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleNav(item.id)}
                      aria-label={item.label}
                      className={cn(
                        "group flex h-9 w-full items-center gap-2.5 rounded-md px-3 text-[13px] font-semibold transition-colors duration-150",
                        activeTab === item.id
                          ? "border border-blue-200 bg-blue-50 text-blue-800 shadow-sm shadow-blue-600/5"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                      )}
                    >
                      <item.icon
                        size={16}
                        className={cn(
                          "shrink-0 transition-colors",
                          activeTab === item.id
                            ? "text-blue-600"
                            : "text-slate-400 group-hover:text-slate-600",
                        )}
                        strokeWidth={activeTab === item.id ? 2.5 : 2}
                      />
                      <span className="max-w-[190px] truncate whitespace-nowrap">
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="shrink-0 space-y-2 border-t border-slate-200/80 bg-white p-3">
          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50/70 px-2.5 py-2 transition-colors hover:bg-white">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white text-xs font-bold text-slate-700 shadow-sm">
              {currentUser.foto ? (
                <img
                  src={currentUser.foto}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                (currentUser.nome || "U").charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold tracking-tight text-slate-900">
                {currentUser.nome}
              </div>
              <div className="truncate text-[11px] font-medium text-slate-500">
                {currentUser.cargo || "Cargo indefinido"}
              </div>
            </div>
            <NotificationsDropdown
              currentUser={currentUser}
              onNavigate={onNavigate}
              compact
            />
          </div>

          <button
            onClick={onLogout}
            aria-label="Sair"
            className="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <LogOut size={16} />
            <span>Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
};
