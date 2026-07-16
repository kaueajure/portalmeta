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
import { ProfileIntroduction } from "./components/onboarding/ProfileIntroduction";

const DashboardPage = lazy(() =>
  import("./components/pages/DashboardPage").then((module) => ({
    default: module.DashboardPage,
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
const WhatsappPage = lazy(() =>
  import("./components/pages/WhatsappPage").then((module) => ({
    default: module.WhatsappPage,
  })),
);
const ObligationsSpreadsheetPage = lazy(() =>
  import("./components/pages/ObligationsSpreadsheetPage").then((module) => ({
    default: module.ObligationsSpreadsheetPage,
  })),
);
const ObligationsDashboardPage = lazy(() =>
  import("./components/pages/ObligationsDashboardPage").then((module) => ({
    default: module.ObligationsDashboardPage,
  })),
);
const ObligationsMunicipalitiesPage = lazy(() =>
  import("./components/pages/ObligationsMunicipalitiesPage").then((module) => ({
    default: module.ObligationsMunicipalitiesPage,
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
  | "logs"
  | "profile"
  | "settings"
  | "reports"
  | "ai"
  | "obligations-spreadsheet"
  | "obligations-dashboard"
  | "obligations-municipalities";

export type SettingsRouteSection =
  | "geral"
  | "atendimento"
  | "sla"
  | "automacoes"
  | "canais-de-email"
  | "whatsapp"
  | "identidade"
  | "sistema";

const ACTIVE_TAB_PATHS: Record<ActiveTab, string> = {
  dashboard: "/painel",
  tickets: "/chamados",
  whatsapp: "/whatsapp",
  users: "/usuarios",
  logs: "/auditoria",
  profile: "/minha-conta",
  settings: "/configuracoes/geral",
  reports: "/relatorios",
  ai: "/assistente-ia",
  "obligations-spreadsheet": "/obrigacoes/planilha",
  "obligations-dashboard": "/obrigacoes/indicadores",
  "obligations-municipalities": "/obrigacoes/municipios",
};

const SETTINGS_ROUTE_SECTIONS = new Set<SettingsRouteSection>([
  "geral", "atendimento", "sla", "automacoes", "canais-de-email",
  "whatsapp", "identidade", "sistema",
]);

const parseDashboardPath = (pathname: string): {
  activeTab: ActiveTab;
  selectedTicketId: number | null;
  settingsSection?: SettingsRouteSection;
} | null => {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  const ticketMatch = path.match(/^\/chamados\/(\d+)$/);
  if (ticketMatch) return { activeTab: "tickets", selectedTicketId: Number(ticketMatch[1]) };

  const settingsMatch = path.match(/^\/configuracoes\/([^/]+)$/);
  if (settingsMatch && SETTINGS_ROUTE_SECTIONS.has(settingsMatch[1] as SettingsRouteSection)) {
    return { activeTab: "settings", selectedTicketId: null, settingsSection: settingsMatch[1] as SettingsRouteSection };
  }
  if (path === "/configuracoes") {
    return { activeTab: "settings", selectedTicketId: null, settingsSection: "geral" };
  }

  const entry = (Object.entries(ACTIVE_TAB_PATHS) as Array<[ActiveTab, string]>)
    .find(([, route]) => route === path);
  if (entry) return { activeTab: entry[0], selectedTicketId: null, settingsSection: entry[0] === "settings" ? "geral" : undefined };

  // Compatibilidade de entrada; a URL é canonizada em seguida.
  if (path === "/tickets") return { activeTab: "tickets", selectedTicketId: null };
  const legacyTicket = path.match(/^\/tickets\/(\d+)$/);
  if (legacyTicket) return { activeTab: "tickets", selectedTicketId: Number(legacyTicket[1]) };
  if (path === "/reports") return { activeTab: "reports", selectedTicketId: null };
  return null;
};

const getDashboardPath = (
  activeTab: ActiveTab,
  selectedTicketId: number | null,
  settingsSection: SettingsRouteSection,
) => {
  if (activeTab === "tickets" && selectedTicketId) return `/chamados/${selectedTicketId}`;
  if (activeTab === "settings") return `/configuracoes/${settingsSection}`;
  return ACTIVE_TAB_PATHS[activeTab];
};

const DASHBOARD_STATE_KEY = "portalmeta.dashboardState";

const isActiveTab = (value: string | null): value is ActiveTab =>
  !!value &&
  [
    "dashboard",
    "tickets",
    "whatsapp",
    "users",
    "logs",
    "profile",
    "settings",
    "reports",
    "ai",
    "obligations-spreadsheet",
    "obligations-dashboard",
    "obligations-municipalities",
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
    if (pathname === "/entrar" || pathname === "/login" || pathname === "/") return "login";
    if (pathname === "/esqueci-senha") return "forgot-password";
    if (pathname === "/redefinir-senha" || pathname === "/reset-password") return "reset-password";
    if (pathname === "/portal") return "portal-access";
    if (pathname.startsWith("/portal/")) return "portal";
    if (parseDashboardPath(pathname)) return "dashboard";
    return "login";
  };

  const initialDashboardRoute = parseDashboardPath(window.location.pathname);

  const [view, setView] = useState<ViewState>(() =>
    getViewFromPath(window.location.pathname),
  );
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    () => initialDashboardRoute?.activeTab || loadDashboardState().activeTab,
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [createMunicipalityRequested, setCreateMunicipalityRequested] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(
    () => initialDashboardRoute?.selectedTicketId ?? loadDashboardState().selectedTicketId,
  );
  const [settingsSection, setSettingsSection] = useState<SettingsRouteSection>(
    () => initialDashboardRoute?.settingsSection || "geral",
  );
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [resetEmail, setResetEmail] = useState("");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("portalmeta-theme");
    document.documentElement.classList.toggle(
      "theme-dark",
      savedTheme === "dark" || savedTheme === "dark-beta",
    );
  }, []);

  // Rota pública de satisfação (mantém compatibilidade com links antigos).
  const path = window.location.pathname;
  if (path.startsWith("/satisfacao/") || path.startsWith("/csat/")) {
    const token = path.replace(/^\/(satisfacao|csat)\//, "");
    if (path.startsWith("/csat/")) {
      window.history.replaceState({}, "", `/satisfacao/${token}`);
    }
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
        nome?: string;
      }>("/portal/me");

      const portalUser: User = {
        id: 0,
        nome: profile.nome || profile.email,
        email: profile.email,
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
      const path = window.location.pathname;
      const dashboardRoute = parseDashboardPath(path);
      if (dashboardRoute) {
        if (!currentUser) {
          window.sessionStorage.setItem("portalmeta.rotaAposLogin", path);
          setView("login");
          window.history.replaceState({}, "", "/entrar");
          return;
        }
        setActiveTab(dashboardRoute.activeTab);
        setSelectedTicketId(dashboardRoute.selectedTicketId);
        if (dashboardRoute.settingsSection) setSettingsSection(dashboardRoute.settingsSection);
        setView("dashboard");
        return;
      }
      const parsedView = getViewFromPath(path);
      setView(parsedView);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || view !== "dashboard") return;
    const desiredPath = getDashboardPath(activeTab, selectedTicketId, settingsSection);
    if (window.location.pathname !== desiredPath) {
      window.history.pushState({}, "", desiredPath);
    }
  }, [activeTab, currentUser, selectedTicketId, settingsSection, view]);

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

      if (pathname === "/portal" || pathname.startsWith("/portal/")) {
        const restored = await restorePortalSession();
        if (restored) {
          setIsBooting(false);
          return;
        }
        setView("portal-access");
        window.history.replaceState({}, "", "/portal");
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
        const requestedPath = window.location.pathname;
        const unauthenticatedView = getViewFromPath(requestedPath);
        const requiresAuthentication = unauthenticatedView === "dashboard" || unauthenticatedView === "portal";
        if (requiresAuthentication) {
          window.sessionStorage.setItem("portalmeta.rotaAposLogin", requestedPath);
          setView("login");
        } else {
          setView(unauthenticatedView);
        }
        if (
          !["/", "/entrar", "/login", "/esqueci-senha", "/redefinir-senha", "/reset-password", "/portal"].includes(
            window.location.pathname,
          )
        ) {
          window.history.replaceState({}, "", "/entrar");
        } else if (window.location.pathname === "/login") {
          window.history.replaceState({}, "", "/entrar");
        } else if (window.location.pathname === "/reset-password") {
          window.history.replaceState({}, "", "/redefinir-senha");
        }
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
      window.history.pushState({}, "", "/entrar");
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
        window.history.replaceState({}, "", "/portal");
      } else {
        const requestedPath = window.sessionStorage.getItem("portalmeta.rotaAposLogin");
        const requestedRoute = requestedPath ? parseDashboardPath(requestedPath) : null;
        window.sessionStorage.removeItem("portalmeta.rotaAposLogin");
        if (requestedRoute && canAccessAppScreen(profile, requestedRoute.activeTab, { selectedTicketId: requestedRoute.selectedTicketId })) {
          setActiveTab(requestedRoute.activeTab);
          setSelectedTicketId(requestedRoute.selectedTicketId);
          if (requestedRoute.settingsSection) setSettingsSection(requestedRoute.settingsSection);
          window.history.replaceState({}, "", getDashboardPath(requestedRoute.activeTab, requestedRoute.selectedTicketId, requestedRoute.settingsSection || settingsSection));
        } else {
          window.history.replaceState({}, "", getDashboardPath(activeTab, selectedTicketId, settingsSection));
        }
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
    setView("login");
    window.history.replaceState({}, "", "/entrar");
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
        window.history.pushState({}, "", "/redefinir-senha");
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
        window.history.pushState({}, "", "/entrar");
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
      nome?: string;
    };
  }) => {
    localStorage.removeItem("portal_token");

    const portalUser: User = {
      id: 0,
      nome: data.customer.nome || data.customer.email,
      email: data.customer.email,
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

  if (view === "login") {
    return (
      <LoginPage
        onSubmit={handleLogin}
        onForgotPassword={() => {
          setView("forgot-password");
          setAuthError(null);
          setAuthSuccess(null);
          window.history.pushState({}, "", "/esqueci-senha");
        }}
        authError={authError}
        loading={authLoading}
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
          window.history.pushState({}, "", "/entrar");
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
          window.history.pushState({}, "", "/entrar");
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
            window.history.pushState({}, "", "/entrar");
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
        case "logs":
          return "Logs do Sistema";
        case "reports":
          return "Relatórios Gerenciais";
        case "ai":
          return "Assistente IA";
        case "profile":
          return "Configurações de Perfil";
        case "settings":
          return "Preferências";
        case "obligations-spreadsheet":
          return "Planilha Principal";
        case "obligations-dashboard":
          return "Dashboard de Obrigações";
        case "obligations-municipalities":
          return "Municípios";
        default:
          return "Portal Meta";
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
          onClose={() => setIsSidebarOpen(false)}
          onLogout={handleLogout}
          onNavigate={handleNotificationNavigate}
        />

        <div className="relative z-0 flex h-full w-full min-w-0 flex-col overflow-hidden">
          <Topbar
            title={getPageTitle()}
            onMenuClick={() => setIsSidebarOpen(true)}
            isMenuOpen={isSidebarOpen}
            showSearch
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
                  className="h-full min-h-0 w-full"
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
                      <WhatsappPage
                        currentUser={currentUser}
                        onOpenSettings={() => {
                          setSettingsSection("whatsapp");
                          setActiveTab("settings");
                        }}
                      />
                    ) : (
                      <AccessDenied />
                    ))}

                  {activeTab === "obligations-spreadsheet" &&
                    (canAccessAppScreen(currentUser, "obligations-spreadsheet") ? (
                      <ObligationsSpreadsheetPage
                        currentUser={currentUser}
                        onNavigate={(tab) => {
                          setCreateMunicipalityRequested(true);
                          setActiveTab(tab);
                        }}
                      />
                    ) : (
                      <AccessDenied />
                    ))}

                  {activeTab === "obligations-dashboard" &&
                    (canAccessAppScreen(currentUser, "obligations-dashboard") ? (
                      <ObligationsDashboardPage />
                    ) : (
                      <AccessDenied />
                    ))}

                  {activeTab === "obligations-municipalities" &&
                    (canAccessAppScreen(currentUser, "obligations-municipalities") ? (
                      <ObligationsMunicipalitiesPage
                        currentUser={currentUser}
                        openCreateOnMount={createMunicipalityRequested}
                        onCreateOpened={() => setCreateMunicipalityRequested(false)}
                      />
                    ) : (
                      <AccessDenied />
                    ))}

                  {activeTab === "users" &&
                    (canAccessAppScreen(currentUser, "users") ? (
                      <UsersPage currentUser={currentUser} />
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
                        routeSection={settingsSection}
                        onRouteSectionChange={setSettingsSection}
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
        <ProfileIntroduction
          currentUser={currentUser}
          onNavigate={(tab) => {
            if (isActiveTab(tab)) {
              setActiveTab(tab);
              setSelectedTicketId(null);
            }
          }}
        />
      </div>
    );
  }

  return null;
}
