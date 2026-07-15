import React, { useState, useEffect } from "react";
import { api } from "../../lib/api";
import {
  Search,
  Calendar,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FilterX,
  Building2,
} from "lucide-react";
import { PageShell } from "../layout/PageShell";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Card } from "../ui/Card";
import { cn } from "../../lib/utils";
import { SystemLog } from "../../types";

type BadgeVariant =
  | "blue"
  | "emerald"
  | "amber"
  | "red"
  | "indigo"
  | "slate"
  | "orange";

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const LogsPage = () => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);

  // Filtros
  const [filters, setFilters] = useState({
    search: "",
    action: "",
    start_date: "",
    end_date: "",
    page: 1,
    limit: 15,
  });

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: filters.page.toString(),
        limit: filters.limit.toString(),
        search: filters.search,
        action: filters.action,
        start_date: filters.start_date,
        end_date: filters.end_date,
      });

      const response = await api.get<any>(`/logs?${queryParams.toString()}`);

      const items = Array.isArray(response.items)
        ? response.items
        : Array.isArray(response.data?.items)
          ? response.data.items
          : [];

      const paginationData =
        response.pagination || response.data?.pagination || null;

      setLogs(items);
      setPagination(paginationData);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao carregar logs.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchLogs();
    }, 300);
    return () => clearTimeout(debounce);
  }, [
    filters.search,
    filters.page,
    filters.action,
    filters.start_date,
    filters.end_date,
  ]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((f) => ({ ...f, page: 1 }));
    fetchLogs();
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      action: "",
      start_date: "",
      end_date: "",
      page: 1,
      limit: 15,
    });
  };

  const getActionColor = (acao?: string): BadgeVariant => {
    const action = acao || "";
    if (action.includes("CREATE")) return "emerald";
    if (action.includes("UPDATE")) return "blue";
    if (action.includes("DELETE")) return "red";
    if (action.includes("LOGIN")) return "indigo";
    if (action.includes("PASSWORD")) return "orange";
    return "slate";
  };

  return (
    <>
      <PageShell
        title="Logs do Sistema"
        subtitle="Acompanhe todas as atividades e operações realizadas na plataforma."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
          >
            <RefreshCw
              size={14}
              className={cn("mr-1.5", loading ? "animate-spin" : "")}
            />{" "}
            Sincronizar
          </Button>
        }
        flush
        contentClassName="flex flex-col h-full min-h-0"
      >
        <div className="shrink-0 p-3 bg-slate-50 border-b border-slate-100">
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="flex flex-col md:flex-row gap-2">
              <div className="relative flex-1 group">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors"
                  size={14}
                />
                <input
                  type="text"
                  placeholder="Buscar por descrição, usuário ou empresa..."
                  className="w-full h-8 bg-slate-50 border border-slate-200 rounded-md pl-9 pr-4 text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500 transition-all font-sans"
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, search: e.target.value }))
                  }
                />
              </div>
              <div className="flex gap-2">
                <Select
                  value={filters.action}
                  onChange={(value) =>
                    setFilters((f) => ({ ...f, action: value, page: 1 }))
                  }
                  className="min-w-[120px]"
                  buttonClassName="h-8 text-xs font-medium"
                  options={[
                    { value: "", label: "Ações" },
                    { value: "LOGIN", label: "Login" },
                    { value: "CREATE", label: "Criação" },
                    { value: "UPDATE", label: "Atualização" },
                    { value: "DELETE", label: "Exclusão" },
                    { value: "PROFILE_UPDATE", label: "Perfil" },
                    { value: "PASSWORD_CHANGE", label: "Senha" },
                  ]}
                />
                <Button type="submit" size="sm" className="h-8">
                  Filtrar
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-500">
                  Início
                </span>
                <input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      start_date: e.target.value,
                      page: 1,
                    }))
                  }
                  className="h-7 px-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium outline-none focus:ring-1 focus:ring-blue-400 transition-all text-slate-600"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-500">
                  Fim
                </span>
                <input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      end_date: e.target.value,
                      page: 1,
                    }))
                  }
                  className="h-7 px-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium outline-none focus:ring-1 focus:ring-blue-400 transition-all text-slate-600"
                />
              </div>
              <button
                type="button"
                onClick={clearFilters}
                className="h-7 px-2 flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-red-600 transition-colors ml-auto"
              >
                <FilterX size={12} /> Limpar
              </button>
            </div>
          </form>
        </div>

        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
          {loading && logs.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <p className="text-[11px] text-slate-500 font-medium">
                Sincronizando Auditoria...
              </p>
            </div>
          ) : error ? (
            <div className="p-10 text-center flex flex-col items-center">
              <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
              <p className="text-xs font-medium text-slate-600 mb-4">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchLogs}>
                Tentar Novamente
              </Button>
            </div>
          ) : (
            <>
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-500">
                      Ação
                    </th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-500">
                      Descrição
                    </th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-500">
                      Operador
                    </th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-500">
                      Data / IP
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Array.isArray(logs) &&
                    logs.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-slate-50/50 transition-colors group"
                      >
                        <td className="px-3 py-2">
                          <Badge
                            variant={getActionColor(log.acao)}
                            className="px-1.5 py-0 font-medium text-[9px]"
                          >
                            {log.acao || "SYSTEM"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 max-w-xs">
                          <div className="flex items-start gap-2">
                            <span className="text-xs font-medium text-slate-700 leading-normal line-clamp-2">
                              {log.descricao || "Registrado"}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "w-7 h-7 rounded-md flex items-center justify-center font-medium text-xs border",
                                log.usuario_nome
                                  ? "bg-slate-100 text-slate-700 border-slate-200"
                                  : "bg-slate-50 text-slate-400 border-slate-100",
                              )}
                            >
                              {(log.usuario_nome || "S")
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[13px] font-medium text-slate-900 leading-tight truncate">
                                {log.usuario_nome || "Sistema"}
                              </div>
                              <div className="text-[11px] font-medium text-slate-500 leading-tight flex items-center gap-1 mt-0.5">
                                <Building2 size={10} />{" "}
                                {log.empresa_nome || "Master"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium text-slate-600 flex items-center gap-1 whitespace-nowrap">
                              <Calendar size={12} className="text-slate-400" />{" "}
                              {log.created_at
                                ? new Date(log.created_at).toLocaleString(
                                    "pt-BR",
                                    {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "2-digit",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )
                                : "Data indisponível"}
                            </span>
                            <span className="text-[11px] font-medium text-slate-500 truncate">
                              {log.ip || "Local"}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 bg-slate-50 text-slate-300 rounded-lg flex items-center justify-center mb-3 border border-slate-100">
                            <Search size={18} />
                          </div>
                          <h3 className="text-[13px] font-semibold text-slate-900">
                            Nenhum log encontrado.
                          </h3>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Paginação */}
              {pagination && pagination.totalPages > 1 && (
                <div className="p-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500 font-medium">
                    {logs.length} / {pagination.total} registros
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={filters.page === 1}
                      onClick={() =>
                        setFilters((f) => ({ ...f, page: f.page - 1 }))
                      }
                      className="h-7 w-7 p-0 flex items-center justify-center"
                    >
                      <ChevronLeft size={14} />
                    </Button>

                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium text-slate-600 px-2">
                        Página {filters.page} de {pagination.totalPages}
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={filters.page === pagination.totalPages}
                      onClick={() =>
                        setFilters((f) => ({ ...f, page: f.page + 1 }))
                      }
                      className="h-7 w-7 p-0 flex items-center justify-center"
                    >
                      <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </PageShell>
    </>
  );
};
