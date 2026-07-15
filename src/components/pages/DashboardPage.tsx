import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Building,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ShieldCheck,
  Ticket as TicketIcon,
  TimerReset,
  User as UserIcon,
} from "lucide-react";
import { api } from "../../lib/api";
import { DashboardData, Empresa, Ticket, User } from "../../types";
import { PageShell } from "../layout/PageShell";
import { MetricCard } from "../ui/MetricCard";
import { Card, CardHeader } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { LoadingState } from "../ui/LoadingState";
import { ErrorState } from "../ui/ErrorState";
import { EmptyState } from "../ui/EmptyState";
import {
  compactDateFormatter,
  priorityToBadgeVariant,
  statusToBadgeVariant,
} from "../../lib/utils";
import { cn } from "../../lib/utils";
import { hasPermission } from "../../lib/permissions";

interface DashboardPageProps {
  currentUser: User;
  onNavigate?: (
    tab:
      | "dashboard"
      | "tickets"
      | "users"
      | "companies"
      | "logs"
      | "profile"
      | "settings",
  ) => void;
}

type ChartRow = {
  label: string;
  value: number;
};

const numberFormatter = new Intl.NumberFormat("pt-BR");
const dateFormatter = new Intl.DateTimeFormat("pt-BR");

const toNumber = (value: unknown) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCount = (value: unknown) => numberFormatter.format(toNumber(value));

