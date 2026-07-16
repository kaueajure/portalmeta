import React, { useState } from "react";
import { User } from "../../types";
import { api } from "../../lib/api";
import {
  Building2,
  MessageCircle,
  ShieldCheck,
  Database,
  Cpu,
  Lock,
  Save,
  Palette,
  CheckCircle2,
  AlertCircle,
  Layout,
  Globe,
  Shield,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Card } from "../ui/Card";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { EmailChannelsManager } from "../settings/EmailChannelsManager";
import { TicketOptionsManager } from "../settings/TicketOptionsManager";
import { SlaPoliciesManager } from "../settings/SlaPoliciesManager";
import { AutomationsManager } from "../settings/AutomationsManager";
import { WhatsAppSettingsManager } from "../settings/WhatsAppSettingsManager";
import { hasPermission } from "../../lib/permissions";

type AppTab =
  | "dashboard"
  | "tickets"
  | "whatsapp"
  | "users"
  | "logs"
  | "profile"
  | "settings"
  | "reports";

type SettingsSubTab =
  | "general"
  | "tickets"
  | "whatsapp"
  | "identity"
  | "system";

export type SettingsRouteSection =
  | "geral"
  | "atendimento"
  | "sla"
  | "automacoes"
  | "canais-de-email"
  | "whatsapp"
  | "identidade"
  | "sistema";

interface SettingsPageProps {
  currentUser: User;
  onNavigate: (tab: AppTab) => void;
  onUpdateUser?: (user: User) => void;
  routeSection?: SettingsRouteSection;
  onRouteSectionChange?: (section: SettingsRouteSection) => void;
}

type HealthOverviewResponse = {
  success: boolean;
  database: {
    success: boolean;
    status: string;
    latencyMs?: number;
    database?: string;
    message?: string;
  };
  system: {
    success: boolean;
    status: string;
    environment: string;
    uptimeSeconds: number;
    roles: {
      web: boolean;
      emailListener: boolean;
      ticketJobs: boolean;
    };
  };
  security: {
    success: boolean;
    status: string;
    auth: boolean;
    helmet: boolean;
    rateLimit: boolean;
    trustProxy: any;
    warnings: string[];
  };
};

type ApplicationSettings = {
  nome: string;
  cnpj?: string | null;
  email?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  cor_principal?: string | null;
  logo?: string | null;
  email_assinatura?: string | null;
  updated_at?: string;
};

import { PageShell } from "../layout/PageShell";

