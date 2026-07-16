import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Building2, CalendarDays, CheckCircle2,
  Clock3, RefreshCw, Search, Target, UsersRound,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { ErrorState } from '../ui/ErrorState';
import { LoadingState } from '../ui/LoadingState';
import { MetricCard } from '../ui/MetricCard';
import { PageShell } from '../layout/PageShell';

type Totals = { completed: number; pending: number; total: number };
type ResponsibleStat = Totals & {
  name: string;
  completionRate: number;
  municipalities: string[];
  municipalityCount: number;
};
interface DashboardData {
  year: number;
  totalMunicipalities: number;
  totalTasks: number;
  completed: number;
  pending: number;
  completionRate: number;
  statusCounts: Record<string, number>;
  obligationStats: Record<string, Totals>;
  obligationCompetenceStats: Record<string, Record<string, Omit<Totals, 'total'>>>;
  municipalityStats: Record<string, Totals>;
  competenceStats: Record<string, Totals>;
  responsibleStats: ResponsibleStat[];
  overdue: {
    total: number;
    byObligation: Record<string, number>;
    byMunicipality: Record<string, number>;
    byResponsible: Record<string, number>;
  };
  updatedAt: string;
}

const SERVICES = [
  { code: 'MSC', label: 'Matriz de Saldos Contábeis', color: '#2563eb' },
  { code: 'RREO', label: 'Execução Orçamentária', color: '#0891b2' },
  { code: 'RGF', label: 'Gestão Fiscal', color: '#7c3aed' },
  { code: 'DCA', label: 'Contas Anuais', color: '#d97706' },
  { code: 'SIOPE', label: 'Educação', color: '#059669' },
  { code: 'SIOPS', label: 'Saúde', color: '#e11d48' },
] as const;
const STATUS_META: Record<string, { color: string; className: string }> = {
  'Falta XML': { color: '#dc2626', className: 'border-red-200 bg-red-50 text-red-700' },
  'Não iniciado': { color: '#64748b', className: 'border-slate-200 bg-slate-50 text-slate-700' },
  'Pendência Cliente': { color: '#d97706', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  Trabalhando: { color: '#2563eb', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  Retificar: { color: '#ea580c', className: 'border-orange-200 bg-orange-50 text-orange-700' },
  Enviado: { color: '#7c3aed', className: 'border-violet-200 bg-violet-50 text-violet-700' },
  Homologado: { color: '#059669', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
};
const compactNumber = new Intl.NumberFormat('pt-BR');
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function percentage(completed: number, total: number) {
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

function Progress({ value, color = 'bg-blue-600' }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-label={`${value}% concluído`}>
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

function RankingList({ data, emptyText }: { data: Record<string, number>; emptyText: string }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (rows.length === 0) return <p className="py-5 text-center text-xs text-slate-400">{emptyText}</p>;
  const max = rows[0]?.[1] || 1;
  return (
    <div className="space-y-3">
      {rows.map(([label, value]) => (
        <div key={label}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
            <span className="truncate font-medium text-slate-700" title={label}>{label}</span>
            <span className="font-semibold tabular-nums text-slate-950">{value}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-rose-500" style={{ width: `${(value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ObligationsDashboardPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [periods, setPeriods] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api.get<DashboardData>(`/obligations/dashboard?year=${year}`));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os indicadores.');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { void load(); }, [load]);

  const statusChart = useMemo(() => Object.entries(data?.statusCounts || {}).map(([name, value]) => ({
    name, value, color: STATUS_META[name]?.color || '#94a3b8',
  })), [data]);
  const obligationChart = useMemo(() => SERVICES.map(({ code }) => ({
    name: code,
    concluídas: data?.obligationStats[code]?.completed || 0,
    pendentes: data?.obligationStats[code]?.pending || 0,
  })), [data]);
  const municipalityChart = useMemo(() => Object.entries(data?.municipalityStats || {})
    .sort((a, b) => b[1].pending - a[1].pending || b[1].total - a[1].total)
    .slice(0, 10)
    .map(([name, stats]) => ({ name, concluídas: stats.completed, pendentes: stats.pending })), [data]);
  const filteredPeople = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return (data?.responsibleStats || []).filter((item) => item.name.toLocaleLowerCase('pt-BR').includes(query));
  }, [data, search]);
  const bestPerformer = useMemo(() => [...(data?.responsibleStats || [])]
    .sort((a, b) => b.completionRate - a.completionRate || b.total - a.total)[0], [data]);
  const largestPortfolio = useMemo(() => [...(data?.responsibleStats || [])]
    .sort((a, b) => b.municipalityCount - a.municipalityCount || b.total - a.total)[0], [data]);

  if (loading && !data) return <LoadingState className="h-full" message="Consolidando obrigações e indicadores..." />;
  if (error && !data) return <ErrorState className="h-full" message={error} onRetry={() => void load()} />;
  if (!data) return null;

  return (
    <PageShell
      actions={<><label className="flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600"><CalendarDays size={14} /> Exercício<select value={year} onChange={(event) => setYear(Number(event.target.value))} className="bg-transparent font-semibold text-slate-950 outline-none">{Array.from({ length: 5 }, (_, index) => currentYear + 1 - index).map((option) => <option key={option}>{option}</option>)}</select></label><Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw size={13} className={cn(loading && 'animate-spin')} />Atualizar</Button></>}
      contentClassName="bg-slate-50/40"
    >
      <div className="mx-auto w-full max-w-[1680px] space-y-4">

        {error ? <ErrorState compact message={error} onRetry={() => void load()} /> : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard compact label="Municípios monitorados" value={compactNumber.format(data.totalMunicipalities)} icon={<Building2 />} color="blue" />
          <MetricCard compact label="Competências no exercício" value={compactNumber.format(data.totalTasks)} icon={<Target />} color="indigo" />
          <MetricCard compact label={`${compactNumber.format(data.completed)} entregas concluídas`} value={`${data.completionRate}%`} icon={<CheckCircle2 />} color="emerald" />
          <MetricCard compact label="Competências vencidas" value={compactNumber.format(data.overdue.total)} icon={<AlertTriangle />} color={data.overdue.total ? 'red' : 'emerald'} />
        </div>

        <Card className={cn(data.overdue.total > 0 && 'border-rose-200')}>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2"><Clock3 size={16} className={data.overdue.total ? 'text-rose-600' : 'text-emerald-600'} />Controle de vencimentos</CardTitle>
              <CardDescription>Prazo considerado: último dia do mês seguinte ao período de competência.</CardDescription>
            </div>
            <span className={cn('rounded-md border px-2.5 py-1 text-xs font-semibold', data.overdue.total ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700')}>
              {data.overdue.total ? `${data.overdue.total} em atraso` : 'Tudo em dia'}
            </span>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-3">
            <div><p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Por serviço</p><RankingList data={data.overdue.byObligation} emptyText="Nenhum serviço vencido" /></div>
            <div><p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Municípios críticos</p><RankingList data={data.overdue.byMunicipality} emptyText="Nenhum município crítico" /></div>
            <div><p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Por responsável</p><RankingList data={data.overdue.byResponsible} emptyText="Nenhuma pendência atribuída" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Desempenho por serviço</CardTitle>
            <CardDescription>Selecione uma competência em cada serviço para analisar o recorte desejado.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {SERVICES.map((service) => {
              const options = data.obligationCompetenceStats[service.code] || {};
              const selected = periods[service.code] || 'Todos';
              const stats = selected === 'Todos'
                ? data.obligationStats[service.code] || { completed: 0, pending: 0, total: 0 }
                : { ...(options[selected] || { completed: 0, pending: 0 }), total: (options[selected]?.completed || 0) + (options[selected]?.pending || 0) };
              const rate = percentage(stats.completed, stats.total);
              return (
                <div key={service.code} className="rounded-lg border border-slate-200 p-3.5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div><p className="text-sm font-semibold text-slate-950">{service.code}</p><p className="truncate text-[11px] font-medium text-slate-500">{service.label}</p></div>
                    <select value={selected} onChange={(event) => setPeriods((current) => ({ ...current, [service.code]: event.target.value }))} className="max-w-[145px] rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 outline-none focus:border-blue-400">
                      <option>Todos</option>{Object.keys(options).map((period) => <option key={period}>{period}</option>)}
                    </select>
                  </div>
                  <div className="mb-2 flex items-end justify-between"><span className="text-2xl font-semibold tracking-tight text-slate-950">{rate}%</span><span className="text-[11px] text-slate-500"><b className="text-emerald-600">{stats.completed}</b> concluídas · <b className="text-amber-600">{stats.pending}</b> pendentes</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${rate}%`, backgroundColor: service.color }} /></div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <CardHeader><CardTitle>Distribuição por status</CardTitle><CardDescription>Situação atual das competências.</CardDescription></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
                {statusChart.map((item) => <div key={item.name} className={cn('rounded-md border px-3 py-2', STATUS_META[item.name]?.className)}><p className="text-lg font-semibold tabular-nums">{item.value}</p><p className="truncate text-[11px] font-medium">{item.name}</p></div>)}
              </div>
              <div className="mt-3 h-52">
                <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusChart} dataKey="value" nameKey="name" innerRadius={48} outerRadius={76} paddingAngle={2}>{statusChart.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /><Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Entregas por obrigação</CardTitle><CardDescription>Comparativo entre competências concluídas e pendentes.</CardDescription></CardHeader>
            <CardContent className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={obligationChart} margin={{ left: -18, right: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip /><Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="concluídas" stackId="total" fill="#10b981" radius={[0, 0, 3, 3]} /><Bar dataKey="pendentes" stackId="total" fill="#f59e0b" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><CardTitle className="flex items-center gap-2"><UsersRound size={16} className="text-blue-600" />Desempenho da equipe</CardTitle><CardDescription>Volume executado, carteira atendida e eficiência individual.</CardDescription></div>
            <label className="flex h-8 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 sm:w-64"><Search size={13} className="text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar responsável" className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400" /></label>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Maior eficiência</p><p className="mt-1 truncate text-sm font-semibold text-slate-950">{bestPerformer?.name || 'Sem dados'}</p><p className="text-xs text-emerald-700">{bestPerformer?.completionRate || 0}% de conclusão</p></div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">Maior carteira</p><p className="mt-1 truncate text-sm font-semibold text-slate-950">{largestPortfolio?.name || 'Sem dados'}</p><p className="text-xs text-blue-700">{largestPortfolio?.municipalityCount || 0} municípios atendidos</p></div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Capacidade monitorada</p><p className="mt-1 text-sm font-semibold text-slate-950">{data.responsibleStats.length} responsáveis</p><p className="text-xs text-slate-500">{data.responsibleStats.length ? Math.round(data.totalTasks / data.responsibleStats.length) : 0} competências por pessoa</p></div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%"><ComposedChart data={filteredPeople.slice(0, 12)} margin={{ left: -18, right: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-18} textAnchor="end" height={55} /><YAxis yAxisId="count" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis yAxisId="rate" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip /><Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} /><Bar yAxisId="count" dataKey="completed" name="Concluídas" fill="#2563eb" radius={[3, 3, 0, 0]} /><Bar yAxisId="count" dataKey="pending" name="Pendentes" fill="#cbd5e1" radius={[3, 3, 0, 0]} /><Line yAxisId="rate" dataKey="completionRate" name="Eficiência (%)" stroke="#059669" strokeWidth={2} dot={{ r: 2 }} /></ComposedChart></ResponsiveContainer>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2.5 font-semibold">Responsável</th><th className="px-3 py-2.5 font-semibold">Municípios</th><th className="px-3 py-2.5 text-right font-semibold">Total</th><th className="px-3 py-2.5 text-right font-semibold">Concluídas</th><th className="px-3 py-2.5 text-right font-semibold">Pendentes</th><th className="w-44 px-3 py-2.5 font-semibold">Eficiência</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{filteredPeople.map((person) => <tr key={person.name} className="hover:bg-slate-50/70"><td className="px-3 py-2.5 font-semibold text-slate-900">{person.name}</td><td className="px-3 py-2.5 text-slate-500" title={person.municipalities.join(', ')}>{person.municipalityCount} municípios</td><td className="px-3 py-2.5 text-right tabular-nums">{person.total}</td><td className="px-3 py-2.5 text-right font-medium tabular-nums text-emerald-700">{person.completed}</td><td className="px-3 py-2.5 text-right font-medium tabular-nums text-amber-700">{person.pending}</td><td className="px-3 py-2.5"><div className="mb-1 flex justify-between"><span className="text-slate-500">Conclusão</span><b>{person.completionRate}%</b></div><Progress value={person.completionRate} color="bg-emerald-500" /></td></tr>)}</tbody>
              </table>
              {filteredPeople.length === 0 ? <p className="py-8 text-center text-xs text-slate-400">Nenhum responsável encontrado.</p> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Municípios com maior volume pendente</CardTitle><CardDescription>Dez carteiras que exigem mais atenção no exercício selecionado.</CardDescription></CardHeader>
          <CardContent className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={municipalityChart} layout="vertical" margin={{ left: 30, right: 12 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" /><XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip /><Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="concluídas" stackId="total" fill="#10b981" /><Bar dataKey="pendentes" stackId="total" fill="#f59e0b" radius={[0, 3, 3, 0]} /></BarChart></ResponsiveContainer>
          </CardContent>
        </Card>

        <p className="text-right text-[10px] font-medium text-slate-400">Atualizado em {dateTime.format(new Date(data.updatedAt))}</p>
      </div>
    </PageShell>
  );
}