const formatHours = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "Sem dados";
  }

  const hours = Number(value);
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${hours.toFixed(1).replace(".", ",")} h`;
  return `${(hours / 24).toFixed(1).replace(".", ",")} d`;
};

const statusLabel = (status: string) =>
  status
    ? status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
    : "Sem status";

const priorityLabel = (priority: string) => {
  const labels: Record<string, string> = {
    urgente: "Urgente",
    alta: "Alta",
    media: "Média",
    baixa: "Baixa",
    sem_prioridade: "Sem prioridade",
  };
  return labels[priority] || statusLabel(priority);
};

const todayInputValue = () => new Date().toISOString().slice(0, 10);

const daysAgoInputValue = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

const periodLabel = (period: string, from?: string, to?: string) => {
  const labels: Record<string, string> = {
    month: "Mês atual",
    "7d": "Últimos 7 dias",
    "30d": "Últimos 30 dias",
    "90d": "Últimos 90 dias",
    custom: "Período personalizado",
  };

  if (period === "custom" && from && to) {
    return `${dateFormatter.format(new Date(`${from}T00:00:00`))} a ${dateFormatter.format(new Date(`${to}T00:00:00`))}`;
  }

  return labels[period] || labels.month;
};

const normalizeRows = <T extends Record<string, unknown>>(
  rows: T[] | undefined,
  labelKey: keyof T,
  valueKey: keyof T,
  labelFormatter: (value: string) => string = statusLabel,
): ChartRow[] =>
  (rows || [])
    .map((row) => ({
      label: labelFormatter(String(row[labelKey] || "")),
      value: toNumber(row[valueKey]),
    }))
    .filter((row) => row.value > 0);

const BarList = ({
  title,
  icon,
  rows,
  tone = "blue",
}: {
  title: string;
  icon: React.ReactNode;
  rows: ChartRow[];
  tone?: "blue" | "emerald" | "amber" | "red" | "slate" | "indigo";
}) => {
  const max = Math.max(...rows.map((row) => row.value), 0);
  const toneClass = {
    blue: "bg-blue-600",
    emerald: "bg-emerald-600",
    amber: "bg-amber-500",
    red: "bg-red-600",
    slate: "bg-slate-600",
    indigo: "bg-indigo-600",
  }[tone];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500">
            {icon}
          </div>
          <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        </div>
      </CardHeader>
      <div className="space-y-3 p-4">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs font-medium text-slate-500">
            Sem dados suficientes para este recorte.
          </div>
        ) : (
          rows.map((row) => {
            const width = max > 0 ? Math.max(8, Math.round((row.value / max) * 100)) : 0;
            return (
              <div key={row.label} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-semibold text-slate-700">{row.label}</span>
                  <span className="font-bold text-slate-900">{formatCount(row.value)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn("h-full rounded-full", toneClass)}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};

export const DashboardPage = ({ currentUser, onNavigate }: DashboardPageProps) => {
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("month");
  const [dateFrom, setDateFrom] = useState(daysAgoInputValue(29));
  const [dateTo, setDateTo] = useState(todayInputValue());
  const [companyId, setCompanyId] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [companies, setCompanies] = useState<Empresa[]>([]);
  const [agents, setAgents] = useState<User[]>([]);

  const canFilterCompanies = currentUser.desenvolvedor;
  const canFilterResponsavel =
    currentUser.desenvolvedor ||
    currentUser.administrador ||
    hasPermission(currentUser, "relatorios.ver_todos_usuarios");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ period });
        if (period === "custom") {
          if (dateFrom) params.set("from", dateFrom);
          if (dateTo) params.set("to", dateTo);
        }
        if (canFilterCompanies && companyId) params.set("empresa_id", companyId);
        if (canFilterResponsavel && responsavelId) params.set("responsavel_id", responsavelId);

        const data = await api.get<DashboardData>(`/dashboard/summary?${params.toString()}`);
        setStats(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Ocorreu um erro ao carregar o dashboard.",
        );
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [period, dateFrom, dateTo, companyId, responsavelId, canFilterCompanies, canFilterResponsavel]);

  useEffect(() => {
    if (!canFilterCompanies) return;
    api.get<Empresa[]>("/companies").then(setCompanies).catch(() => setCompanies([]));
  }, [canFilterCompanies]);

  useEffect(() => {
    if (!canFilterResponsavel) return;
    api
      .get<User[]>("/users?status=ativo")
      .then((users) => {
        const filtered = companyId
          ? users.filter((user) => Number(user.empresa_id) === Number(companyId))
          : users;
        setAgents(filtered.filter((user) => user.ativo));
      })
      .catch(() => setAgents([]));
  }, [canFilterResponsavel, companyId]);

  const recentTickets = stats?.recentTickets || [];
  const chamadosAtivos = stats?.chamadosAtivos || 0;
  const vencidos = stats?.slaAtrasados || 0;
  const vencendoHoje = stats?.vencendoHoje || 0;
  const resolvidosPeriodo = stats?.resolvidosMes || 0;
  const slaCumprido = stats?.slaCumprido || 0;
  const slaViolado = stats?.slaViolado || 0;
  const slaTotal = slaCumprido + slaViolado;
  const slaCumpridoPercent = slaTotal > 0 ? Math.round((slaCumprido / slaTotal) * 100) : 0;

  const statusRows = useMemo(
    () => normalizeRows(stats?.byStatus, "status", "qtd", statusLabel),
    [stats?.byStatus],
  );
  const priorityRows = useMemo(
    () => normalizeRows(stats?.byPriority, "prioridade", "qtd", priorityLabel),
    [stats?.byPriority],
  );
  const responsavelRows = useMemo(
    () => normalizeRows(stats?.byResponsavel, "responsavel", "qtd", (value) => value || "Sem responsável"),
    [stats?.byResponsavel],
  );
  const backlogRows = useMemo(
    () => normalizeRows(stats?.backlogPorIdade, "faixa", "qtd", (value) => value),
    [stats?.backlogPorIdade],
  );
  const displayedPeriod = periodLabel(
    stats?.filters?.period || period,
    stats?.filters?.from || (period === "custom" ? dateFrom : undefined),
    stats?.filters?.to || (period === "custom" ? dateTo : undefined),
  );

  if (error) {
    return (
      <ErrorState message={error} onRetry={() => window.location.reload()} />
    );
  }

  return (
    <PageShell
      title="Visão operacional"
      subtitle="Acompanhe a saúde da operação, gargalos de SLA e produtividade do atendimento."
      flush
    >
      <div className="w-full space-y-4 p-3 sm:p-5">
        <Card className="overflow-visible">
          <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500">
                <CalendarDays size={16} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Recorte da operação</h3>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  Recorte atual: <span className="font-semibold text-slate-700">{displayedPeriod}</span>
                </p>
              </div>
            </div>

            <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-none lg:auto-cols-[180px] lg:grid-flow-col">
              <Select
                size="sm"
                value={period}
                onChange={setPeriod}
                options={[
                  { value: "month", label: "Mês atual" },
                  { value: "7d", label: "Últimos 7 dias" },
                  { value: "30d", label: "Últimos 30 dias" },
                  { value: "90d", label: "Últimos 90 dias" },
                  { value: "custom", label: "Personalizado" },
                ]}
                buttonClassName="h-9 bg-slate-50 border-slate-200"
              />

              {period === "custom" && (
                <>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    aria-label="Data inicial do dashboard"
                  />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    aria-label="Data final do dashboard"
                  />
                </>
              )}

              {canFilterCompanies && (
                <Select
                  size="sm"
                  value={companyId}
                  onChange={(value) => {
                    setCompanyId(value);
                    setResponsavelId("");
                  }}
                  placeholder="Todas empresas"
                  options={[
                    { value: "", label: "Todas empresas" },
                    ...companies.map((company) => ({
                      value: String(company.id),
                      label: company.nome,
                    })),
                  ]}
                  buttonClassName="h-9 bg-slate-50 border-slate-200"
                />
              )}

              {canFilterResponsavel && (
                <Select
                  size="sm"
                  value={responsavelId}
                  onChange={setResponsavelId}
                  placeholder="Todos responsáveis"
                  options={[
                    { value: "", label: "Todos responsáveis" },
                    ...agents.map((agent) => ({
                      value: String(agent.id),
                      label: agent.nome,
                    })),
                  ]}
                  buttonClassName="h-9 bg-slate-50 border-slate-200"
                />
              )}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            compact
            label="Chamados abertos"
            value={formatCount(chamadosAtivos)}
            icon={<TicketIcon size={16} />}
            color="blue"
            loading={loading}
          />
          <MetricCard
            compact
            label="Vencidos"
            value={formatCount(vencidos)}
            icon={<AlertCircle size={16} />}
            color="red"
            loading={loading}
          />
          <MetricCard
            compact
            label="Vencendo hoje"
            value={formatCount(vencendoHoje)}
            icon={<Clock3 size={16} />}
            color="amber"
            loading={loading}
          />
          <MetricCard
            compact
            label="Resolvidos no período"
            value={formatCount(resolvidosPeriodo)}
            icon={<CheckCircle2 size={16} />}
            color="emerald"
            loading={loading}
          />
          <MetricCard
            compact
            label="Primeira resposta média"
            value={formatHours(stats?.tempoMedioPrimeiraRespostaHoras)}
            icon={<TimerReset size={16} />}
            color="indigo"
            loading={loading}
          />
          <MetricCard
            compact
            label="Resolução média"
            value={formatHours(stats?.tempoMedioResolucaoHoras)}
            icon={<Clock3 size={16} />}
            color="slate"
            loading={loading}
          />
          <MetricCard
            compact
            label="SLA cumprido"
            value={formatCount(slaCumprido)}
            icon={<ShieldCheck size={16} />}
            color="emerald"
            loading={loading}
          />
          <MetricCard
            compact
            label="SLA violado"
            value={formatCount(slaViolado)}
            icon={<AlertCircle size={16} />}
            color="red"
            loading={loading}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-slate-200 px-4 py-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-blue-700">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">Controle de SLA</h3>
                    <p className="text-xs font-medium text-slate-500">Baseado nos chamados com status de SLA registrado.</p>
                  </div>
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {slaTotal > 0 ? `${slaCumpridoPercent}% cumprido` : "Sem dados"}
                </div>
              </div>
            </CardHeader>
            <div className="space-y-4 p-4">
              <div className="h-3 overflow-hidden rounded-full bg-rose-100">
                <div
                  className="h-full rounded-full bg-emerald-600"
                  style={{ width: `${slaTotal > 0 ? slaCumpridoPercent : 0}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                  <div className="text-xs font-semibold text-emerald-700">Cumpridos</div>
                  <div className="mt-1 text-2xl font-bold text-emerald-900">{formatCount(slaCumprido)}</div>
                </div>
                <div className="rounded-lg border border-red-100 bg-red-50 p-3">
                  <div className="text-xs font-semibold text-red-700">Violados</div>
                  <div className="mt-1 text-2xl font-bold text-red-900">{formatCount(slaViolado)}</div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-slate-200 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">Escopo monitorado</h3>
                  <p className="text-xs font-medium text-slate-500">Escopo atual da conta.</p>
                </div>
                <Building size={18} className="text-slate-400" />
              </div>
            </CardHeader>
            <div className="grid grid-cols-2 gap-3 p-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-500">Usuários ativos</div>
                <div className="mt-1 text-xl font-bold text-slate-950">{formatCount(stats?.totalUsuarios)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-500">Empresas</div>
                <div className="mt-1 text-xl font-bold text-slate-950">
                  {stats?.totalEmpresas !== undefined ? formatCount(stats.totalEmpresas) : "-"}
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          <BarList title="Backlog por idade" icon={<Clock3 size={16} />} rows={backlogRows} tone="red" />
          <BarList title="Chamados por status" icon={<BarChart3 size={16} />} rows={statusRows} tone="blue" />
          <BarList title="Chamados por prioridade" icon={<AlertCircle size={16} />} rows={priorityRows} tone="amber" />
          <BarList title="Chamados por responsável" icon={<UserIcon size={16} />} rows={responsavelRows} tone="indigo" />
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Chamados recentes</h3>
              <p className="text-xs font-medium text-slate-500">Últimas entradas registradas no suporte.</p>
            </div>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onNavigate?.("tickets")}
              className="h-8 text-[11px] font-bold"
            >
              Ver todos <ChevronRight size={14} />
            </Button>
          </CardHeader>
          <div className="divide-y divide-slate-100">
            {loading ? (
              <LoadingState compact message="Carregando chamados recentes..." />
            ) : recentTickets.length > 0 ? (
              recentTickets.map((ticket: Ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => onNavigate?.("tickets")}
                  className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-colors group-hover:border-blue-200 group-hover:text-blue-600">
                    <TicketIcon size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">
                        {ticket.titulo}
                      </span>
                      <Badge
                        variant={statusToBadgeVariant(ticket.status || "")}
                        className="h-5 shrink-0 text-[9px]"
                      >
                        {ticket.status?.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500">
                      <span className="font-bold text-slate-600">#{ticket.id}</span>
                      <span>{compactDateFormatter(ticket.created_at)}</span>
                      <span className="truncate">{ticket.cliente_nome || "Solicitante não informado"}</span>
                      {ticket.responsavel_nome && <span className="truncate">Resp. {ticket.responsavel_nome}</span>}
                    </div>
                  </div>
                  <Badge
                    variant={priorityToBadgeVariant(ticket.prioridade || "")}
                    className="hidden shrink-0 text-[9px] uppercase sm:inline-flex"
                  >
                    {ticket.prioridade}
                  </Badge>
                </button>
              ))
            ) : (
              <EmptyState
                compact
                title="Sem chamados recentes"
                description="Quando novos chamados entrarem, eles aparecerão aqui."
                icon={<TicketIcon size={20} />}
                action={{
                  label: "Ir para chamados",
                  onClick: () => onNavigate?.("tickets"),
                }}
              />
            )}
          </div>
        </Card>
      </div>
    </PageShell>
  );
};
