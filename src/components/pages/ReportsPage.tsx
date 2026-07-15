import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import {
  Download,
  Filter,
  RefreshCw,
  TrendingUp,
  Clock,
  Inbox,
  Activity,
  FileText,
  Printer,
} from "lucide-react";
import { motion } from "motion/react";
import { PageShell } from "../layout/PageShell";
import { SectionHeader } from "../ui/SectionHeader";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Select } from "../ui/Select";
import { LoadingState } from "../ui/LoadingState";
import { ErrorState } from "../ui/ErrorState";
import { EmptyState } from "../ui/EmptyState";
import { api } from "../../lib/api";
import { User } from "../../types";
import { useTicketOptions } from "../../hooks/useTicketOptions";

interface SummaryData {
  totals: {
    total_tickets: number;
    open_tickets: number;
    in_progress_tickets: number;
    resolved_tickets: number;
    closed_tickets: number;
    urgent_tickets: number;
    average_resolution_hours: number;
    average_first_response_hours: number;
    sla_compliance_first_response: number;
    sla_compliance_resolution: number;
    resolution_rate: number;
    reopen_rate: number;
  };
  csat: {
    average: number;
    total_reviews: number;
    score_distribution: { name: string; value: number }[];
  };
  by_status: { name: string; value: number }[];
  by_priority: { name: string; value: number }[];
  by_category: { name: string; value: number }[];
  by_service: { name: string; value: number }[];
  by_responsible: { name: string; value: number; avg_res?: number }[];
  by_origin: { name: string; value: number }[];
  by_day: { date: string; created: number; resolved: number }[];
  rankings: {
    top_agents: { name: string; value: number }[];
    top_categories: { name: string; value: number }[];
  };
}

interface DetailedTicket {
  id: number;
  titulo: string;
  status: string;
  prioridade: string;
  categoria: string;
  created_at: string;
  empresa_nome: string;
  cliente_nome: string;
  responsavel_nome: string;
}

interface DetailedReportData {
  metrics: {
    total: number;
    resolvidos: number;
    taxaResolucao: number;
  };
  tickets: DetailedTicket[];
}

type ReportsApiResponse =
  | SummaryData
  | { success?: boolean; data?: SummaryData; message?: string };

type CompanyOption = { id: number; nome: string };

interface ReportsPageProps {
  currentUser: User;
}

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#6366f1",
  "#ec4899",
  "#8b5cf6",
];
const SCORE_COLORS = [
  "#10b981",
  "#4ade80",
  "#fbbf24",
  "#f87171",
  "#ef4444",
].reverse();

