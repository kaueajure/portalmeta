import React, { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { User, Empresa } from "../../types";
import {
  Users as UsersIcon,
  Plus,
  Search,
  Shield,
  Building2,
  CheckCircle2,
  XCircle,
  Edit2,
  Loader2,
  Key,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { PageShell } from "../layout/PageShell";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { cn } from "../../lib/utils";
import { hasPermission } from "../../lib/permissions";
import { AccessProfilesManager } from "../settings/AccessProfilesManager";
import { AccessProfile } from "../../types";

type UserPayload = {
  nome: string;
  email: string;
  password?: string;
  cargo: string;
  telefone: string;
  empresa_id: number | null;
  administrador: boolean;
  desenvolvedor: boolean;
  perfil?: string;
  access_profile_id?: number | null;
};

interface UsersPageProps {
  currentUser: User;
}

export const UsersPage = ({ currentUser }: UsersPageProps) => {
  const [activeTab, setActiveTab] = useState<"users" | "profiles">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [accessProfiles, setAccessProfiles] = useState<AccessProfile[]>([]);
  const [companies, setCompanies] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [roleSelection, setRoleSelection] = useState<string>("profile:default");
  const [loadingSave, setLoadingSave] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const canViewProfiles = hasPermission(currentUser, "usuarios.ver_permissoes");
  const canManageProfiles = hasPermission(
    currentUser,
    "usuarios.gerenciar_permissoes",
  );
  const defaultAccessProfileId = accessProfiles.find((p) => p.nome === "Atendente")?.id
    || accessProfiles[0]?.id;

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [createProfileOpen, setCreateProfileOpen] = useState(false);

  const fetchAccessProfiles = async () => {
    if (!canViewProfiles) return;
    try {
      const profiles = await api.get<AccessProfile[]>("/access-profiles");
      setAccessProfiles(profiles);
    } catch {
      setAccessProfiles([]);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (searchTerm) query.append("search", searchTerm);
      if (statusFilter !== "todos") query.append("status", statusFilter);

      const [usersData, companiesData] = await Promise.all([
        api.get<User[]>(`/users?${query.toString()}`),
        currentUser.desenvolvedor
          ? api.get<Empresa[]>("/companies?status=ativo")
          : Promise.resolve([]),
      ]);
      setUsers(usersData);
      setCompanies(companiesData);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao carregar usuários.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccessProfiles();
  }, [canViewProfiles]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const resolveRolePayload = () => {
    if (roleSelection === "desenvolvedor") {
      return {
        perfil: "desenvolvedor",
        administrador: true,
        desenvolvedor: true,
        access_profile_id: null,
      };
    }
    if (roleSelection === "administrador") {
      return {
        perfil: "administrador",
        administrador: true,
        desenvolvedor: false,
        access_profile_id: null,
      };
    }
    const profileId = roleSelection.startsWith("profile:")
      ? Number(roleSelection.replace("profile:", ""))
      : defaultAccessProfileId;
    const profile = accessProfiles.find((p) => p.id === profileId);
    return {
      perfil: profile?.base_perfil || "atendente",
      administrador: false,
      desenvolvedor: false,
      access_profile_id: profileId || null,
    };
  };

  const handleSaveUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoadingSave(true);
    setSaveError(null);
    const formData = new FormData(e.currentTarget);

    try {
      const rolePayload = resolveRolePayload();
      const payload: UserPayload = {
        nome: String(formData.get("nome") || ""),
        email: String(formData.get("email") || ""),
        cargo: String(formData.get("cargo") || ""),
        telefone: String(formData.get("telefone") || ""),
        empresa_id: formData.get("empresa_id")
          ? Number(formData.get("empresa_id"))
          : null,
        ...rolePayload,
      };

      const password = formData.get("password") as string;
      if (password) {
        payload.password = password;
      }

      if (
        !selectedUser?.id &&
        (!payload.password || payload.password.length < 8)
      ) {
        setSaveError("A senha deve ter pelo menos 8 caracteres.");
        setLoadingSave(false);
        return;
      }

      if (selectedUser?.id) {
        await api.patch(`/users/${selectedUser.id}`, payload);
        showSuccess("Usuário atualizado com sucesso!");
      } else {
        await api.post("/users", payload);
        showSuccess("Usuário criado com sucesso!");
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao salvar usuário.";
      setSaveError(message);
    } finally {
      setLoadingSave(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedUser) return;
    setLoadingSave(true);
    setSaveError(null);
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirm_password") as string;

    if (password.length < 8) {
      setSaveError("A senha deve ter pelo menos 8 caracteres.");
      setLoadingSave(false);
      return;
    }

    if (password !== confirmPassword) {
      setSaveError("As senhas não coincidem.");
      setLoadingSave(false);
      return;
    }

    try {
      await api.patch(`/users/${selectedUser.id}/password`, { password });
      showSuccess("Senha alterada com sucesso!");
      setIsPasswordModalOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao alterar senha.";
      setSaveError(message);
    } finally {
      setLoadingSave(false);
    }
  };

  const toggleUserStatus = async () => {
    if (!selectedUser) return;
    try {
      await api.patch(`/users/${selectedUser.id}/status`, {
        ativo: !selectedUser.ativo,
      });
      showSuccess(
        `Usuário ${!selectedUser.ativo ? "ativado" : "desativado"} com sucesso!`,
      );
      fetchData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao alterar status.";
      setError(message);
    }
  };

  const getRoleSelectionForUser = (user: User) => {
    if (user.desenvolvedor || user.perfil === "desenvolvedor") return "desenvolvedor";
    if (user.administrador || user.perfil === "administrador") return "administrador";
    if (user.access_profile_id) return `profile:${user.access_profile_id}`;
    const legacyProfile = accessProfiles.find((p) => p.base_perfil === user.perfil);
    if (legacyProfile) return `profile:${legacyProfile.id}`;
    return defaultAccessProfileId ? `profile:${defaultAccessProfileId}` : "profile:default";
  };

  return (
    <>
      <PageShell
        title="Equipe"
        subtitle="Gerencie usuários, perfis de acesso e permissões da operação."
        actions={
          activeTab === "users" ? (
            <Button
              size="sm"
              onClick={() => {
                setSelectedUser(null);
                setRoleSelection(
                  defaultAccessProfileId
                    ? `profile:${defaultAccessProfileId}`
                    : "profile:default",
                );
                setSaveError(null);
                setIsModalOpen(true);
              }}
            >
              <Plus size={14} className="mr-2" /> Novo Usuário
            </Button>
          ) : canManageProfiles ? (
            <Button size="sm" onClick={() => setCreateProfileOpen(true)}>
              <Plus size={14} className="mr-2" /> Novo Perfil
            </Button>
          ) : undefined
        }
        flush
        contentClassName="flex flex-col h-full min-h-0"
        tabs={
          canViewProfiles ? (
            <div className="flex gap-1 py-3">
              <button
                onClick={() => setActiveTab("users")}
                className={cn(
                  "h-8 px-3 rounded-md text-xs font-medium transition-all",
                  activeTab === "users"
                    ? "bg-slate-100 text-slate-900 shadow-sm border border-slate-200/50"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50",
                )}
              >
                Colaboradores
              </button>
              <button
                onClick={() => setActiveTab("profiles")}
                className={cn(
                  "h-8 px-3 rounded-md text-xs font-medium transition-all",
                  activeTab === "profiles"
                    ? "bg-slate-100 text-slate-900 shadow-sm border border-slate-200/50"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50",
                )}
              >
                Perfis de Acesso
              </button>
            </div>
          ) : undefined
        }
      >
        {activeTab === "profiles" ? (
          <AccessProfilesManager
            currentUser={currentUser}
            createOpen={createProfileOpen}
            onCreateOpenChange={setCreateProfileOpen}
          />
        ) : (
          <>
        <div className="shrink-0 p-2 sm:p-3 border-b border-slate-100 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full group">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
              size={14}
            />
            <input
              type="text"
              placeholder="Buscar usuário..."
              className="w-full h-8 bg-slate-50 border border-slate-200 rounded-md pl-9 pr-4 text-xs font-medium text-slate-600 outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400 transition-all font-sans"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select
              size="sm"
              value={statusFilter}
              onChange={setStatusFilter}
              buttonClassName="h-8 text-xs font-medium w-full sm:w-40"
              options={[
                { value: "todos", label: "Todos os Status" },
                { value: "ativo", label: "Ativos" },
                { value: "inativo", label: "Inativos" },
              ]}
            />
          </div>
        </div>

        {successMsg && (
          <div className="mx-4 mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-600 text-xs font-bold animate-in fade-in slide-in-from-top-2">
            {successMsg}
          </div>
        )}

        {loading && users.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <p className="text-[11px] text-slate-500 font-medium">
              Carregando usuários...
            </p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center flex flex-col items-center">
            <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <UsersIcon size={20} />
            </div>
            <h3 className="text-[13px] font-semibold text-slate-900">
              Nenhum usuário encontrado
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
              Ajuste os filtros ou crie um novo colaborador.
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 text-left">
                    Usuário
                  </th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 text-left">
                    Empresa
                  </th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 text-left">
                    Status / Cargo
                  </th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => {
                  const isDev = !!user.desenvolvedor;
                  const canManage =
                    !!currentUser.desenvolvedor ||
                    (!!currentUser.administrador &&
                      !isDev &&
                      !!currentUser.empresa_id &&
                      user.empresa_id === currentUser.empresa_id);

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/50 transition-colors group"
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={cn(
                              "w-8 h-8 rounded-md flex items-center justify-center font-medium text-xs border",
                              user.ativo
                                ? "bg-slate-100 text-slate-700 border-slate-200"
                                : "bg-slate-50 text-slate-400 border-slate-100",
                            )}
                          >
                            {(user.nome || "U").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13px] font-medium text-slate-900 truncate">
                              {user.nome || "Usuário"}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {user.email || "Email não informado"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Building2 size={12} className="text-slate-400" />
                          <span className="text-xs font-medium text-slate-600 truncate max-w-[180px]">
                            {user.empresa_nome || "Gestifique Master"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant={user.ativo ? "emerald" : "slate"}
                            className="text-[10px] py-0 px-1.5 font-medium border-none"
                          >
                            {user.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                          <span className="text-[11px] font-medium text-slate-500">
                            {user.cargo || "Membro"}
                          </span>
                          {user.access_profile_nome && !user.desenvolvedor && !user.administrador && (
                            <Badge
                              variant="indigo"
                              className="text-[9px] py-0 px-1.5 font-medium border-none"
                            >
                              {user.access_profile_nome}
                            </Badge>
                          )}
                          {user.perfil === "desenvolvedor" && (
                            <Badge
                              variant="indigo"
                              className="text-[9px] py-0 px-1.5 font-medium border-none"
                            >
                              Dev
                            </Badge>
                          )}
                          {user.perfil === "administrador" && (
                            <Badge
                              variant="blue"
                              className="text-[9px] py-0 px-1.5 font-medium border-none"
                            >
                              Admin
                            </Badge>
                          )}
                          {user.perfil === "gestor" && !user.access_profile_nome && (
                            <Badge
                              variant="emerald"
                              className="text-[9px] py-0 px-1.5 font-medium border-none"
                            >
                              Gestor
                            </Badge>
                          )}
                          {user.perfil === "atendente" && !user.access_profile_nome && (
                            <Badge
                              variant="slate"
                              className="text-[9px] py-0 px-1.5 font-medium border-none"
                            >
                              Atend.
                            </Badge>
                          )}
                          {user.perfil === "cliente" && !user.access_profile_nome && (
                            <Badge
                              variant="slate"
                              className="bg-transparent border border-slate-200 text-slate-600 text-[9px] py-0 px-1.5 font-medium"
                            >
                              Cliente
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          {canManage ? (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedUser(user);
                                  setSaveError(null);
                                  setIsPasswordModalOpen(true);
                                }}
                                className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-all"
                                title="Alterar Senha"
                              >
                                <Key size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedUser(user);
                                  setRoleSelection(getRoleSelectionForUser(user));
                                  setSaveError(null);
                                  setIsModalOpen(true);
                                }}
                                className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-all"
                                title="Editar"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedUser(user);
                                  setIsStatusConfirmOpen(true);
                                }}
                                className={cn(
                                  "h-8 w-8 flex items-center justify-center rounded-lg transition-all",
                                  user.ativo
                                    ? "text-slate-400 hover:bg-red-50 hover:text-red-500"
                                    : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-500",
                                )}
                                title={user.ativo ? "Desativar" : "Ativar"}
                              >
                                {user.ativo ? (
                                  <XCircle size={14} />
                                ) : (
                                  <CheckCircle2 size={14} />
                                )}
                              </button>
                            </>
                          ) : (
                            <div
                              className="w-8 h-8 flex items-center justify-center text-slate-200"
                              title="Sem permissão"
                            >
                              <Shield size={14} />
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
          </>
        )}
      </PageShell>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedUser ? "Editar Usuário" : "Novo Usuário"}
        size="md"
      >
        <form onSubmit={handleSaveUser} className="space-y-4">
          {saveError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-xs font-medium mb-2">
              {saveError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                Nome Completo
              </label>
              <Input
                name="nome"
                defaultValue={selectedUser?.nome}
                required
                placeholder="Ex: João Silva"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                E-mail
              </label>
              <Input
                name="email"
                type="email"
                defaultValue={selectedUser?.email}
                required
                disabled={!!selectedUser}
                placeholder="joao@exemplo.com"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                Cargo
              </label>
              <Input
                name="cargo"
                defaultValue={selectedUser?.cargo || ""}
                placeholder="Ex: Analista de Suporte"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                Telefone
              </label>
              <Input
                name="telefone"
                defaultValue={selectedUser?.telefone || ""}
                placeholder="(00) 00000-0000"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              Perfil de Acesso
            </label>
            <Select
              value={roleSelection}
              onChange={setRoleSelection}
              buttonClassName="h-8 text-xs font-medium"
              options={[
                ...(currentUser.desenvolvedor
                  ? [{ value: "desenvolvedor", label: "Desenvolvedor (SaaS)" }]
                  : []),
                ...(currentUser.administrador || currentUser.desenvolvedor
                  ? [{ value: "administrador", label: "Administrador da Empresa" }]
                  : []),
                ...accessProfiles.map((profile) => ({
                  value: `profile:${profile.id}`,
                  label: profile.nome + (profile.sistema ? " (Padrão)" : ""),
                })),
              ]}
            />
            <p className="text-[11px] text-slate-500">
              O cargo é apenas exibição. As permissões vêm do perfil de acesso
              selecionado.
            </p>
          </div>

          {!!currentUser.desenvolvedor ? (
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                Empresa
              </label>
              <Select
                name="empresa_id"
                value={
                  selectedUser?.empresa_id
                    ? String(selectedUser.empresa_id)
                    : empresaId
                }
                onChange={setEmpresaId}
                disabled={!!selectedUser}
                placeholder="Gestifique Central"
                buttonClassName="h-8 text-xs font-medium"
                options={[
                  { value: "", label: "Gestifique Central" },
                  ...companies.map((c) => ({
                    value: String(c.id),
                    label: c.nome,
                  })),
                ]}
              />
            </div>
          ) : (
            !!currentUser.empresa_id && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  Empresa
                </label>
                <div className="h-8 bg-slate-50 border border-slate-200 rounded-md px-3 flex items-center text-xs font-medium text-slate-500 select-none">
                  {currentUser.empresa_nome || "Sua Empresa"}
                </div>
              </div>
            )
          )}

          {!selectedUser && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                Senha Inicial
              </label>
              <Input
                name="password"
                type="password"
                required
                placeholder="Mínimo 8 caracteres"
                className="h-8 text-xs"
              />
            </div>
          )}

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setIsModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={loadingSave} size="sm">
              {selectedUser ? "Salvar" : "Criar Conta"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        title="Alterar Senha"
        size="sm"
      >
        <form onSubmit={handleUpdatePassword} className="space-y-4">
          {saveError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-xs font-medium mb-2">
              {saveError}
            </div>
          )}
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Defina uma nova senha de acesso. Recomendamos o uso de caracteres
            especiais e números.
          </p>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                Nova Senha
              </label>
              <Input
                name="password"
                type="password"
                required
                placeholder="Mínimo 8 caracteres"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                Confirmar Senha
              </label>
              <Input
                name="confirm_password"
                type="password"
                required
                placeholder="Confirme a nova senha"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setIsPasswordModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={loadingSave}
              size="sm"
              variant="primary"
            >
              Confirmar
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={isStatusConfirmOpen}
        onClose={() => setIsStatusConfirmOpen(false)}
        onConfirm={toggleUserStatus}
        title={selectedUser?.ativo ? "Desativar Usuário?" : "Ativar Usuário?"}
        description={`Ao ${selectedUser?.ativo ? "desativar" : "ativar"}, o colaborador ${selectedUser?.nome || "selecionado"} ${selectedUser?.ativo ? "perderá" : "recuperará"} o acesso imediato ao sistema.`}
        confirmLabel={selectedUser?.ativo ? "Desativar" : "Ativar"}
        variant={selectedUser?.ativo ? "danger" : "info"}
      />

    </>
  );
};