export const SettingsPage = ({
  currentUser,
  onNavigate,
  onUpdateUser: _onUpdateUser,
  routeSection = "geral",
  onRouteSectionChange,
}: SettingsPageProps) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const routeToSubTab = (section: SettingsRouteSection): SettingsSubTab => {
    if (["atendimento", "sla", "automacoes", "canais-de-email"].includes(section)) return "tickets";
    if (section === "geral") return "general";
    if (section === "identidade") return "identity";
    if (section === "sistema") return "system";
    return "whatsapp";
  };
  const subTabToRoute: Record<SettingsSubTab, SettingsRouteSection> = {
    general: "geral", tickets: "atendimento", whatsapp: "whatsapp",
    identity: "identidade", system: "sistema",
  };
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>(() => {
    const requested = window.sessionStorage.getItem("portalmeta.settingsTab");
    window.sessionStorage.removeItem("portalmeta.settingsTab");
    return requested === "tickets" ||
      requested === "whatsapp" ||
      requested === "identity" ||
      requested === "system"
      ? requested
      : routeToSubTab(routeSection);
  });
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthData, setHealthData] = useState<HealthOverviewResponse | null>(
    null,
  );
  const [identity, setIdentity] = useState<ApplicationSettings | null>(null);

  const canEditIdentity = hasPermission(currentUser, "configuracoes.identidade");
  const canManageEmailChannelsByBackend = Boolean(
    currentUser.desenvolvedor || currentUser.administrador,
  );
  const canViewIdentityTab = canEditIdentity;
  const canManageTicketOptions = hasPermission(
    currentUser,
    "configuracoes.atendimento",
  );
  const canManageSlaPolicies = hasPermission(
    currentUser,
    "sla.gerenciar_politicas",
  );
  const canManageAutomations = hasPermission(
    currentUser,
    "automacoes.gerenciar",
  );
  const canViewTicketSettings =
    canManageTicketOptions ||
    canManageSlaPolicies ||
    canManageAutomations ||
    canManageEmailChannelsByBackend ||
    canEditIdentity;
  const canViewWhatsAppSettings =
    hasPermission(currentUser, "integracoes.whatsapp.visualizar") ||
    hasPermission(currentUser, "integracoes.whatsapp.gerenciar");
  const canViewSystemHealth = hasPermission(currentUser, "sistema.health");
  const availableSettingsTabs: Array<{ id: SettingsSubTab; visible: boolean }> = [
    { id: "general", visible: true },
    { id: "tickets", visible: canViewTicketSettings },
    { id: "whatsapp", visible: canViewWhatsAppSettings },
    { id: "identity", visible: canViewIdentityTab },
    { id: "system", visible: canViewSystemHealth },
  ];

  React.useEffect(() => {
    const nextSubTab = routeToSubTab(routeSection);
    setActiveSubTab(nextSubTab);
    if (["sla", "automacoes", "canais-de-email"].includes(routeSection)) {
      window.requestAnimationFrame(() => {
        document.getElementById(`configuracao-${routeSection}`)?.scrollIntoView({ block: "start" });
      });
    }
  }, [routeSection]);

  React.useEffect(() => {
    if (
      (activeSubTab !== "identity" && activeSubTab !== "tickets") ||
      !canEditIdentity
    ) return;
    api.get<ApplicationSettings>('/application-settings')
      .then(setIdentity)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar a identidade institucional.'));
  }, [activeSubTab, canEditIdentity]);

  React.useEffect(() => {
    const currentIsAvailable = availableSettingsTabs.some(
      (tab) => tab.id === activeSubTab && tab.visible,
    );

    if (!currentIsAvailable) {
      const nextTab = availableSettingsTabs.find((tab) => tab.visible)?.id;
      if (nextTab) {
        setActiveSubTab(nextTab);
        onRouteSectionChange?.(subTabToRoute[nextTab]);
      }
    }
  }, [
    activeSubTab,
    canViewIdentityTab,
    canViewTicketSettings,
    canViewWhatsAppSettings,
    canViewSystemHealth,
  ]);

  const fetchHealthOverview = async () => {
    setLoadingHealth(true);
    setHealthError(null);
    try {
      const res = await api.get<HealthOverviewResponse>("/health/overview");
      setHealthData(res);
    } catch (err: any) {
      setHealthError(err.message || "Falha ao buscar diagnóstico do sistema");
    } finally {
      setLoadingHealth(false);
    }
  };

  React.useEffect(() => {
    if (activeSubTab === "system" && canViewSystemHealth) {
      fetchHealthOverview();
    }
  }, [activeSubTab, canViewSystemHealth]);

  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setSuccess(null);
    setError(null);

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const payload = {
      nome: String(formData.get("nome") || ""),
      cnpj: String(formData.get("cnpj") || ""),
      email: String(formData.get("email") || ""),
      telefone: String(formData.get("telefone") || ""),
      endereco: String(formData.get("endereco") || ""),
      cor_principal: String(formData.get("cor_principal") || "#2563eb"),
      logo: String(formData.get("logo") || ""),
    };

    if (!payload.nome) {
      setError("O nome institucional é obrigatório.");
      setLoading(false);
      return;
    }

    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      setError("E-mail de contato inválido.");
      setLoading(false);
      return;
    }

    try {
      const updated = await api.patch<ApplicationSettings>('/application-settings', payload);
      setIdentity(updated);

      setSuccess("Identidade institucional atualizada!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao salvar configurações.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTicketEmailSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    try {
      const updated = await api.patch<ApplicationSettings>(
        "/application-settings",
        { email_assinatura: String(formData.get("email_assinatura") || "") },
      );
      setIdentity(updated);
      setSuccess("Assinatura dos tickets atualizada!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar a assinatura.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageShell
        flush
        tabs={
          <div className="flex flex-wrap gap-1 py-3 bg-white w-fit">
            {[
              { id: "general" as const, label: "Geral", icon: <Settings2 size={14} />, visible: true },
              { id: "tickets" as const, label: "Tickets", icon: <Layout size={14} />, visible: canViewTicketSettings },
              { id: "whatsapp" as const, label: "WhatsApp", icon: <MessageCircle size={14} />, visible: canViewWhatsAppSettings },
              { id: "identity" as const, label: "Identidade", icon: <Building2 size={14} />, visible: canViewIdentityTab },
              { id: "system" as const, label: "Sistema", icon: <Cpu size={14} />, visible: canViewSystemHealth },
            ]
              .filter((tab) => tab.visible)
              .map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveSubTab(tab.id);
                    onRouteSectionChange?.(subTabToRoute[tab.id]);
                  }}
                  className={cn(
                    "h-8 px-3 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                    activeSubTab === tab.id
                      ? "bg-slate-100 text-slate-900 shadow-sm border border-slate-200/50"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50",
                  )}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
          </div>
        }
      >
        <div className="min-h-[400px] p-4 sm:p-5 bg-slate-50">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSubTab}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {activeSubTab === "general" && (
                <Card className="p-4 sm:p-5 space-y-5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-100 text-slate-700">
                      <Settings2 size={17} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Configurações gerais</h3>
                      <p className="text-[11px] font-medium text-slate-500">
                        Acessos administrativos e visão geral dos módulos do Portal Meta.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {hasPermission(currentUser, "usuarios.visualizar") && (
                      <Button
                        variant="outline"
                        onClick={() => onNavigate("users")}
                        className="h-11 justify-between bg-white text-xs text-slate-700"
                      >
                        Equipe <ShieldCheck size={14} className="text-blue-500" />
                      </Button>
                    )}
                    {hasPermission(currentUser, "auditoria.visualizar") && (
                      <Button
                        variant="outline"
                        onClick={() => onNavigate("logs")}
                        className="h-11 justify-between bg-white text-xs text-slate-700"
                      >
                        Auditoria <Database size={14} className="text-indigo-500" />
                      </Button>
                    )}
                    {hasPermission(currentUser, "tickets.visualizar") && (
                      <Button
                        variant="outline"
                        onClick={() => onNavigate("tickets")}
                        className="h-11 justify-between bg-white text-xs text-slate-700"
                      >
                        Tickets <Layout size={14} className="text-emerald-500" />
                      </Button>
                    )}
                    {hasPermission(currentUser, "integracoes.whatsapp.visualizar") && (
                      <Button
                        variant="outline"
                        onClick={() => onNavigate("whatsapp")}
                        className="h-11 justify-between bg-white text-xs text-slate-700"
                      >
                        WhatsApp <MessageCircle size={14} className="text-emerald-500" />
                      </Button>
                    )}
                  </div>
                </Card>
              )}

              {activeSubTab === "identity" && canEditIdentity && (
                <Card className="p-4 sm:p-5">
                    <form key={identity?.updated_at || 'identity'} onSubmit={handleSaveIdentity} className="space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-md flex items-center justify-center border border-blue-100">
                            <Building2 size={18} />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-slate-900">
                              Identidade Institucional
                            </h4>
                            <p className="text-[11px] text-slate-500 font-medium">
                              Dados fundamentais da sua instância Portal Meta.
                            </p>
                          </div>
                        </div>
                        {(success || error) && (
                          <div
                            className={cn(
                              "px-2.5 py-1.5 rounded-md text-[11px] font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-1",
                              success
                                ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                : "bg-red-50 text-red-600 border border-red-100",
                            )}
                          >
                            {success ? (
                              <CheckCircle2 size={12} />
                            ) : (
                              <AlertCircle size={12} />
                            )}
                            {success || error}
                          </div>
                        )}
                      </div>

                      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Input
                          label="Razão Social / Nome Fantasia"
                          name="nome"
                          defaultValue={identity?.nome || ""}
                          required
                        />
                        <Input
                          label="Documento (CNPJ/CPF)"
                          name="cnpj"
                          defaultValue={identity?.cnpj || ""}
                          placeholder="00.000.000/0000-00"
                        />
                        <Input
                          label="E-mail de Contato Principal"
                          name="email"
                          type="email"
                          defaultValue={identity?.email || ""}
                        />
                        <Input
                          label="Telefone de Suporte"
                          name="telefone"
                          defaultValue={identity?.telefone || ""}
                        />
                      </div>

                      <div className="space-y-1.5 flex flex-col">
                        <label className="text-xs font-medium text-slate-700">
                          Endereço da Sede
                        </label>
                        <textarea
                          name="endereco"
                          rows={2}
                          defaultValue={identity?.endereco || ""}
                          className="w-full bg-white border border-slate-200 rounded-md p-2.5 text-xs focus:ring-2 focus:ring-blue-100 transition-all outline-none resize-none"
                        />
                      </div>

                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-slate-50 text-slate-500 rounded flex items-center justify-center border border-slate-100">
                            <Palette size={12} />
                          </div>
                          <h4 className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                            Visual & Identidade
                          </h4>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <Input
                            label="Cor Principal (Hex)"
                            name="cor_principal"
                            defaultValue={
                              identity?.cor_principal || "#2563eb"
                            }
                            placeholder="#2563eb"
                          />
                          <Input
                            label="URL do Logotipo"
                            name="logo"
                            defaultValue={identity?.logo || ""}
                            placeholder="https://exemplo.com/logo.png"
                          />
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <Button
                          type="submit"
                          loading={loading}
                          size="sm"
                          className="w-full sm:w-auto"
                        >
                          <Save size={14} className="mr-1.5" /> Salvar
                          Alterações
                        </Button>
                      </div>
                    </form>
                </Card>
              )}

              {activeSubTab === "system" && canViewSystemHealth && (
                <div className="space-y-4">
                  {loadingHealth ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                      <RefreshCw
                        className="animate-spin text-slate-300"
                        size={24}
                      />
                      <p className="text-xs font-semibold text-slate-500">
                        Coletando diagnósticos...
                      </p>
                    </div>
                  ) : healthError ? (
                    <Card className="p-6">
                      <div className="flex flex-col items-center justify-center text-center space-y-3">
                        <div className="w-10 h-10 bg-red-50 text-red-500 rounded-lg flex items-center justify-center">
                          <AlertCircle size={20} />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold text-slate-900">
                            Falha no Diagnóstico
                          </h4>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto">
                            {healthError}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={fetchHealthOverview}
                        >
                          Tentar Novamente
                        </Button>
                      </div>
                    </Card>
                  ) : healthData ? (
                    <>
                      <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                        <span className="text-[11px] font-medium text-slate-500 pl-2">
                          Última verificação: {new Date().toLocaleTimeString()}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={fetchHealthOverview}
                          className="h-7 text-[11px]"
                        >
                          <RefreshCw size={12} className="mr-1.5" /> Atualizar
                          Diagnóstico
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Banco de Dados Card - changed from black to white */}
                        <Card className="p-4 space-y-3 bg-white border-slate-200 text-slate-900">
                          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 border border-blue-100">
                            <Database size={16} />
                          </div>
                          <div>
                            <div className="text-sm font-semibold">
                              Banco de Dados
                            </div>
                            <div className="text-[10px] font-semibold text-slate-500 uppercase">
                              Conexão principal
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                              <Badge
                                variant={
                                  healthData.database.status === "CONNECTED"
                                    ? "emerald"
                                    : "red"
                                }
                                className="font-semibold text-[9px] px-1.5 py-0"
                              >
                                {healthData.database.status === "CONNECTED"
                                  ? "CONECTADO"
                                  : "ERRO"}
                              </Badge>
                              <span className="text-[10px] font-mono text-slate-500">
                                {healthData.database.latencyMs
                                  ? `${healthData.database.latencyMs}ms`
                                  : "---"}
                              </span>
                            </div>
                            {healthData.database.message && (
                              <div className="text-[10px] text-red-500 font-medium">
                                {healthData.database.message}
                              </div>
                            )}
                          </div>
                        </Card>

                        {/* API SYSTEM CARD */}
                        <Card className="p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 border border-indigo-100">
                              <Globe size={16} />
                            </div>
                            <div className="flex flex-col items-end">
                              <div className="flex gap-1">
                                {healthData.system.roles.web && (
                                  <Badge
                                    variant="slate"
                                    className="text-[8px] px-1"
                                  >
                                    WEB
                                  </Badge>
                                )}
                                {healthData.system.roles.emailListener && (
                                  <Badge
                                    variant="slate"
                                    className="text-[8px] px-1"
                                  >
                                    EMAIL
                                  </Badge>
                                )}
                                {healthData.system.roles.ticketJobs && (
                                  <Badge
                                    variant="slate"
                                    className="text-[8px] px-1"
                                  >
                                    JOBS
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-900">
                              API do Sistema
                            </div>
                            <div className="text-[10px] font-semibold text-slate-400 uppercase">
                              {healthData.system.environment}
                            </div>
                          </div>
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <Badge
                              variant={
                                healthData.system.status === "OPERATIONAL"
                                  ? "indigo"
                                  : "red"
                              }
                              className="font-semibold text-[9px] px-1.5 py-0"
                            >
                              {healthData.system.status === "OPERATIONAL"
                                ? "OPERACIONAL"
                                : "ERRO"}
                            </Badge>
                            <span className="text-[10px] font-mono text-slate-500">
                              Up:{" "}
                              {Math.floor(
                                healthData.system.uptimeSeconds / 3600,
                              )}
                              h{" "}
                              {Math.floor(
                                (healthData.system.uptimeSeconds % 3600) / 60,
                              )}
                              m
                            </span>
                          </div>
                        </Card>

                        {/* SECURITY CARD */}
                        <Card className="p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 border border-emerald-100">
                              <ShieldCheck size={16} />
                            </div>
                            <div className="text-lg font-bold text-slate-400">
                              {healthData.security.warnings.length}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-900">
                              Camada de Segurança
                            </div>
                            <div className="text-[10px] font-semibold text-slate-400 uppercase">
                              {healthData.security.auth
                                ? "Autenticação Ativa"
                                : "Autenticação Mista"}
                            </div>
                          </div>
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <Badge
                              variant={
                                healthData.security.status === "ACTIVE"
                                  ? "emerald"
                                  : healthData.security.status === "WARNING"
                                    ? "amber"
                                    : "red"
                              }
                              className="font-semibold text-[9px] px-1.5 py-0"
                            >
                              {healthData.security.status === "ACTIVE"
                                ? "ATIVO"
                                : healthData.security.status === "WARNING"
                                  ? "AVISOS"
                                  : "ERRO"}
                            </Badge>
                            <span className="text-[10px] font-mono text-slate-500">
                              {healthData.security.helmet
                                ? "Protegido"
                                : "Sem Proteção"}
                            </span>
                          </div>
                        </Card>
                      </div>

                      {healthData.security.warnings.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
                          <div className="flex gap-1.5 items-center text-amber-800 font-semibold text-xs">
                            <AlertCircle size={14} /> Avisos de Segurança
                          </div>
                          <ul className="list-disc pl-5 text-[11px] text-amber-700 space-y-0.5">
                            {healthData.security.warnings.map((warn, i) => (
                              <li key={i}>{warn}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <Card className="p-4 sm:p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg flex items-center justify-center">
                              <Lock size={16} />
                            </div>
                            <h4 className="text-sm font-semibold text-slate-900">
                              Painel de Manutenção
                            </h4>
                          </div>
                          <Badge
                            variant="slate"
                            className="font-semibold text-[10px] uppercase"
                          >
                            Manutenção
                          </Badge>
                        </div>

                        <p className="text-[13px] text-slate-500 leading-relaxed max-w-3xl">
                          Acesso restrito para diagnóstico e manutenção
                          estrutural do ecossistema Portal Meta. Ações aqui
                          impactam múltiplos módulos.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {[
                            {
                              id: "users" as const,
                              desc: "Usuários",
                              icon: <Shield className="text-indigo-500" />,
                            },
                            {
                              id: "logs" as const,
                              desc: "Auditoria",
                              icon: <Database className="text-emerald-500" />,
                            },
                          ].map((action) => (
                            <Button
                              key={action.id}
                              variant="outline"
                              onClick={() => onNavigate(action.id)}
                              className="bg-white border hover:border-blue-300 border-slate-200 text-slate-700 h-10 justify-between"
                            >
                              <div className="flex flex-col items-start">
                                <span className="text-xs font-semibold leading-tight">
                                  {action.desc}
                                </span>
                              </div>
                              <div className="p-1 rounded bg-slate-50 border border-slate-100">
                                {React.cloneElement(
                                  action.icon as React.ReactElement<any>,
                                  { size: 14 },
                                )}
                              </div>
                            </Button>
                          ))}
                        </div>
                      </Card>
                    </>
                  ) : (
                    <Card className="p-6">
                      <div className="flex flex-col items-center justify-center text-center space-y-3">
                        <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-lg flex items-center justify-center border border-slate-200">
                          <Database size={20} />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold text-slate-900">
                            Nenhum diagnóstico carregado
                          </h4>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto">
                            As informações de saúde do sistema não estão
                            disponíveis.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={fetchHealthOverview}
                        >
                          Atualizar diagnóstico
                        </Button>
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {activeSubTab === "tickets" && (
                <div className="space-y-4">
                  <nav aria-label="Seções de configuração do atendimento" className="no-scrollbar flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1.5">
                    {[
                      { id: "atendimento" as const, label: "Atendimento", visible: canManageTicketOptions || canEditIdentity },
                      { id: "sla" as const, label: "SLA", visible: canManageSlaPolicies },
                      { id: "automacoes" as const, label: "Automações", visible: canManageAutomations },
                      { id: "canais-de-email" as const, label: "Canais de e-mail", visible: canManageEmailChannelsByBackend },
                    ].filter((item) => item.visible).map((item) => (
                      <button key={item.id} type="button" onClick={() => onRouteSectionChange?.(item.id)} className={cn("h-8 shrink-0 rounded-md px-3 text-xs font-semibold transition-colors", routeSection === item.id ? "bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-200" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950")}>{item.label}</button>
                    ))}
                  </nav>
                  <section id="configuracao-atendimento" className="scroll-mt-4 space-y-4">
                  {canEditIdentity && (
                    <Card className="p-4 sm:p-5">
                      <form
                        key={identity?.updated_at || "ticket-email-signature"}
                        onSubmit={handleSaveTicketEmailSignature}
                        className="space-y-4"
                      >
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900">
                              Assinatura dos e-mails de tickets
                            </h3>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              Aplicada nas mensagens de criação e resposta enviadas aos clientes.
                            </p>
                          </div>
                          {(success || error) && (
                            <div
                              className={cn(
                                "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold",
                                success
                                  ? "border-emerald-100 bg-emerald-50 text-emerald-600"
                                  : "border-red-100 bg-red-50 text-red-600",
                              )}
                            >
                              {success ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                              {success || error}
                            </div>
                          )}
                        </div>
                        <textarea
                          name="email_assinatura"
                          rows={4}
                          maxLength={2000}
                          defaultValue={
                            identity?.email_assinatura ||
                            `Atenciosamente,\nEquipe de Atendimento\n${identity?.nome || "Portal Meta"}`
                          }
                          className="min-h-[96px] w-full resize-y rounded-md border border-slate-200 bg-white p-2.5 text-xs leading-relaxed outline-none transition-all focus:ring-2 focus:ring-blue-100"
                        />
                        <div className="flex justify-end">
                          <Button type="submit" loading={loading} size="sm">
                            <Save size={14} className="mr-1.5" /> Salvar assinatura
                          </Button>
                        </div>
                      </form>
                    </Card>
                  )}
                  {canManageTicketOptions && (
                    <TicketOptionsManager currentUser={currentUser} />
                  )}
                  </section>
                  {canManageSlaPolicies && (
                    <section id="configuracao-sla" className="scroll-mt-4"><SlaPoliciesManager /></section>
                  )}
                  {canManageAutomations && (
                    <section id="configuracao-automacoes" className="scroll-mt-4"><AutomationsManager /></section>
                  )}
                  {canManageEmailChannelsByBackend && (
                    <Card id="configuracao-canais-de-email" className="scroll-mt-4 p-4 sm:p-5">
                      <EmailChannelsManager
                        canCreate={canManageEmailChannelsByBackend}
                        canEdit={canManageEmailChannelsByBackend}
                        canDelete={canManageEmailChannelsByBackend}
                        canTest={canManageEmailChannelsByBackend}
                      />
                    </Card>
                  )}
                </div>
              )}

              {activeSubTab === "whatsapp" && canViewWhatsAppSettings && (
                <WhatsAppSettingsManager currentUser={currentUser} />
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </PageShell>
    </>
  );
};
