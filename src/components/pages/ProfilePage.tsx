import React, { useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  ImagePlus,
  Key,
  Keyboard,
  Layout,
  Lock,
  Moon,
  Palette,
  Save,
  TrendingUp,
  UserCircle as UserIcon,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { User } from "../../types";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";
import { hasPermission } from "../../lib/permissions";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { PageShell } from "../layout/PageShell";
import { Card } from "../ui/Card";

type AppTab =
  | "dashboard"
  | "tickets"
  | "users"
  | "companies"
  | "logs"
  | "profile"
  | "settings"
  | "reports";

type ProfileSection = "profile" | "security" | "preferences";

interface ProfilePageProps {
  currentUser: User;
  onUpdate: (user: User) => void;
  onNavigate: (tab: AppTab) => void;
}

export const ProfilePage = ({
  currentUser,
  onUpdate,
  onNavigate,
}: ProfilePageProps) => {
  const [activeSection, setActiveSection] =
    useState<ProfileSection>("profile");
  const [loading, setLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [darkThemeBeta, setDarkThemeBeta] = useState(() => {
    return window.localStorage.getItem("gestifique-theme") === "dark-beta";
  });
  const [showPwd, setShowPwd] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    document.documentElement.classList.toggle("theme-dark-beta", darkThemeBeta);
    window.localStorage.setItem(
      "gestifique-theme",
      darkThemeBeta ? "dark-beta" : "light",
    );
  }, [darkThemeBeta]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);

    const formData = new FormData(e.currentTarget as HTMLFormElement);

    try {
      const payload = {
        nome: String(formData.get("nome") || ""),
        telefone: String(formData.get("telefone") || ""),
      };

      await api.patch("/profile", payload);
      const updated = await api.get<User>("/profile");
      onUpdate(updated);
      setSuccess("Dados de perfil atualizados com sucesso!");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Erro ao atualizar dados de perfil.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdLoading(true);
    setSuccess(null);
    setError(null);

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());

    if (data.newPassword !== data.confirmPassword) {
      setError("A confirmação de senha não confere.");
      setPwdLoading(false);
      return;
    }

    if ((data.newPassword as string).length < 8) {
      setError("A nova senha deve ter no mínimo 8 caracteres.");
      setPwdLoading(false);
      return;
    }

    try {
      await api.patch("/profile/password", data);
      setSuccess("Senha alterada com sucesso!");
      (e.target as HTMLFormElement).reset();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao alterar senha.";
      setError(message);
    } finally {
      setPwdLoading(false);
    }
  };

  const handlePhotoChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Envie uma imagem válida.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 2 MB.");
      return;
    }

    setPhotoLoading(true);
    setSuccess(null);
    setError(null);

    const formData = new FormData();
    formData.append("foto", file);

    try {
      await api.post<{ foto: string }>("/profile/photo", formData);
      const updated = await api.get<User>("/profile");
      onUpdate(updated);
      setSuccess("Foto de perfil atualizada com sucesso!");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao atualizar foto de perfil.";
      setError(message);
    } finally {
      setPhotoLoading(false);
    }
  };

  const tabs = [
    { id: "profile" as const, label: "Editar perfil", icon: UserIcon },
    { id: "security" as const, label: "Segurança", icon: Key },
    { id: "preferences" as const, label: "Preferências", icon: Palette },
  ];

  return (
    <PageShell
      title="Meu Perfil"
      subtitle="Gerencie seus dados pessoais, segurança da conta e preferências de trabalho."
      contentClassName="p-4 sm:p-5 bg-slate-50"
      tabs={
        <div className="flex w-fit flex-wrap gap-1 bg-white py-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-all",
                  activeSection === tab.id
                    ? "border border-slate-200/50 bg-slate-100 text-slate-900 shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-3">
          <Card className="overflow-hidden text-center">
            <div className="h-12 bg-slate-50" />
            <div className="relative -mt-8 px-4 pb-4">
              <div className="inline-block">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white text-xl font-bold uppercase text-slate-800 shadow-sm">
                  {currentUser.foto ? (
                    <img
                      src={currentUser.foto}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (currentUser.nome || "U").charAt(0)
                  )}
                </div>
              </div>
              <div className="mt-2">
                <h3 className="mb-0.5 text-sm font-semibold leading-tight text-slate-900">
                  {currentUser.nome || "Usuário"}
                </h3>
                <p className="mb-2 truncate text-[10px] font-medium text-slate-500">
                  {currentUser.email || "E-mail não informado"}
                </p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  <Badge
                    variant="indigo"
                    className="px-1.5 py-0 text-[9px] font-semibold"
                  >
                    {currentUser.cargo || "Membro"}
                  </Badge>
                  {!!currentUser.administrador && (
                    <Badge
                      variant="blue"
                      className="px-1.5 py-0 text-[9px] font-semibold"
                    >
                      Admin
                    </Badge>
                  )}
                </div>
                <div className="mt-3">
                  <input
                    id="profile-photo-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    onChange={handlePhotoChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={photoLoading}
                    onClick={() =>
                      document.getElementById("profile-photo-input")?.click()
                    }
                    className="h-7 w-full text-[11px]"
                  >
                    <ImagePlus size={13} className="mr-1.5 text-slate-400" />
                    Alterar foto
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-slate-200 bg-white p-4 text-slate-800 shadow-sm">
            <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Building2 size={14} className="text-blue-500" /> Empresa
            </h4>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600">
                <Building2 size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold leading-tight">
                  {currentUser.empresa_nome || "Gestifique Central"}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                  <span className="block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Conectado
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
              <div className="space-y-0.5">
                <span className="text-[10px] font-medium uppercase text-slate-500">
                  ID membro
                </span>
                <div className="font-mono text-xs font-medium text-slate-700">
                  #{currentUser.id?.toString().padStart(4, "0")}
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-9">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-xs font-medium text-red-600"
              >
                <AlertCircle size={14} /> {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs font-medium text-emerald-600"
              >
                <CheckCircle2 size={14} /> {success}
              </motion.div>
            )}
          </AnimatePresence>

          {activeSection === "profile" && (
            <Card>
              <form
                onSubmit={handleUpdateProfile}
                className="space-y-4 p-4 sm:p-5"
              >
                <div className="mb-2 flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-blue-600">
                    <UserIcon size={16} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Informações pessoais
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Atualize seus dados de contato e identificação.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Nome completo"
                    name="nome"
                    defaultValue={currentUser.nome || ""}
                    required
                    placeholder="Ex: João Silva"
                  />
                  <div className="flex flex-col space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">
                      E-mail corporativo
                    </label>
                    <input
                      value={currentUser.email || ""}
                      readOnly
                      className="h-9 cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-400 outline-none"
                    />
                    <p className="px-1 text-[10px] font-medium text-slate-400">
                      Gerido pelo administrador.
                    </p>
                  </div>
                  <Input
                    label="Telefone / WhatsApp"
                    name="telefone"
                    defaultValue={currentUser.telefone || ""}
                    placeholder="(00) 00000-0000"
                  />
                  <div className="flex flex-col space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">
                      Cargo / função
                    </label>
                    <input
                      value={currentUser.cargo || "Membro do time"}
                      readOnly
                      className="h-9 cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-400 outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    loading={loading}
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    <Save size={14} className="mr-1.5" /> Salvar alterações
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {activeSection === "security" && (
            <Card>
              <form
                onSubmit={handleChangePassword}
                className="space-y-4 p-4 sm:p-5"
              >
                <div className="mb-2 flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border border-amber-100 bg-amber-50 text-amber-600">
                    <Key size={16} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Segurança e senha
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Mantenha sua conta protegida alterando a senha regularmente.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="relative">
                    <Input
                      label="Senha atual"
                      name="currentPassword"
                      type={showPwd.current ? "text" : "password"}
                      required
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPwd((s) => ({ ...s, current: !s.current }))
                      }
                      className="absolute right-3 top-[26px] text-slate-400 hover:text-slate-600"
                    >
                      {showPwd.current ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="relative">
                      <Input
                        label="Nova senha"
                        name="newPassword"
                        type={showPwd.new ? "text" : "password"}
                        required
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPwd((s) => ({ ...s, new: !s.new }))
                        }
                        className="absolute right-3 top-[26px] text-slate-400 hover:text-slate-600"
                      >
                        {showPwd.new ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        label="Confirmar nova senha"
                        name="confirmPassword"
                        type={showPwd.confirm ? "text" : "password"}
                        required
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPwd((s) => ({ ...s, confirm: !s.confirm }))
                        }
                        className="absolute right-3 top-[26px] text-slate-400 hover:text-slate-600"
                      >
                        {showPwd.confirm ? (
                          <EyeOff size={14} />
                        ) : (
                          <Eye size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    loading={pwdLoading}
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    <Lock size={14} className="mr-1.5 text-slate-400" />
                    Atualizar senha
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {activeSection === "preferences" && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card className="space-y-4 p-4 sm:p-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Palette size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Preferências pessoais
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Ajustes ligados à sua experiência individual.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[13px] font-medium leading-relaxed text-slate-600">
                    Esta área reúne atalhos e configurações rápidas que antes ficavam em Configurações.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveSection("profile")}
                    className="w-full justify-between bg-white"
                  >
                    Editar dados do perfil
                    <UserIcon size={14} className="text-blue-500" />
                  </Button>
                </div>
              </Card>

              <Card className="space-y-4 p-4 sm:p-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <Moon size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">
                        Tema escuro
                      </h4>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                        Beta
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Experimente a versão inicial do tema escuro.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <div>
                    <div className="text-[13px] font-semibold text-slate-800">
                      Ativar tema escuro beta
                    </div>
                    <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">
                      Algumas telas ainda podem receber ajustes visuais nas próximas versões.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDarkThemeBeta((current) => !current)}
                    aria-pressed={darkThemeBeta}
                    className={cn(
                      "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
                      darkThemeBeta
                        ? "border-blue-600 bg-blue-600"
                        : "border-slate-300 bg-slate-200",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                        darkThemeBeta ? "left-5" : "left-0.5",
                      )}
                    />
                  </button>
                </div>
              </Card>

              <Card className="space-y-4 p-4 sm:p-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <Keyboard size={18} />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    Atalhos de trabalho
                  </h4>
                </div>
                <div className="grid gap-2">
                  {(["reports", "tickets", "profile", "dashboard"] as const).map(
                    (id) => {
                      const navMap = {
                        reports: {
                          desc: "Análise de relatórios",
                          icon: <TrendingUp size={16} />,
                          access: hasPermission(
                            currentUser,
                            "relatorios.visualizar",
                          ),
                          action: () => onNavigate("reports"),
                        },
                        tickets: {
                          desc: "Central de chamados",
                          icon: <Layout size={16} />,
                          access: hasPermission(
                            currentUser,
                            "tickets.visualizar",
                          ),
                          action: () => onNavigate("tickets"),
                        },
                        profile: {
                          desc: "Editar perfil",
                          icon: <UserIcon size={16} />,
                          access: true,
                          action: () => setActiveSection("profile"),
                        },
                        dashboard: {
                          desc: "Indicadores em tempo real",
                          icon: <Zap size={16} />,
                          access: hasPermission(
                            currentUser,
                            "dashboard.visualizar",
                          ),
                          action: () => onNavigate("dashboard"),
                        },
                      };
                      const nav = navMap[id];
                      if (nav.access === false) return null;
                      return (
                        <button
                          key={id}
                          onClick={nav.action}
                          className="group flex items-center justify-between rounded-md border border-slate-200 bg-white p-2.5 text-left shadow-sm transition-all hover:border-blue-300"
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-slate-400 transition-colors group-hover:text-blue-600">
                              {nav.icon}
                            </div>
                            <span className="text-[13px] font-medium text-slate-700">
                              {nav.desc}
                            </span>
                          </div>
                          <ChevronRight
                            size={14}
                            className="text-slate-300 group-hover:text-slate-600"
                          />
                        </button>
                      );
                    },
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
};
