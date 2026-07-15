import React, { useEffect } from "react";
import {
  LayoutDashboard,
  Ticket,
  BarChart3,
  Users,
  Building2,
  Shield,
  UserCircle,
  Settings,
  LogOut,
  X,
  BookOpen,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
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
  isCollapsed?: boolean;
  onClose: () => void;
  onToggleCollapse?: () => void;
  onLogout: () => void;
  onNavigate: (link: string) => void;
}

export const Sidebar = ({
  currentUser,
  activeTab,
  setActiveTab,
  isOpen,
  isCollapsed = false,
  onClose,
  onToggleCollapse,
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

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
        {
          id: "companies",
          icon: Building2,
          label: "Clientes e Empresas",
          access: canAccessAppScreen(currentUser, "companies"),
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
      {/* Overlay */}
      {isOpen && (
        <div
          className="absolute inset-0 z-40 bg-slate-950/40 backdrop-blur-[1px] transition-opacity duration-300 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        role={isOpen ? "dialog" : "navigation"}
        aria-modal={isOpen ? "true" : undefined}
        aria-label="Menu principal"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[320px] flex-col border-r border-slate-200/80 bg-white shadow-2xl shadow-slate-900/20 transition-[width,transform] duration-300 ease-out will-change-transform",
          "lg:relative lg:inset-auto lg:z-20 lg:h-full lg:max-w-none lg:translate-x-0 lg:shadow-none",
          isCollapsed ? "lg:w-[88px]" : "lg:w-[282px]",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div
          className={cn(
            "flex h-14 shrink-0 items-center justify-between border-b border-slate-200/80 px-4",
            isCollapsed && "lg:px-3",
          )}
        >
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 overflow-hidden",
              isCollapsed && "lg:gap-0",
            )}
          >
            <AppLogo size={24} />
            <span
              className={cn(
                "max-w-[150px] overflow-hidden whitespace-nowrap text-[14px] font-semibold tracking-tight text-slate-950 transition-[max-width,opacity] duration-200 ease-out",
                isCollapsed && "lg:pointer-events-none lg:max-w-0 lg:opacity-0",
              )}
            >
              Gestifique
            </span>
          </div>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
              title={isCollapsed ? "Expandir menu" : "Recolher menu"}
              className="hidden shrink-0 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:inline-flex"
            >
              {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          )}
          <div className="flex items-center gap-1 lg:hidden">
            <button
              onClick={onClose}
              aria-label="Fechar menu"
              className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 lg:hidden"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div
          className={cn(
            "flex-1 space-y-5 overflow-y-auto px-3 py-4 custom-scrollbar",
            isCollapsed && "lg:px-2",
          )}
        >
          {sections.map((section) => {
            const accessibleItems = section.items.filter((i) => i.access);
            if (accessibleItems.length === 0) return null;

            return (
              <div key={section.title} className="space-y-1">
                <h3
                  className={cn(
                    "mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 transition-opacity duration-200",
                    isCollapsed && "lg:pointer-events-none lg:h-2 lg:overflow-hidden lg:px-0 lg:text-[0px] lg:opacity-0",
                  )}
                >
                  {section.title}
                </h3>
                <div className="space-y-0.5">
                  {accessibleItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleNav(item.id)}
                      title={isCollapsed ? item.label : undefined}
                      aria-label={item.label}
                      className={cn(
                        "group flex h-9 w-full items-center gap-2.5 rounded-md px-3 text-[13px] font-semibold transition-colors duration-150",
                        isCollapsed && "lg:justify-center lg:gap-0 lg:px-0",
                        activeTab === item.id
                          ? "border border-blue-200 bg-blue-50 text-blue-800 shadow-sm shadow-blue-600/5"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                      )}
                    >
                      <item.icon
                        size={16}
                        className={cn(
                          "transition-colors shrink-0",
                          activeTab === item.id
                            ? "text-blue-600"
                            : "text-slate-400 group-hover:text-slate-600",
                        )}
                        strokeWidth={activeTab === item.id ? 2.5 : 2}
                      />
                      <span
                        className={cn(
                          "max-w-[190px] truncate whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out",
                          isCollapsed && "lg:pointer-events-none lg:max-w-0 lg:opacity-0",
                        )}
                      >
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div
          className={cn(
            "shrink-0 space-y-2 border-t border-slate-200/80 bg-white p-3",
            isCollapsed && "lg:px-2",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50/70 px-2.5 py-2 transition-colors hover:bg-white",
              isCollapsed && "lg:flex-col lg:justify-center lg:px-1.5",
            )}
          >
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
            <div
              className={cn(
                "min-w-0 flex-1 transition-[max-width,opacity] duration-200 ease-out",
                isCollapsed && "lg:pointer-events-none lg:max-w-0 lg:overflow-hidden lg:opacity-0",
              )}
            >
              <div className="text-[13px] font-semibold text-slate-900 truncate tracking-tight">
                {currentUser.nome}
              </div>
              <div className="text-[11px] font-medium text-slate-500 truncate">
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
            title={isCollapsed ? "Sair" : undefined}
            aria-label="Sair"
            className={cn(
              "flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700",
              isCollapsed && "lg:justify-center lg:gap-0 lg:px-0",
            )}
          >
            <LogOut size={16} />
            <span
              className={cn(
                "max-w-[60px] overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out",
                isCollapsed && "lg:pointer-events-none lg:max-w-0 lg:opacity-0",
              )}
            >
              Sair
            </span>
          </button>

          <div
            className={cn(
              "flex items-center justify-center gap-3 pt-1 text-[10px] font-semibold text-slate-400",
              isCollapsed && "lg:hidden",
            )}
          >
            <a
              href="/politica-de-privacidade"
              target="_blank"
              rel="noreferrer"
              className="hover:text-blue-600 transition-colors"
            >
              Privacidade
            </a>
            <span className="text-slate-300">•</span>
            <a
              href="/termos-de-uso"
              target="_blank"
              rel="noreferrer"
              className="hover:text-blue-600 transition-colors"
            >
              Termos
            </a>
          </div>
        </div>
      </aside>
    </>
  );
};
