import React, { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { Empresa, User } from "../../types";
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Phone,
  Ticket,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Target,
  XCircle,
  Trash2,
} from "lucide-react";
import { PageHeader } from "../ui/PageHeader";
import { Badge } from "../ui/Badge";
import { Modal } from "../ui/Modal";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { MetricCard } from "../ui/MetricCard";
import { Card } from "../ui/Card";
import { PageShell } from "../layout/PageShell";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import { isDeveloperUser } from "../../lib/permissions";

import { AccessDenied } from "../ui/AccessDenied";
import { EmailChannelsManager } from "../companies/EmailChannelsManager";

type CompanyPayload = {
  nome: string;
  cnpj: string;
  email: string;
  email_suporte: string;
  telefone: string;
  cor_principal: string;
  logo: string;
};

type BrasilApiCnpjResponse = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  email?: string;
  ddd_telefone_1?: string;
  ddd_telefone_2?: string;
  descricao_situacao_cadastral?: string;
  municipio?: string;
  uf?: string;
};

interface CompaniesPageProps {
  currentUser: User | null;
}

export const CompaniesPage = ({ currentUser }: CompaniesPageProps) => {
  const [companies, setCompanies] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Empresa | null>(null);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState("");
  const [loadingSave, setLoadingSave] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [createCnpj, setCreateCnpj] = useState("");
  const [validatedCompany, setValidatedCompany] =
    useState<BrasilApiCnpjResponse | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  const fetchCompanies = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (searchTerm) query.append("search", searchTerm);
      if (statusFilter !== "todos") query.append("status", statusFilter);

      const data = await api.get<Empresa[]>(`/companies?${query.toString()}`);
      setCompanies(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao carregar empresas.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCompanies();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const resetCreateFlow = () => {
    setCreateCnpj("");
    setValidatedCompany(null);
    setSaveError(null);
    setLoadingCnpj(false);
  };

  const onlyDigits = (value: string) => value.replace(/\D/g, "");

  const formatCnpj = (value: string) => {
    const digits = onlyDigits(value).slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };

  const formatPhone = (value?: string) => {
    const digits = onlyDigits(value || "");
    if (!digits) return "";
    if (digits.length <= 10) {
      return digits.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3").replace(/-$/, "");
    }
    return digits.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3").replace(/-$/, "");
  };

  const handleValidateCnpj = async () => {
    const cnpj = onlyDigits(createCnpj);
    setSaveError(null);
    setValidatedCompany(null);

    if (cnpj.length !== 14) {
      setSaveError("Informe um CNPJ válido com 14 dígitos.");
      return;
    }

    setLoadingCnpj(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!response.ok) {
        throw new Error("CNPJ não encontrado na Brasil API.");
      }

      const data = (await response.json()) as BrasilApiCnpjResponse;
      if (!data?.cnpj && !data?.razao_social) {
        throw new Error("Não foi possível validar este CNPJ.");
      }

      setValidatedCompany(data);
      setCreateCnpj(formatCnpj(data.cnpj || cnpj));
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Não foi possível validar o CNPJ. Tente novamente.";
      setSaveError(message);
    } finally {
      setLoadingCnpj(false);
    }
  };

  const handleSaveCompany = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoadingSave(true);
    setSaveError(null);
    const formData = new FormData(e.currentTarget);

    try {
      const payload: CompanyPayload = {
        nome: String(formData.get("nome") || ""),
        cnpj: String(formData.get("cnpj") || ""),
        email: String(formData.get("email") || ""),
        email_suporte: String(formData.get("email_suporte") || ""),
        telefone: String(formData.get("telefone") || ""),
        cor_principal: String(formData.get("cor_principal") || "#2563eb"),
        logo: String(formData.get("logo") || ""),
      };

      if (!selectedCompany && !validatedCompany) {
        setSaveError("Valide o CNPJ antes de criar a empresa.");
        setLoadingSave(false);
        return;
      }

      if (!payload.nome) {
        setSaveError("O nome da empresa é obrigatório.");
        setLoadingSave(false);
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (payload.email && !emailRegex.test(payload.email)) {
        setSaveError("E-mail institucional inválido.");
        setLoadingSave(false);
        return;
      }
      if (payload.email_suporte && !emailRegex.test(payload.email_suporte)) {
        setSaveError("E-mail de suporte inválido.");
        setLoadingSave(false);
        return;
      }

      const hexRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
      if (payload.cor_principal && !hexRegex.test(payload.cor_principal)) {
        setSaveError(
          "Cor principal deve ser um hexadecimal válido (ex: #2563eb).",
        );
        setLoadingSave(false);
        return;
      }

      if (selectedCompany?.id) {
        await api.patch(`/companies/${selectedCompany.id}`, payload);
      } else {
        await api.post("/companies", payload);
      }
      showSuccess(
        `Empresa ${selectedCompany?.id ? "atualizada" : "criada"} com sucesso!`,
      );
      setIsModalOpen(false);
      fetchCompanies();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao salvar empresa.";
      setSaveError(message);
    } finally {
      setLoadingSave(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedCompany) return;
    try {
      await api.patch(`/companies/${selectedCompany.id}/status`, {
        ativo: !selectedCompany.ativo,
      });
      showSuccess(
        `Empresa ${!selectedCompany.ativo ? "ativada" : "desativada"} com sucesso!`,
      );
      setIsStatusConfirmOpen(false);
      fetchCompanies();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao alterar status.";
      setError(message);
    }
  };

  const handleDeleteCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    if (deleteConfirmationName !== selectedCompany.nome) {
      setDeleteError("O nome digitado não corresponde ao nome da empresa.");
      return;
    }

    setLoadingDelete(true);
    setDeleteError(null);
    try {
      await api.delete(`/companies/${selectedCompany.id}`);
      showSuccess("Empresa e todos os dados foram excluídos permanentemente.");
      setIsDeleteConfirmOpen(false);
      fetchCompanies();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao excluir empresa.";
      setDeleteError(message);
    } finally {
      setLoadingDelete(false);
    }
  };

  const stats = {
    total: companies.length,
    ativas: companies.filter((c) => c.ativo).length,
    inativas: companies.filter((c) => !c.ativo).length,
    usuarios: companies.reduce(
      (acc, c) => acc + Number(c.total_usuarios || 0),
      0,
    ),
  };

  if (!isDeveloperUser(currentUser)) {
    return <AccessDenied />;
  }

  return (
    <>
      <PageShell
        title="Empresas Contratantes"
        subtitle="Gerencie as organizações que utilizam a plataforma e seus limites."
        actions={
          <Button
            size="sm"
            onClick={() => {
              setSelectedCompany(null);
              resetCreateFlow();
              setIsModalOpen(true);
            }}
          >
            <Plus size={14} className="mr-1.5" /> Nova Empresa
          </Button>
        }
        flush
        contentClassName="flex flex-col h-full min-h-0"
      >
        <div className="shrink-0 p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              label="Total de Empresas"
              value={stats.total.toString()}
              icon={<Building2 size={16} />}
              loading={loading && companies.length === 0}
              className="border-slate-50 shadow-none bg-white"
            />
            <MetricCard
              label="Empresas Ativas"
              value={stats.ativas.toString()}
              icon={<CheckCircle2 size={16} />}
              loading={loading && companies.length === 0}
              className="border-slate-50 shadow-none bg-white"
            />
            <MetricCard
              label="Empresas Inativas"
              value={stats.inativas.toString()}
              icon={<AlertCircle size={16} />}
              loading={loading && companies.length === 0}
              className="border-slate-50 shadow-none bg-white"
            />
            <MetricCard
              label="Total de Usuários"
              value={stats.usuarios.toString()}
              icon={<Users size={16} />}
              loading={loading && companies.length === 0}
              className="border-slate-50 shadow-none bg-white"
            />
          </div>
        </div>

        <div className="shrink-0 p-2 sm:p-3 border-b border-slate-100 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full group">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
              size={14}
            />
            <input
              type="text"
              placeholder="Buscar por nome ou CNPJ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-8 bg-slate-50 border border-slate-200 rounded-md pl-9 pr-4 text-xs font-medium text-slate-600 outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400 transition-all font-sans"
            />
          </div>
          <div className="flex bg-slate-100/50 p-1 rounded-md w-full sm:w-auto overflow-x-auto custom-scrollbar">
            {[
              { id: "todos", label: "Todas" },
              { id: "ativo", label: "Ativas" },
              { id: "inativo", label: "Inativas" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={cn(
                  "h-7 px-3 rounded text-[11px] font-medium transition-all flex-1 sm:flex-none whitespace-nowrap",
                  statusFilter === f.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {successMsg && (
          <div className="mx-4 mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-600 text-xs font-bold animate-in fade-in slide-in-from-top-2">
            {successMsg}
          </div>
        )}

        {loading && companies.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <p className="text-[11px] text-slate-500 font-medium">
              Carregando empresas...
            </p>
          </div>
        ) : error ? (
          <div className="p-10 text-center flex flex-col items-center">
            <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
            <p className="text-xs font-medium text-slate-600">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCompanies}
              className="mt-3"
            >
              Tentar novamente
            </Button>
          </div>
        ) : companies.length === 0 ? (
          <div className="p-10 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <Building2 size={24} />
            </div>
            <h3 className="text-[13px] font-semibold text-slate-900">
              Nenhuma empresa encontrada
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
              Crie sua primeira empresa cliente para começar.
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 text-left">
                    Empresa
                  </th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 text-left">
                    Metadados
                  </th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 text-left">
                    Engajamento
                  </th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companies.map((company) => (
                  <tr
                    key={company.id}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-md flex items-center justify-center shadow-sm border",
                            company.ativo
                              ? "bg-blue-50 text-blue-600 border-blue-100"
                              : "bg-slate-50 text-slate-400 border-slate-100",
                          )}
                        >
                          <Building2 size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-slate-900 truncate">
                            {company.nome || "Empresa"}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {company.email || "Email não informado"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                          <Target size={12} className="text-slate-400" />{" "}
                          {company.cnpj || "CNPJ não informado"}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                          <Phone size={12} className="text-slate-400" />{" "}
                          {company.telefone || "Telefone não informado"}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 min-w-[50px]">
                          <Users size={14} className="text-slate-400" />
                          <span className="text-[11px] font-medium text-slate-700">
                            {company.total_usuarios || 0}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 min-w-[50px]">
                          <Ticket size={14} className="text-slate-400" />
                          <span className="text-[11px] font-medium text-slate-700">
                            {company.total_tickets || 0}
                          </span>
                        </div>
                        <Badge
                          variant={company.ativo ? "emerald" : "slate"}
                          className="text-[10px] py-0 px-1.5 font-medium border-none"
                        >
                          {company.ativo ? "Ativa" : "Inativa"}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setSelectedCompany(company);
                            resetCreateFlow();
                            setSaveError(null);
                            setIsModalOpen(true);
                          }}
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-all font-sans"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedCompany(company);
                            setIsStatusConfirmOpen(true);
                          }}
                          className={cn(
                            "h-8 w-8 flex items-center justify-center rounded-lg transition-all",
                            company.ativo
                              ? "text-slate-400 hover:bg-red-50 hover:text-red-500"
                              : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-500",
                          )}
                        >
                          {company.ativo ? (
                            <XCircle size={14} />
                          ) : (
                            <CheckCircle2 size={14} />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedCompany(company);
                            setDeleteError(null);
                            setDeleteConfirmationName("");
                            setIsDeleteConfirmOpen(true);
                          }}
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all ml-1"
                          title="Excluir empresa permanentemente"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageShell>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          if (!selectedCompany) resetCreateFlow();
        }}
        title={selectedCompany ? "Configurar Empresa" : "Nova Empresa"}
        size="md"
      >
        <form onSubmit={handleSaveCompany} className="space-y-4">
          {saveError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-xs font-medium mb-2">
              {saveError}
            </div>
          )}

          {!selectedCompany && !validatedCompany && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-blue-600">
                    <Building2 size={16} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Validar empresa pelo CNPJ
                    </h4>
                    <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
                      Informe o CNPJ para buscar os dados públicos da empresa na Brasil API.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  CNPJ
                </label>
                <Input
                  value={createCnpj}
                  onChange={(event) => setCreateCnpj(formatCnpj(event.target.value))}
                  placeholder="00.000.000/0000-00"
                  className="h-8 text-xs"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleValidateCnpj}
                  loading={loadingCnpj}
                >
                  Validar CNPJ
                </Button>
              </div>
            </div>
          )}

          {!selectedCompany && validatedCompany && (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs font-medium text-emerald-700">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 size={14} />
                CNPJ validado com sucesso
              </div>
              <div className="mt-1 text-emerald-700/80">
                {validatedCompany.descricao_situacao_cadastral || "Dados encontrados na Brasil API"}
                {(validatedCompany.municipio || validatedCompany.uf) &&
                  ` • ${[validatedCompany.municipio, validatedCompany.uf].filter(Boolean).join(" / ")}`}
              </div>
            </div>
          )}

          {(selectedCompany || validatedCompany) && (
            <>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              Nome Fantasia / Razão Social
            </label>
            <Input
              name="nome"
              defaultValue={
                selectedCompany?.nome ||
                validatedCompany?.nome_fantasia ||
                validatedCompany?.razao_social ||
                ""
              }
              required
              placeholder="Ex: Minha Empresa LTDA"
              className="h-8 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">CNPJ</label>
              <Input
                name="cnpj"
                defaultValue={formatCnpj(
                  selectedCompany?.cnpj ||
                    validatedCompany?.cnpj ||
                    createCnpj ||
                    "",
                )}
                readOnly={!selectedCompany}
                placeholder="00.000.000/0000-00"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                Telefone Principal
              </label>
              <Input
                name="telefone"
                defaultValue={
                  selectedCompany?.telefone ||
                  formatPhone(
                    validatedCompany?.ddd_telefone_1 ||
                      validatedCompany?.ddd_telefone_2,
                  )
                }
                placeholder="(00) 00000-0000"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                E-mail Institucional
              </label>
              <Input
                name="email"
                type="email"
                defaultValue={selectedCompany?.email || validatedCompany?.email || ""}
                placeholder="contato@empresa.com"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                E-mail de Suporte
              </label>
              <Input
                name="email_suporte"
                type="email"
                defaultValue={selectedCompany?.email_suporte || validatedCompany?.email || ""}
                placeholder="suporte@empresa.com"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {!selectedCompany && (
            <>
              <input type="hidden" name="cor_principal" value="#2563eb" />
              <input type="hidden" name="logo" value="" />
            </>
          )}

          {selectedCompany && (
          <div className="pt-2">
            <h4 className="text-[11px] font-semibold text-slate-800 mb-3">
              Visual & Identidade
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  Cor Principal (Hex)
                </label>
                <Input
                  name="cor_principal"
                  defaultValue={selectedCompany?.cor_principal || "#2563eb"}
                  placeholder="#000000"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  URL da Logo
                </label>
                <Input
                  name="logo"
                  defaultValue={selectedCompany?.logo || ""}
                  placeholder="https://exemplo.com/logo.png"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
          )}

            </>
          )}

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                if (!selectedCompany) resetCreateFlow();
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={loadingSave}
              disabled={!selectedCompany && !validatedCompany}
              size="sm"
            >
              {selectedCompany ? "Salvar" : "Criar Empresa"}
            </Button>
          </div>
        </form>

        {selectedCompany && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <EmailChannelsManager empresaId={selectedCompany.id} />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={isStatusConfirmOpen}
        onClose={() => setIsStatusConfirmOpen(false)}
        onConfirm={handleToggleStatus}
        title={
          selectedCompany?.ativo ? "Desativar Empresa?" : "Ativar Empresa?"
        }
        description={`Ao ${selectedCompany?.ativo ? "desativar" : "ativar"}, a empresa ${selectedCompany?.nome || "selecionada"} e todos os seus usuários ${selectedCompany?.ativo ? "perderão" : "recuperarão"} o acesso.`}
        confirmLabel={selectedCompany?.ativo ? "Desativar" : "Ativar"}
        variant={selectedCompany?.ativo ? "danger" : "info"}
      />

      <Modal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        title="Excluir empresa permanentemente?"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3 text-red-800">
            <AlertCircle size={20} className="shrink-0 mt-0.5 text-red-600" />
            <div className="text-sm">
              <p className="font-bold mb-1 text-red-900">
                Esta ação não pode ser desfeita.
              </p>
              <p>
                Você está prestes a excluir permanentemente a empresa{" "}
                <strong>{selectedCompany?.nome}</strong>. Essa ação removerá
                todos os usuários, chamados, mensagens, anexos, configurações,
                automações, canais de e-mail e relatórios vinculados a esta
                empresa.
              </p>
            </div>
          </div>

          <form onSubmit={handleDeleteCompany} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Para confirmar, digite <strong>{selectedCompany?.nome}</strong>:
              </label>
              <Input
                value={deleteConfirmationName}
                onChange={(e) => setDeleteConfirmationName(e.target.value)}
                placeholder={selectedCompany?.nome}
                className="font-mono text-sm"
                autoComplete="off"
              />
              {deleteError && (
                <p className="text-xs font-semibold text-red-600 mt-1">
                  {deleteError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsDeleteConfirmOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="danger"
                loading={loadingDelete}
                disabled={deleteConfirmationName !== selectedCompany?.nome}
              >
                Excluir Empresa
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
};
