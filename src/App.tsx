import React, { lazy, Suspense, useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sidebar } from "./components/layout/Sidebar";
import { Topbar } from "./components/layout/Topbar";
import { AccessDenied } from "./components/ui/AccessDenied";
import { LoginPage } from "./components/auth/LoginPage";
import { ForgotPasswordPage } from "./components/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./components/auth/ResetPasswordPage";
import { canAccessAppScreen, getFirstAccessibleAppScreen } from "./lib/permissions";
import { User } from "./types";
import { api } from "./lib/api";
import { cn } from "./lib/utils";
import { Loader2 } from "lucide-react";

const DashboardPage = lazy(() =>
  import("./components/pages/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);
const PublicSite = lazy(() =>
  import("./components/public/PublicSite").then((module) => ({
    default: module.PublicSite,
  })),
);
const SatisfactionPage = lazy(() =>
  import("./components/public/SatisfactionPage").then((module) => ({
    default: module.SatisfactionPage,
  })),
);
const PortalAccessPage = lazy(() =>
  import("./components/portal/PortalAccessPage").then((module) => ({
    default: module.PortalAccessPage,
  })),
);
const PortalLayout = lazy(() =>
  import("./components/portal/PortalLayout").then((module) => ({
    default: module.PortalLayout,
  })),
);

const UsersPage = lazy(() =>
  import("./components/pages/UsersPage").then((module) => ({
    default: module.UsersPage,
  })),
);
const CompaniesPage = lazy(() =>
  import("./components/pages/CompaniesPage").then((module) => ({
    default: module.CompaniesPage,
  })),
);
const LogsPage = lazy(() =>
  import("./components/pages/LogsPage").then((module) => ({
    default: module.LogsPage,
  })),
);
const ProfilePage = lazy(() =>
  import("./components/pages/ProfilePage").then((module) => ({
    default: module.ProfilePage,
  })),
);
const SettingsPage = lazy(() =>
  import("./components/pages/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);
const TicketsPage = lazy(() =>
  import("./components/pages/TicketsPage").then((module) => ({
    default: module.TicketsPage,
  })),
);
const ReportsPage = lazy(() =>
  import("./components/pages/ReportsPage").then((module) => ({
    default: module.ReportsPage,
  })),
);
const KnowledgePage = lazy(() =>
  import("./components/pages/KnowledgePage").then((module) => ({
    default: module.KnowledgePage,
  })),
);
const WhatsappPage = lazy(() =>
  import("./components/pages/WhatsappPage").then((module) => ({
    default: module.WhatsappPage,
  })),
);
const TicketDetailsPage = lazy(() =>
  import("./components/pages/TicketDetailsPage").then((module) => ({
    default: module.TicketDetailsPage,
  })),
);
const AITesterPage = lazy(() =>
  import("./components/pages/AITesterPage").then((module) => ({
    default: module.AITesterPage,
  })),
);

type ViewState =
  | "landing"
  | "login"
  | "forgot-password"
  | "reset-password"
  | "dashboard"
  | "portal-access"
  | "portal";
type ActiveTab =
  | "dashboard"
  | "tickets"
  | "whatsapp"
  | "users"
  | "companies"
  | "logs"
  | "profile"
  | "settings"
  | "reports"
  | "knowledge"
  | "ai";

const DASHBOARD_STATE_KEY = "gestifique.dashboardState";

const isActiveTab = (value: string | null): value is ActiveTab =>
  !!value &&
  [
    "dashboard",
    "tickets",
    "whatsapp",
    "users",
    "companies",
    "logs",
    "profile",
    "settings",
    "reports",
    "knowledge",
    "ai",
  ].includes(value);

const loadDashboardState = (): {
  activeTab: ActiveTab;
  selectedTicketId: number | null;
} => {
  try {
    const stored = localStorage.getItem(DASHBOARD_STATE_KEY);
    if (!stored) return { activeTab: "dashboard", selectedTicketId: null };

    const parsed = JSON.parse(stored) as {
      activeTab?: string;
      selectedTicketId?: number | null;
    };
    const storedActiveTab = parsed.activeTab || null;
    const activeTab: ActiveTab = isActiveTab(storedActiveTab)
      ? storedActiveTab
      : "dashboard";
    const selectedTicketId =
      typeof parsed.selectedTicketId === "number" &&
      Number.isFinite(parsed.selectedTicketId)
        ? parsed.selectedTicketId
        : null;

    return {
      activeTab: selectedTicketId ? "tickets" : activeTab,
      selectedTicketId,
    };
  } catch {
    return { activeTab: "dashboard", selectedTicketId: null };
  }
};

const LazyPageFallback = () => (
  <div className="flex h-full min-h-[240px] w-full items-center justify-center rounded-lg border border-slate-200 bg-white">
    <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      Carregando módulo...
    </div>
  </div>
);

export default function App() {
  const getViewFromPath = (pathname: string): ViewState => {
    if (pathname === "/login") return "login";
    if (pathname === "/esqueci-senha") return "forgot-password";
    if (pathname === "/reset-password") return "reset-password";
    if (pathname === "/portal") return "portal-access";
    return "landing";
  };

  const [view, setView] = useState<ViewState>(() =>
    getViewFromPath(window.location.pathname),
  );
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    () => loadDashboardState().activeTab,
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return window.localStorage.getItem("gestifique-sidebar-collapsed") === "true";
  });
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(
    () => loadDashboardState().selectedTicketId,
  );
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [resetEmail, setResetEmail] = useState("");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("gestifique-theme");
    document.documentElement.classList.toggle(
      "theme-dark-beta",
      savedTheme === "dark-beta",
    );
  }, []);

  // CSAT Route Check
  const path = window.location.pathname;
  if (path.startsWith("/csat/")) {
    const token = path.replace("/csat/", "");
    return (
      <Suspense fallback={<LazyPageFallback />}>
        <SatisfactionPage token={token} />
      </Suspense>
    );
  }

  const restorePortalSession = async () => {
    try {
      const profile = await api.get<{
        email: string;
        empresa_id: number;
        nome?: string;
        empresa_nome?: string;
      }>("/portal/me");

      const portalUser: User = {
        id: 0,
        nome: profile.nome || profile.email,
        email: profile.email,
        empresa_id: profile.empresa_id,
        perfil: "cliente",
        administrador: false,
        desenvolvedor: false,
        ativo: true,
        cargo: "",
        telefone: undefined,
        foto: undefined,
        ultimo_login: undefined,
        created_at: new Date().toISOString(),
      };

      setCurrentUser(portalUser);
      setView("portal");
      return true;
    } catch {
      localStorage.removeItem("portal_token");
      return false;
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      // Sync browser history with the app state for public routes
      const path = window.location.pathname;
      const parsedView = getViewFromPath(path);

      // If user is logged in, do not kick them to landing just because of popstate
      // unless specifically intended. We'll handle basic public state syncing here.
      setView((currentView) => {
        // If they are on dashboard/portal, don't break their session on back button
        // They would explicitly logout
        if (currentView === "dashboard" || currentView === "portal") {
          return currentView;
        }
        return parsedView;
      });
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!currentUser || view !== "dashboard") return;

    localStorage.setItem(
      DASHBOARD_STATE_KEY,
      JSON.stringify({ activeTab, selectedTicketId }),
    );
  }, [activeTab, selectedTicketId, currentUser, view]);

  useEffect(() => {
    if (activeTab !== "tickets" && selectedTicketId) {
      setSelectedTicketId(null);
    }
  }, [activeTab, selectedTicketId]);

  useEffect(() => {
    if (!currentUser || view !== "dashboard") return;

    if (
      activeTab === "tickets" &&
      selectedTicketId &&
      !canAccessAppScreen(currentUser, "tickets", { selectedTicketId }) &&
      canAccessAppScreen(currentUser, "tickets")
    ) {
      setSelectedTicketId(null);
      return;
    }

    if (!canAccessAppScreen(currentUser, activeTab, { selectedTicketId })) {
      setActiveTab(getFirstAccessibleAppScreen(currentUser) as ActiveTab);
      setSelectedTicketId(null);
    }
  }, [activeTab, currentUser, selectedTicketId, view]);

  useEffect(() => {
    // Check session on load
    const checkAuth = async () => {
      const pathname = window.location.pathname;

      if (pathname === "/portal") {
        const restored = await restorePortalSession();
        if (restored) {
          setIsBooting(false);
          return;
        }
        setView("portal-access");
        setIsBooting(false);
        return;
      }

      try {
        const user = await api.get<User>("/profile");
        setCurrentUser(user);
        if (user.perfil === "cliente") {
          setView("portal");
        } else {
          setView("dashboard");
        }
      } catch (err) {
        setView(getViewFromPath(window.location.pathname));
      } finally {
        setIsBooting(false);
      }
    };

    checkAuth();

    // Global event listener for unauthorized requests
    const handleUnauthorized = (e: Event) => {
      const customEvent = e as CustomEvent<{ endpoint?: string }>;
      const endpoint = customEvent.detail?.endpoint;

      if (endpoint === "/profile" || endpoint === "/auth/login") {
        return;
      }

      setCurrentUser(null);
      setView("login");
      window.history.pushState({}, "", "/login");
      setAuthError("Sessão expirada. Faça login novamente.");
    };

    const handlePortalUnauthorized = () => {
      setCurrentUser(null);
      setView("portal-access");
      window.history.pushState({}, "", "/portal");
    };

    window.addEventListener(
      "api:unauthorized",
      handleUnauthorized as EventListener,
    );
    window.addEventListener(
      "portal:unauthorized",
      handlePortalUnauthorized as EventListener,
    );
    return () => {
      window.removeEventListener(
        "api:unauthorized",
        handleUnauthorized as EventListener,
      );
      window.removeEventListener(
        "portal:unauthorized",
        handlePortalUnauthorized as EventListener,
      );
    };
  }, []);

  const handleNotificationNavigate = (link: string) => {
    if (link.startsWith("ticket:")) {
      const ticketId = parseInt(link.split(":")[1]);
      if (!isNaN(ticketId)) {
        setSelectedTicketId(ticketId);
        setActiveTab("tickets");
      }
    } else if (link === "tickets") {
      setActiveTab("tickets");
      setSelectedTicketId(null);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email");
    const password = formData.get("password");

    try {
      await api.post("/auth/login", { email, password });
      // Fetch full profile after login to guarantee consistent corporate data
      const profile = await api.get<User>("/profile");
      setCurrentUser(profile);
      if (profile.perfil === "cliente") {
        setView("portal");
      } else {
        setView("dashboard");
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Não foi possível autenticar. Verifique seus dados e tente novamente.";
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout", {});
    } catch (e) {}
    localStorage.removeItem("portal_token");
    localStorage.removeItem(DASHBOARD_STATE_KEY);
    setCurrentUser(null);
    setView("landing");
    window.history.pushState({}, "", "/");
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setAuthLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    try {
      const data = await api.post<{ message: string }>(
        "/auth/forgot-password",
        { email },
      );
      setAuthSuccess(data.message);
      setResetEmail(email);
      setTimeout(() => {
        setView("reset-password");
        window.history.pushState({}, "", "/reset-password");
      }, 2000);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Não foi possível enviar o código agora. Tente novamente em alguns instantes.";
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetPassword = async (
    email: string,
    token: string,
    newPassword: string,
  ) => {
    setAuthError(null);
    setAuthSuccess(null);
    setAuthLoading(true);

    try {
      const data = await api.post<{ message: string }>("/auth/reset-password", {
        email,
        token,
        newPassword,
      });
      setAuthSuccess(data.message);
      setTimeout(() => {
        setView("login");
        window.history.pushState({}, "", "/login");
        setAuthSuccess(null);
      }, 2000);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Código ou senha inválidos. Confira as informações e tente novamente.";
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePortalAuthenticated = (data: {
    token?: string;
    customer: {
      email: string;
      empresa_id: number;
      nome?: string;
      empresa_nome?: string;
    };
  }) => {
    localStorage.removeItem("portal_token");

    const portalUser: User = {
      id: 0,
      nome: data.customer.nome || data.customer.email,
      email: data.customer.email,
      empresa_id: data.customer.empresa_id,
      perfil: "cliente",
      administrador: false,
      desenvolvedor: false,
      ativo: true,
      cargo: "",
      telefone: undefined,
      foto: undefined,
      ultimo_login: undefined,
      created_at: new Date().toISOString(),
    };

    setCurrentUser(portalUser);
    setView("portal");
    window.history.pushState({}, "", "/portal");
  };

  if (isBooting) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  // --- RENDERING VIEWS ---

  if (view === "landing") {
    return (
      <Suspense fallback={<LazyPageFallback />}>
        <PublicSite
          onLogin={() => {
            setView("login");
            window.history.pushState({}, "", "/login");
          }}
        />
      </Suspense>
    );
  }

  if (view === "login") {
    return (
      <LoginPage
        onSubmit={handleLogin}
        authError={authError}
        loading={authLoading}
        onForgotPassword={() => {
          setView("forgot-password");
          setAuthError(null);
          setAuthSuccess(null);
          window.history.pushState({}, "", "/esqueci-senha");
        }}
        onBackToSite={() => {
          setView("landing");
          window.history.pushState({}, "", "/");
        }}
        onOpenCustomerPortal={() => {
          setAuthError(null);
          setAuthSuccess(null);
          setView("portal-access");
          window.history.pushState({}, "", "/portal");
        }}
      />
    );
  }

  if (view === "forgot-password") {
    return (
      <ForgotPasswordPage
        onSubmit={handleForgotPassword}
        authError={authError}
        authSuccess={authSuccess}
        loading={authLoading}
        onBackToLogin={() => {
          setView("login");
          setAuthError(null);
          setAuthSuccess(null);
          window.history.pushState({}, "", "/login");
        }}
        onBackToSite={() => {
          setView("landing");
          window.history.pushState({}, "", "/");
        }}
      />
    );
  }

  if (view === "reset-password") {
    return (
      <ResetPasswordPage
        onSubmit={handleResetPassword}
        initialEmail={resetEmail}
        authError={authError}
        authSuccess={authSuccess}
        loading={authLoading}
        onBackToLogin={() => {
          setView("login");
          setAuthError(null);
          setAuthSuccess(null);
          window.history.pushState({}, "", "/login");
        }}
        onBackToSite={() => {
          setView("landing");
          window.history.pushState({}, "", "/");
        }}
      />
    );
  }

  if (view === "portal-access") {
    return (
      <Suspense fallback={<LazyPageFallback />}>
        <PortalAccessPage
          onAuthenticated={handlePortalAuthenticated}
          onBackToLogin={() => {
            setView("login");
            setAuthError(null);
            setAuthSuccess(null);
            window.history.pushState({}, "", "/login");
          }}
        />
      </Suspense>
    );
  }

  if (view === "portal" && currentUser) {
    return (
      <Suspense fallback={<LazyPageFallback />}>
        <PortalLayout currentUser={currentUser} onLogout={handleLogout} />
      </Suspense>
    );
  }

  // --- DASHBOARD LAYOUT ---

  if (view === "dashboard" && currentUser) {
    const handleTopbarNavigate = (target: {
      tab: string;
      ticketId?: number;
    }) => {
      if (target.ticketId) {
        setActiveTab("tickets");
        setSelectedTicketId(target.ticketId);
        return;
      }

      if (isActiveTab(target.tab)) {
        setActiveTab(target.tab);
        setSelectedTicketId(null);
      }
    };

    const getPageTitle = () => {
      switch (activeTab) {
        case "dashboard":
          return "Dashboard de Controle";
        case "tickets":
          return selectedTicketId ? "Chamado" : "Central de Chamados";
        case "whatsapp":
          return "WhatsApp";
        case "users":
          return "Gestão de Usuários";
        case "companies":
          return "Empresas Ativas";
        case "logs":
          return "Logs do Sistema";
        case "reports":
          return "Relatórios Gerenciais";
        case "knowledge":
          return "Base de Conhecimento";
        case "ai":
          return "Assistente IA";
        case "profile":
          return "Configurações de Perfil";
        case "settings":
          return "Preferências";
        default:
          return "Gestifique";
      }
    };

    return (
      <div className="relative flex h-screen w-screen overflow-hidden bg-[#F4F7FA]">
        <Sidebar
          currentUser={currentUser}
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab as ActiveTab);
            setSelectedTicketId(null);
          }}
          isOpen={isSidebarOpen}
          isCollapsed={isSidebarCollapsed}
          onClose={() => setIsSidebarOpen(false)}
          onToggleCollapse={() => {
            setIsSidebarCollapsed((current) => {
              const next = !current;
              window.localStorage.setItem("gestifique-sidebar-collapsed", String(next));
              return next;
            });
          }}
          onLogout={handleLogout}
          onNavigate={handleNotificationNavigate}
        />

        <div className="relative z-0 flex h-full w-full min-w-0 flex-col overflow-hidden">
          <Topbar
            title={getPageTitle()}
            onMenuClick={() => setIsSidebarOpen(true)}
            showSearch={!(activeTab === "tickets" && selectedTicketId)}
            onNavigate={handleTopbarNavigate}
          />

          <main className="min-h-0 flex-1 overflow-hidden bg-[#F4F7FA]">
            <div
              className={cn(
                "h-full w-full min-h-0 transition-all duration-300",
                activeTab === "tickets" && selectedTicketId
                  ? "p-0 sm:p-3 lg:p-4"
                  : "flex p-3 sm:p-4 lg:p-4 xl:p-5",
              )}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab + (selectedTicketId || "")}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "min-h-0",
                    activeTab === "tickets" && selectedTicketId
                      ? "h-full w-full"
                      : "mx-auto h-full w-full max-w-[1560px]",
                  )}
                >
                  <Suspense fallback={<LazyPageFallback />}>
                  {activeTab === "dashboard" &&
                    (canAccessAppScreen(currentUser, "dashboard") ? (
                      <DashboardPage
                        currentUser={currentUser}
                        onNavigate={(tab) => setActiveTab(tab as ActiveTab)}
                      />
                    ) : (
                      <AccessDenied />
                    ))}

                  {activeTab === "tickets" && !selectedTicketId &&
                    (canAccessAppScreen(currentUser, "tickets") ? (
                      <TicketsPage
                        onSelectTicket={setSelectedTicketId}
                        currentUser={currentUser}
                      />
                    ) : (
                      <AccessDenied />
                    ))}

                  {activeTab === "tickets" && selectedTicketId &&
                    (canAccessAppScreen(currentUser, "tickets", { selectedTicketId }) ? (
                      <TicketDetailsPage
                        ticketId={selectedTicketId}
                        onBack={() => setSelectedTicketId(null)}
                        currentUser={currentUser}
                      />
                    ) : (
                      <AccessDenied />
                    ))}

                  {activeTab === "whatsapp" &&
                    (canAccessAppScreen(currentUser, "whatsapp") ? (
                      <WhatsappPage currentUser={currentUser} />
                    ) : (
                      <AccessDenied />
                    ))}

                  {activeTab === "users" &&
                    (canAccessAppScreen(currentUser, "users") ? (
                      <UsersPage currentUser={currentUser} />
                    ) : (
                      <AccessDenied />
                    ))}

                  {activeTab === "companies" &&
                    (canAccessAppScreen(currentUser, "companies") ? (
                      <CompaniesPage currentUser={currentUser} />
                    ) : (
                      <AccessDenied />
                    ))}

                  {activeTab === "logs" &&
                    (canAccessAppScreen(currentUser, "logs") ? (
                      <LogsPage />
                    ) : (
                      <AccessDenied />
                    ))}

                  {activeTab === "reports" &&
                    (canAccessAppScreen(currentUser, "reports") ? (
                      <ReportsPage currentUser={currentUser} />
                    ) : (
                      <AccessDenied />
                    ))}

                  {activeTab === "knowledge" &&
                    (canAccessAppScreen(currentUser, "knowledge") ? (
                      <KnowledgePage currentUser={currentUser} />
                    ) : (
                      <AccessDenied />
                    ))}

                  {activeTab === "ai" &&
                    (canAccessAppScreen(currentUser, "ai") ? (
                      <AITesterPage currentUser={currentUser} />
                    ) : (
                      <AccessDenied />
                    ))}

                  {activeTab === "profile" && (
                    <ProfilePage
                      currentUser={currentUser}
                      onUpdate={setCurrentUser}
                      onNavigate={(tab) => setActiveTab(tab)}
                    />
                  )}

                  {activeTab === "settings" &&
                    (canAccessAppScreen(currentUser, "settings") ? (
                      <SettingsPage
                        currentUser={currentUser}
                        onNavigate={(tab) => setActiveTab(tab)}
                        onUpdateUser={setCurrentUser}
                      />
                    ) : (
                      <AccessDenied />
                    ))}
                  </Suspense>
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return null;
}