export function ReportsPage({ currentUser }: ReportsPageProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SummaryData | null>(null);
  const [detailedReport, setDetailedReport] =
    useState<DetailedReportData | null>(null);
  const [filters, setFilters] = useState<{
    start_date: string;
    end_date: string;
    empresa_id: string;
    status: string;
    prioridade: string;
    responsavel_id: string;
    categoria: string;
    servico: string;
    origem: string;
  }>({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    end_date: new Date().toISOString().split("T")[0],
    empresa_id: "",
    status: "",
    prioridade: "",
    responsavel_id: "",
    categoria: "",
    servico: "",
    origem: "",
  });
  const [companies, setCompanies] = useState<CompanyOption[]>([]);

  const { categories, services } = useTicketOptions(
    Number(filters.empresa_id) || currentUser.empresa_id || 0,
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (currentUser.desenvolvedor && !filters.empresa_id) {
      setData(null);
      setDetailedReport(null);
      setError("Selecione uma empresa para carregar relatórios.");
      setLoading(false);
      return;
    }

    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, String(value));
      });

      const response = await api.get<ReportsApiResponse>(
        `/reports/summary?${queryParams.toString()}`,
      );

      let reportData: SummaryData | null = null;
      if (response) {
        if ("totals" in response) {
          reportData = response;
        } else if ("data" in response && response.data) {
          reportData = response.data;
        }
      }

      if (reportData && reportData.totals) {
        setData(reportData);
      } else {
        setError("Resposta do servidor inválida ou vazia.");
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Erro ao carregar dados do relatório.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [filters, currentUser.desenvolvedor]);

  const handleGenerateReport = async () => {
    if (currentUser.desenvolvedor && !filters.empresa_id) {
      setError("Selecione uma empresa para gerar o relatório.");
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const report = await api.post<DetailedReportData>(
        "/reports/generate",
        filters,
      );
      setDetailedReport(report);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Erro ao gerar relatório detalhado.";
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    fetchData();

    if (!!currentUser.desenvolvedor) {
      api
        .get<CompanyOption[] | { data: CompanyOption[] }>("/companies")
        .then((res) => {
          const list = Array.isArray(res)
            ? res
            : Array.isArray(res?.data)
              ? res.data
              : [];
          setCompanies(list);
          if (list.length > 0) {
            setFilters((current) =>
              current.empresa_id ? current : { ...current, empresa_id: String(list[0].id) },
            );
          }
        })
        .catch(() => {});
    }
  }, [fetchData, !!currentUser.desenvolvedor]);

  const handleExportCSV = async (type: string) => {
    try {
      if (currentUser.desenvolvedor && !filters.empresa_id) {
        setError("Selecione uma empresa para exportar relatórios.");
        return;
      }

      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, String(value));
      });
      params.append("type", type);

      const url = `/api/reports/export?${params.toString()}`;
      window.open(url, "_blank");
    } catch (err) {
      console.error("Erro ao exportar", err);
      alert("Erro ao exportar relatório. Verifique os logs.");
    } finally {
      setDropdownOpen(false);
    }
  };

  if (loading && !data && !filters.start_date) {
    return <LoadingState message="Processando métricas gerenciais..." />;
  }

  return (
    <PageShell
      title="Relatórios Avançados"
      subtitle="Analise métricas, SLAs e desempenho da operação."
      actions={
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
            className="print:hidden h-8 sm:h-9"
          >
            <Printer size={16} className="mr-2" />{" "}
            <span className="hidden sm:inline">Imprimir</span>
          </Button>
          <div className="relative print:hidden">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="h-8 sm:h-9"
            >
              <Download size={16} className="mr-2" />{" "}
              <span className="hidden sm:inline">Exportar</span>
            </Button>
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 shadow-lg rounded-lg overflow-hidden py-1 z-50">
                <button
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm text-slate-700"
                  onClick={() => handleExportCSV("tickets")}
                >
                  Chamados detalhados
                </button>
                <button
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm text-slate-700"
                  onClick={() => handleExportCSV("agents")}
                >
                  Atendentes
                </button>
                <button
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm text-slate-700"
                  onClick={() => handleExportCSV("satisfaction")}
                >
                  Satisfação (CSAT)
                </button>
              </div>
            )}
          </div>
          <Button
            size="sm"
            onClick={fetchData}
            className="print:hidden h-8 sm:h-9"
          >
            <RefreshCw
              size={16}
              className={`mr-2 ${loading ? "animate-spin" : ""}`}
            />{" "}
            Atualizar
          </Button>
        </div>
      }
    >
      <div className="space-y-5 pb-6">
        {/* Filters Container */}
        <Card className="p-3 sm:p-4 bg-slate-50/50 border-slate-200 print:hidden shadow-sm">
          <div className="flex items-center gap-1.5 mb-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
            <Filter size={14} /> Filtros de Análise
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-0.5">
                Período
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  className="flex-1 min-w-0 bg-white border border-slate-300 rounded-md px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none transition-all h-8"
                  value={filters.start_date}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, start_date: e.target.value }))
                  }
                />
                <input
                  type="date"
                  className="flex-1 min-w-0 bg-white border border-slate-300 rounded-md px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none transition-all h-8"
                  value={filters.end_date}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, end_date: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-0.5">
                Prioridade
              </label>
              <Select
                buttonClassName="w-full h-8 text-xs font-medium bg-white border-slate-300 rounded-md"
                value={filters.prioridade}
                onChange={(value) =>
                  setFilters((f) => ({ ...f, prioridade: value }))
                }
                options={[
                  { value: "", label: "Todas" },
                  { value: "baixa", label: "Baixa" },
                  { value: "media", label: "Média" },
                  { value: "alta", label: "Alta" },
                  { value: "urgente", label: "Urgente" },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-0.5">
                Status
              </label>
              <Select
                buttonClassName="w-full h-8 text-xs font-medium bg-white border-slate-300 rounded-md"
                value={filters.status}
                onChange={(value) =>
                  setFilters((f) => ({ ...f, status: value }))
                }
                options={[
                  { value: "", label: "Todos" },
                  { value: "aberto", label: "Aberto" },
                  { value: "em_andamento", label: "Em Andamento" },
                  { value: "aguardando_cliente", label: "Aguardando Cliente" },
                  { value: "resolvido", label: "Resolvido" },
                  { value: "fechado", label: "Fechado" },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-0.5">
                Origem
              </label>
              <Select
                buttonClassName="w-full h-8 text-xs font-medium bg-white border-slate-300 rounded-md"
                value={filters.origem}
                onChange={(value) =>
                  setFilters((f) => ({ ...f, origem: value }))
                }
                options={[
                  { value: "", label: "Todas" },
                  { value: "email", label: "E-mail" },
                  { value: "portal", label: "Portal do Cliente" },
                  { value: "interno", label: "Interno" },
                  { value: "whatsapp", label: "WhatsApp" },
                ]}
              />
            </div>
            {!!currentUser.desenvolvedor && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-0.5">
                  Empresa
                </label>
                <Select
                  buttonClassName="w-full h-8 text-xs font-medium bg-white border-slate-300 rounded-md text-left truncate"
                  value={filters.empresa_id}
                  onChange={(value) =>
                    setFilters((f) => ({ ...f, empresa_id: value }))
                  }
                  options={[
                    { value: "", label: "Selecione" },
                    ...companies.map((c) => ({
                      value: String(c.id),
                      label: c.nome,
                    })),
                  ]}
                />
              </div>
            )}
          </div>
        </Card>

        {error && (
          <ErrorState
            title="Erro ao carregar relatórios"
            message={error}
            onRetry={fetchData}
          />
        )}

        {data && (
          <div className="space-y-5 animate-in fade-in duration-500">
            {/* Main Indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <IndicatorCard
                title="Chamados criados"
                value={data.totals.total_tickets}
                icon={<Inbox />}
                color="blue"
                trend={`${data.totals.resolution_rate}% resolvidos`}
              />
              <IndicatorCard
                title="T.M. Resolução"
                value={`${data.totals.average_resolution_hours}h`}
                icon={<Clock />}
                color="emerald"
                trend="Média operacional"
              />
              <IndicatorCard
                title="T.M. 1ª Resposta"
                value={`${data.totals.average_first_response_hours}h`}
                icon={<Activity />}
                color="indigo"
                trend={`SLA: ${data.totals.sla_compliance_first_response}%`}
              />
              <IndicatorCard
                title="CSAT Médio"
                value={data.csat.average > 0 ? data.csat.average : "N/A"}
                icon={<TrendingUp />}
                color="amber"
                trend={`${data.csat.total_reviews} avaliações`}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <SectionHeader
                title="Métricas de Compromisso (SLA)"
                description="Performance operacional"
                className="col-span-1 lg:col-span-3 mb-0 mt-2"
              />
              {/* SLA Compliance Section */}
              <Card className="p-4 col-span-1 lg:col-span-2 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
                    Compliance de SLA
                  </h3>
                  <Badge variant="blue" className="text-[10px]">
                    Meta: 95%
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-semibold text-slate-600">
                        Primeira Resposta
                      </span>
                      <span
                        className={`text-xl font-bold ${data.totals.sla_compliance_first_response >= 90 ? "text-emerald-600" : "text-orange-500"}`}
                      >
                        {data.totals.sla_compliance_first_response}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${data.totals.sla_compliance_first_response}%`,
                        }}
                        className={`h-full ${data.totals.sla_compliance_first_response >= 90 ? "bg-emerald-500" : "bg-orange-500"}`}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Percentual de chamados com primeira resposta pública
                      dentro do prazo.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-semibold text-slate-600">
                        Resolução Final
                      </span>
                      <span
                        className={`text-xl font-bold ${data.totals.sla_compliance_resolution >= 90 ? "text-emerald-600" : "text-orange-500"}`}
                      >
                        {data.totals.sla_compliance_resolution}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${data.totals.sla_compliance_resolution}%`,
                        }}
                        className={`h-full ${data.totals.sla_compliance_resolution >= 90 ? "bg-emerald-500" : "bg-orange-500"}`}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Percentual de chamados resolvidos respeitando o prazo
                      total da política.
                    </p>
                  </div>
                </div>
              </Card>

              {/* Reopen Rate & Stability */}
              <Card className="p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <div className="w-1 h-4 bg-purple-500 rounded-full"></div>
                  Volume de Backlog
                </h3>
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs font-medium text-slate-600">
                        Taxa de Reabertura
                      </span>
                      <span className="text-sm font-bold text-slate-700">
                        {data.totals.reopen_rate}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500"
                        style={{ width: `${data.totals.reopen_rate}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="text-[10px] font-semibold text-blue-600 mb-0.5">
                        Abertos
                      </div>
                      <div className="text-lg font-bold text-blue-700">
                        {data.totals.open_tickets}
                      </div>
                    </div>
                    <div className="p-2.5 bg-red-50 rounded-lg border border-red-100">
                      <div className="text-[10px] font-semibold text-red-600 mb-0.5">
                        Urgentes
                      </div>
                      <div className="text-lg font-bold text-red-700">
                        {data.totals.urgent_tickets}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <SectionHeader
                title="Insights Temporais"
                description="Distribuição e análise temporal"
                className="col-span-1 xl:col-span-2 mb-0 mt-4"
              />
              {/* Time Graph */}
              <Card className="p-4 lg:p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
                  Fluxo diario de chamados
                </h3>
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.by_day}>
                      <defs>
                        <linearGradient
                          id="colorCreated"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#3b82f6"
                            stopOpacity={0.1}
                          />
                          <stop
                            offset="95%"
                            stopColor="#3b82f6"
                            stopOpacity={0}
                          />
                        </linearGradient>
                        <linearGradient
                          id="colorResolved"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#10b981"
                            stopOpacity={0.1}
                          />
                          <stop
                            offset="95%"
                            stopColor="#10b981"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#E2E8F0"
                      />
                      <XAxis
                        dataKey="date"
                        fontSize={10}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) =>
                          val.split("-").slice(1).reverse().join("/")
                        }
                      />
                      <YAxis fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "none",
                          boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                        }}
                      />
                      <Legend />
                      <Area
                        name="Criados"
                        type="monotone"
                        dataKey="created"
                        stroke="#3b82f6"
                        fillOpacity={1}
                        fill="url(#colorCreated)"
                        strokeWidth={2}
                      />
                      <Area
                        name="Resolvidos"
                        type="monotone"
                        dataKey="resolved"
                        stroke="#10b981"
                        fillOpacity={1}
                        fill="url(#colorResolved)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* CSAT Distribution */}
              <Card className="p-4 lg:p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <div className="w-1 h-4 bg-amber-500 rounded-full"></div>
                  Satisfação do Cliente (CSAT)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.csat.score_distribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {data.csat.score_distribution.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={SCORE_COLORS[index % SCORE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col justify-center space-y-4">
                    <div className="text-center md:text-left">
                      <div className="text-2xl font-bold text-slate-900">
                        {data.csat.average}
                      </div>
                      <div className="text-xs font-semibold text-slate-500 mb-2">
                        Média Geral
                      </div>
                      <div className="flex justify-center md:justify-start gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <div
                            key={star}
                            className={`w-4 h-4 rounded-full ${star <= Math.round(data.csat.average) ? "bg-amber-400" : "bg-slate-200"}`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {data.csat.score_distribution
                        .slice(0, 3)
                        .map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between"
                          >
                            <span className="text-xs text-slate-500">
                              {item.name}
                            </span>
                            <span className="text-xs font-semibold text-slate-900">
                              {item.value}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <SectionHeader
                title="Distribuição e Topografia"
                description="Análise por classificação e atendente"
                className="col-span-1 md:col-span-2 lg:col-span-3 mb-0 mt-4"
              />
              <Card className="p-4 lg:col-span-2 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <div className="w-1 h-4 bg-emerald-600 rounded-full"></div>
                  Performance por Atendente
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 font-mono">
                        <th className="pb-2 text-[10px] font-semibold text-slate-500 uppercase">
                          Atendente
                        </th>
                        <th className="pb-2 text-[10px] font-semibold text-slate-500 uppercase text-center">
                          Volume
                        </th>
                        <th className="pb-2 text-[10px] font-semibold text-slate-500 uppercase text-center">
                          T.M.R.
                        </th>
                        <th className="pb-2 text-[10px] font-semibold text-slate-500 uppercase text-right">
                          Participação
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.by_responsible.length > 0 ? (
                        data.by_responsible.slice(0, 10).map((item, idx) => (
                          <tr
                            key={idx}
                            className="group hover:bg-slate-50/50 transition-colors"
                          >
                            <td className="py-2.5 text-xs font-semibold text-slate-700">
                              {item.name}
                            </td>
                            <td className="py-2.5 text-sm font-bold text-slate-700 text-center">
                              {item.value}
                            </td>
                            <td className="py-2.5 text-xs font-semibold text-emerald-600 text-center">
                              {item.avg_res}h
                            </td>
                            <td className="py-2.5 text-right">
                              <div className="inline-flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                  <div
                                    className="h-full bg-blue-600"
                                    style={{
                                      width: `${(item.value / Math.max(1, data.totals.total_tickets)) * 100}%`,
                                    }}
                                  ></div>
                                </div>
                                <span className="text-[10px] font-semibold text-slate-500">
                                  {(
                                    (item.value /
                                      Math.max(1, data.totals.total_tickets)) *
                                    100
                                  ).toFixed(0)}
                                  %
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={4}
                            className="py-8 text-center text-xs text-slate-400 font-medium"
                          >
                            Nenhum dado por atendente.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              <div className="space-y-6">
                <Card className="p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <div className="w-1 h-4 bg-orange-500 rounded-full"></div>
                    Top Categorias
                  </h3>
                  <div className="space-y-3">
                    {data.rankings.top_categories.map((cat, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between"
                      >
                        <div className="flex gap-3 items-center">
                          <span className="text-[10px] font-semibold text-slate-400">
                            {idx + 1}º
                          </span>
                          <span className="text-xs font-medium text-slate-700">
                            {cat.name}
                          </span>
                        </div>
                        <Badge
                          variant="orange"
                          className="font-mono text-[10px] px-1.5"
                        >
                          {cat.value}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-4">
                  <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                    Volume por Origem
                  </h3>
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.by_origin}
                          dataKey="value"
                          innerRadius={40}
                          outerRadius={60}
                          paddingAngle={5}
                        >
                          {data.by_origin.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend
                          wrapperStyle={{
                            fontSize: "10px",
                            fontWeight: "bold",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            </div>

            <div className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <SectionHeader
                  title="Listagem Detalhada"
                  description="Auditoria de registros"
                  className="mb-0"
                />
                <Button
                  onClick={handleGenerateReport}
                  disabled={generating}
                  size="sm"
                  className="shadow-lg shadow-blue-100"
                >
                  {generating ? (
                    <RefreshCw className="mr-2 animate-spin" size={16} />
                  ) : (
                    <FileText className="mr-2" size={16} />
                  )}
                  {detailedReport
                    ? "Recarregar Listagem"
                    : "Gerar Listagem Detalhada"}
                </Button>
              </div>

              {detailedReport && (
                <div className="animate-in slide-in-from-top duration-500">
                  <Card className="overflow-hidden bg-white border-slate-200">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-2.5 text-[10px] uppercase font-semibold text-slate-500">
                              ID
                            </th>
                            <th className="px-4 py-2.5 text-[10px] uppercase font-semibold text-slate-500">
                              Título / Categoria
                            </th>
                            {!!currentUser.desenvolvedor && (
                              <th className="px-4 py-2.5 text-[10px] uppercase font-semibold text-slate-500">
                                Empresa
                              </th>
                            )}
                            <th className="px-4 py-2.5 text-[10px] uppercase font-semibold text-slate-500">
                              Status
                            </th>
                            <th className="px-4 py-2.5 text-[10px] uppercase font-semibold text-slate-500">
                              Responsável
                            </th>
                            <th className="px-4 py-2.5 text-[10px] uppercase font-semibold text-slate-500">
                              Criação
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {detailedReport.tickets.length > 0 ? (
                            detailedReport.tickets.map((t) => (
                              <tr
                                key={t.id}
                                className="hover:bg-slate-50/50 transition-colors"
                              >
                                <td className="px-4 py-2.5 text-xs font-semibold text-blue-600">
                                  #{t.id}
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="text-xs font-semibold text-slate-700">
                                    {t.titulo}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    {t.categoria}
                                  </div>
                                </td>
                                {!!currentUser.desenvolvedor && (
                                  <td className="px-4 py-2.5 text-[11px] text-slate-600">
                                    {t.empresa_nome}
                                  </td>
                                )}
                                <td className="px-4 py-2.5">
                                  <Badge
                                    variant={
                                      t.status === "resolvido"
                                        ? "emerald"
                                        : t.status === "aberto"
                                          ? "blue"
                                          : "slate"
                                    }
                                    className="text-[10px] py-0 px-1.5"
                                  >
                                    {t.status.replace("_", " ")}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2.5 text-[11px] text-slate-600">
                                  {t.responsavel_nome || "Não atribuído"}
                                </td>
                                <td className="px-4 py-2.5 text-[11px] text-slate-500">
                                  {new Date(t.created_at).toLocaleDateString()}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="px-4 py-8">
                                <EmptyState
                                  icon={<FileText size={20} />}
                                  title="Nenhum chamado"
                                  description="Nenhum registro encontrado para a extração."
                                />
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function IndicatorCard({
  title,
  value,
  icon,
  color,
  trend,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  trend?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "text-blue-600 bg-blue-50 border-blue-100",
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
    indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
    amber: "text-amber-600 bg-amber-50 border-amber-100",
    red: "text-red-600 bg-red-50 border-red-100",
  };

  return (
    <Card className="p-3 relative overflow-hidden group hover:shadow-md transition-all border-slate-200">
      <div
        className={`w-7 h-7 rounded-md mb-2 flex items-center justify-center ${colorMap[color]}`}
      >
        {React.cloneElement(icon as React.ReactElement<any>, { size: 14 })}
      </div>
      <div className="space-y-0.5">
        <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </p>
        <p className="text-xl font-bold text-slate-800 tracking-tight leading-none">
          {value}
        </p>
        {trend && (
          <p className="text-[10px] font-medium text-slate-500">{trend}</p>
        )}
      </div>
    </Card>
  );
}
