import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CalendarCheck,
  CalendarClock, CalendarDays, CheckCircle2, ChevronRight, CircleDashed, Clock3,
  ExternalLink, Filter, ListChecks, RefreshCw, Search, ShieldCheck, X,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { PageShell } from '../layout/PageShell';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { ErrorState } from '../ui/ErrorState';
import { FilterChip } from '../ui/FilterChip';
import { LoadingState } from '../ui/LoadingState';
import { Select } from '../ui/Select';

type DeadlineSituation = 'overdue' | 'today' | 'soon' | 'scheduled' | 'completed';
type SortKey = 'dueDate' | 'priority' | 'status' | 'updatedAt';
type SortDirection = 'asc' | 'desc';
type Totals = { completed: number; pending: number; total: number };

interface TaskItem {
  id: number;
  municipalityId: number;
  municipalityName: string;
  obligationCode: string;
  competence: string;
  year: number;
  status: string;
  dueDate: string;
  updatedAt: string;
  lastEditorName: string | null;
  completedAt: string | null;
  completedOnTime: boolean | null;
  deadlineSituation: DeadlineSituation;
  stale: boolean;
  blocked: boolean;
}

interface DashboardData {
  year: number;
  totalMunicipalities: number;
  totalTasks: number;
  completed: number;
  pending: number;
  completionRate: number;
  statusCounts: Record<string, number>;
  obligationStats: Record<string, Totals>;
  overdue: { total: number };
  taskItems: TaskItem[];
  onTime: { count: number; sampleSize: number; rate: number | null };
  previousPeriod: {
    year: number; totalTasks: number; completed: number; overdue: number; completionRate: number;
  } | null;
  updatedAt: string;
}

interface FiltersState {
  year: number;
  search: string;
  status: string;
  category: string;
  deadline: string;
}

const STORAGE_KEY = 'portalmeta.obligations.dashboard.filters.v2';
const OPEN_TASK_KEY = 'portalmeta.obligations.openTask';
const COMPLETED_STATUSES = new Set(['Enviado', 'Homologado']);
const STATUS_OPTIONS = ['Falta XML', 'Não iniciado', 'Pendência Cliente', 'Trabalhando', 'Retificar', 'Enviado', 'Homologado'];
const CATEGORY_OPTIONS = ['MSC', 'RREO', 'RGF', 'DCA', 'SIOPE', 'SIOPS'];
const STATUS_COLORS: Record<string, string> = {
  'Falta XML': '#dc2626', 'Não iniciado': '#64748b', 'Pendência Cliente': '#d97706',
  Trabalhando: '#2563eb', Retificar: '#ea580c', Enviado: '#7c3aed', Homologado: '#059669',
};
const STATUS_CLASSES: Record<string, string> = {
  'Falta XML': 'border-rose-200 bg-rose-50 text-rose-700',
  'Não iniciado': 'border-slate-200 bg-slate-100 text-slate-700',
  'Pendência Cliente': 'border-amber-200 bg-amber-50 text-amber-800',
  Trabalhando: 'border-blue-200 bg-blue-50 text-blue-700',
  Retificar: 'border-orange-200 bg-orange-50 text-orange-700',
  Enviado: 'border-violet-200 bg-violet-50 text-violet-700',
  Homologado: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};
const deadlineLabels: Record<string, string> = {
  overdue: 'Vencidas', today: 'Vencem hoje', soon: 'Próximos 7 dias',
  scheduled: 'Prazo futuro', completed: 'Concluídas', onTime: 'Concluídas no prazo',
};
const numberFormat = new Intl.NumberFormat('pt-BR');
const shortDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'America/Sao_Paulo' });

function monthKeyInSaoPaulo(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}`;
}

function readFilters(currentYear: number): FiltersState {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
    return {
      year: Number.isInteger(parsed.year) ? parsed.year : currentYear,
      search: typeof parsed.search === 'string' ? parsed.search : '',
      status: typeof parsed.status === 'string' ? parsed.status : 'all',
      category: typeof parsed.category === 'string' ? parsed.category : 'all',
      deadline: typeof parsed.deadline === 'string' ? parsed.deadline : 'all',
    };
  } catch {
    return { year: currentYear, search: '', status: 'all', category: 'all', deadline: 'all' };
  }
}

function priorityOf(task: TaskItem) {
  if (task.deadlineSituation === 'overdue') return 4;
  if (task.deadlineSituation === 'today' || task.blocked) return 3;
  if (task.deadlineSituation === 'soon' || task.stale) return 2;
  return 1;
}

function PriorityBadge({ task }: { task: TaskItem }) {
  const priority = priorityOf(task);
  const meta = priority === 4
    ? { label: 'Crítica', className: 'border-rose-200 bg-rose-50 text-rose-700' }
    : priority === 3
      ? { label: 'Alta', className: 'border-orange-200 bg-orange-50 text-orange-700' }
      : priority === 2
        ? { label: 'Média', className: 'border-amber-200 bg-amber-50 text-amber-800' }
        : { label: 'Normal', className: 'border-slate-200 bg-slate-50 text-slate-600' };
  return <span className={cn('inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold', meta.className)}>{meta.label}</span>;
}

function deadlineMeta(task: TaskItem) {
  if (task.deadlineSituation === 'overdue') return { label: `Vencida em ${shortDate.format(new Date(task.dueDate))}`, className: 'text-rose-700', icon: AlertTriangle };
  if (task.deadlineSituation === 'today') return { label: 'Vence hoje', className: 'text-amber-800', icon: Clock3 };
  if (task.deadlineSituation === 'soon') return { label: `Vence em breve · ${shortDate.format(new Date(task.dueDate))}`, className: 'text-amber-700', icon: CalendarClock };
  if (task.deadlineSituation === 'completed') return { label: `Prazo ${shortDate.format(new Date(task.dueDate))}`, className: 'text-slate-500', icon: CalendarCheck };
  return { label: `Vence em ${shortDate.format(new Date(task.dueDate))}`, className: 'text-slate-600', icon: CalendarDays };
}

function MetricButton({ label, value, icon: Icon, tone, hint, comparison, active, onClick }: {
  label: string; value: string | number; icon: React.ElementType; tone: 'neutral' | 'danger' | 'warning' | 'success';
  hint: string; comparison?: string | null; active?: boolean; onClick: () => void;
}) {
  const tones = {
    neutral: 'border-slate-200 bg-slate-50 text-slate-700',
    danger: 'border-rose-200 bg-rose-50 text-rose-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
  return (
    <button
      type="button"
      title={hint}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'group min-h-[108px] rounded-lg border bg-white p-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        active && 'border-blue-400 ring-2 ring-blue-100',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-md border', tones[tone])}><Icon size={14} aria-hidden="true" /></span>
        {comparison ? <span className="text-[10px] font-semibold text-slate-500">{comparison}</span> : null}
      </div>
      <strong className="mt-2.5 block text-xl font-semibold leading-none tracking-tight text-slate-950 tabular-nums">{value}</strong>
      <span className="mt-1.5 block text-[11px] font-semibold leading-tight text-slate-600">{label}</span>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={cn('inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold', STATUS_CLASSES[status] || STATUS_CLASSES['Não iniciado'])}>{status}</span>;
}

function SortButton({ label, column, sort, direction, onSort }: {
  label: string; column: SortKey; sort: SortKey; direction: SortDirection; onSort: (key: SortKey) => void;
}) {
  const active = sort === column;
  const Icon = active ? (direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return <button type="button" onClick={() => onSort(column)} className="inline-flex items-center gap-1 rounded px-1 py-1 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label={`Ordenar por ${label}`}><span>{label}</span><Icon size={11} aria-hidden="true" /></button>;
}

export function ObligationsDashboardPage({ onNavigate }: { onNavigate: (tab: 'obligations-spreadsheet') => void }) {
  const currentYear = new Date().getFullYear();
  const initial = useMemo(() => readFilters(currentYear), [currentYear]);
  const [filters, setFilters] = useState<FiltersState>(initial);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<SortKey>('dueDate');
  const [direction, setDirection] = useState<SortDirection>('asc');
  const [visibleCount, setVisibleCount] = useState(10);
  const deferredSearch = useDeferredValue(filters.search.trim().toLocaleLowerCase('pt-BR'));

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      setData(await api.get<DashboardData>(`/obligations/dashboard?year=${filters.year}`));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os indicadores.');
    } finally { setLoading(false); }
  }, [filters.year]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters)); }, [filters]);
  useEffect(() => { setVisibleCount(10); }, [filters, sort, direction]);

  const updateFilter = <K extends keyof FiltersState>(key: K, value: FiltersState[K]) => setFilters((current) => ({ ...current, [key]: value }));
  const clearFilters = () => setFilters((current) => ({ ...current, search: '', status: 'all', category: 'all', deadline: 'all' }));
  const hasActiveFilters = Boolean(filters.search || filters.status !== 'all' || filters.category !== 'all' || filters.deadline !== 'all');

  const filteredTasks = useMemo(() => (data?.taskItems || []).filter((task) => {
    const haystack = `${task.municipalityName} ${task.obligationCode} ${task.competence} ${task.status} ${task.lastEditorName || ''}`.toLocaleLowerCase('pt-BR');
    if (deferredSearch && !haystack.includes(deferredSearch)) return false;
    if (filters.category !== 'all' && task.obligationCode !== filters.category) return false;
    if (filters.status === 'completed' && !COMPLETED_STATUSES.has(task.status)) return false;
    if (filters.status !== 'all' && filters.status !== 'completed' && task.status !== filters.status) return false;
    if (filters.deadline === 'onTime' && task.completedOnTime !== true) return false;
    if (filters.deadline !== 'all' && filters.deadline !== 'onTime' && task.deadlineSituation !== filters.deadline) return false;
    return true;
  }), [data?.taskItems, deferredSearch, filters.category, filters.deadline, filters.status]);

  const summary = useMemo(() => {
    let overdue = 0; let today = 0; let soon = 0; let inProgress = 0; let completed = 0; let onTime = 0; let known = 0;
    for (const task of filteredTasks) {
      if (task.deadlineSituation === 'overdue') overdue += 1;
      if (task.deadlineSituation === 'today') today += 1;
      if (task.deadlineSituation === 'soon') soon += 1;
      if (task.status === 'Trabalhando') inProgress += 1;
      if (COMPLETED_STATUSES.has(task.status)) completed += 1;
      if (task.completedOnTime !== null) { known += 1; if (task.completedOnTime) onTime += 1; }
    }
    return { total: filteredTasks.length, overdue, today, soon, inProgress, completed, onTimeRate: known ? Math.round((onTime / known) * 100) : null, onTimeKnown: known };
  }, [filteredTasks]);

  const attentionTasks = useMemo(() => filteredTasks.filter((task) => (
    task.deadlineSituation === 'overdue' || task.deadlineSituation === 'today' || task.deadlineSituation === 'soon'
    || task.blocked || task.stale
  )).sort((a, b) => priorityOf(b) - priorityOf(a) || new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).slice(0, 6), [filteredTasks]);

  const sortedTasks = useMemo(() => [...filteredTasks].sort((a, b) => {
    const values: Record<SortKey, [string | number, string | number]> = {
      dueDate: [new Date(a.dueDate).getTime(), new Date(b.dueDate).getTime()],
      priority: [priorityOf(a), priorityOf(b)], status: [a.status, b.status],
      updatedAt: [new Date(a.updatedAt).getTime(), new Date(b.updatedAt).getTime()],
    };
    const [left, right] = values[sort];
    const result = typeof left === 'number' ? left - Number(right) : String(left).localeCompare(String(right), 'pt-BR');
    return direction === 'asc' ? result : -result;
  }), [filteredTasks, sort, direction]);

  const statusChart = useMemo(() => STATUS_OPTIONS.map((name) => ({
    name, value: filteredTasks.filter((task) => task.status === name).length, color: STATUS_COLORS[name],
  })).filter((item) => item.value > 0), [filteredTasks]);

  const trendChart = useMemo(() => {
    const buckets = new Map<string, { period: string; label: string; completed: number; missed: number }>();
    for (const task of filteredTasks) {
      const date = new Date(task.dueDate); const period = monthKeyInSaoPaulo(date);
      const bucket = buckets.get(period) || { period, label: monthLabel.format(date).replace('.', ''), completed: 0, missed: 0 };
      if (COMPLETED_STATUSES.has(task.status)) bucket.completed += 1;
      if (task.deadlineSituation === 'overdue' || task.completedOnTime === false) bucket.missed += 1;
      buckets.set(period, bucket);
    }
    return Array.from(buckets.values()).sort((a, b) => a.period.localeCompare(b.period));
  }, [filteredTasks]);

  const municipalityPendingChart = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of filteredTasks) {
      if (!COMPLETED_STATUSES.has(task.status)) counts.set(task.municipalityName, (counts.get(task.municipalityName) || 0) + 1);
    }
    return Array.from(counts, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [filteredTasks]);

  const nextDeadline = useMemo(() => filteredTasks.filter((task) => !COMPLETED_STATUSES.has(task.status) && task.deadlineSituation !== 'overdue')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0], [filteredTasks]);
  const openTask = (task: TaskItem) => {
    sessionStorage.setItem(OPEN_TASK_KEY, JSON.stringify({ taskId: task.id, year: task.year, obligationCode: task.obligationCode }));
    onNavigate('obligations-spreadsheet');
  };
  const openSpreadsheet = () => onNavigate('obligations-spreadsheet');
  const applyMetric = (deadline: string, status = 'all') => setFilters((current) => ({ ...current, deadline, status }));
  const handleSort = (key: SortKey) => { if (sort === key) setDirection((value) => value === 'asc' ? 'desc' : 'asc'); else { setSort(key); setDirection(key === 'priority' ? 'desc' : 'asc'); } };
  const comparison = (current: number, previous?: number, suffix = '') => {
    if (hasActiveFilters || previous === undefined) return null;
    const delta = current - previous;
    return `${delta > 0 ? '+' : ''}${delta}${suffix} vs. ${data?.previousPeriod?.year}`;
  };

  if (loading && !data) return <LoadingState className="h-full" message="Consolidando obrigações e prazos..." />;
  if (error && !data) return <ErrorState className="h-full" message={error} onRetry={() => void load()} />;
  if (!data) return null;

  return (
    <PageShell contentClassName="bg-slate-50/50" fixedHeight>
      <div className="mx-auto w-full max-w-[1600px] space-y-4 pb-2">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-700">Visão operacional</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">Obrigações</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">Prazos, riscos e andamento em uma leitura rápida do exercício selecionado.</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw size={13} className={cn(loading && 'animate-spin')} />Atualizar</Button>
            <Button size="sm" onClick={openSpreadsheet}><ListChecks size={14} />Abrir Planilha Principal</Button>
          </div>
        </header>

        {error ? <ErrorState compact message={error} onRetry={() => void load()} /> : null}

        <section aria-labelledby="filters-title" className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div><h2 id="filters-title" className="flex items-center gap-1.5 text-xs font-semibold text-slate-900"><Filter size={13} />Filtros</h2><p className="mt-0.5 text-[10px] text-slate-500">Exercício {filters.year} · {numberFormat.format(filteredTasks.length)} itens no recorte</p></div>
            {hasActiveFilters ? <button type="button" onClick={clearFilters} className="min-h-8 text-[11px] font-semibold text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Limpar filtros</button> : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[120px_1fr_1fr_1fr_1.35fr]">
            <label className="space-y-1 text-[10px] font-semibold text-slate-600">Período<Select value={filters.year} onChange={(value) => updateFilter('year', Number(value))} options={Array.from({ length: 5 }, (_, index) => currentYear + 1 - index).map((value) => ({ value: String(value), label: String(value) }))} size="sm" /></label>
            <label className="space-y-1 text-[10px] font-semibold text-slate-600">Status<Select value={filters.status} onChange={(value) => updateFilter('status', value)} options={[{ value: 'all', label: 'Todos' }, { value: 'completed', label: 'Concluídas' }, ...STATUS_OPTIONS.map((value) => ({ value, label: value }))]} size="sm" /></label>
            <label className="space-y-1 text-[10px] font-semibold text-slate-600">Tipo<Select value={filters.category} onChange={(value) => updateFilter('category', value)} options={[{ value: 'all', label: 'Todos' }, ...CATEGORY_OPTIONS.map((value) => ({ value, label: value }))]} size="sm" /></label>
            <label className="space-y-1 text-[10px] font-semibold text-slate-600">Situação do prazo<Select value={filters.deadline} onChange={(value) => updateFilter('deadline', value)} options={[{ value: 'all', label: 'Todas' }, ...Object.entries(deadlineLabels).map(([value, label]) => ({ value, label }))]} size="sm" /></label>
            <label className="space-y-1 text-[10px] font-semibold text-slate-600">Busca<div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Município, competência ou último editor" className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-8 text-xs font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20" />{filters.search ? <button type="button" onClick={() => updateFilter('search', '')} aria-label="Limpar busca" className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={13} /></button> : null}</div></label>
          </div>
          {hasActiveFilters ? <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
            {filters.search ? <FilterChip label="Busca" value={filters.search} onRemove={() => updateFilter('search', '')} /> : null}
            {filters.status !== 'all' ? <FilterChip label="Status" value={filters.status === 'completed' ? 'Concluídas' : filters.status} onRemove={() => updateFilter('status', 'all')} /> : null}
            {filters.category !== 'all' ? <FilterChip label="Tipo" value={filters.category} onRemove={() => updateFilter('category', 'all')} /> : null}
            {filters.deadline !== 'all' ? <FilterChip label="Prazo" value={deadlineLabels[filters.deadline]} onRemove={() => updateFilter('deadline', 'all')} /> : null}
          </div> : null}
        </section>

        <section aria-labelledby="summary-title">
          <div className="mb-2 flex items-center justify-between"><h2 id="summary-title" className="text-sm font-semibold text-slate-950">Indicadores principais</h2><span className="text-[10px] text-slate-500">Clique em um cartão para filtrar a lista</span></div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
            <MetricButton label="Total de obrigações" value={numberFormat.format(summary.total)} icon={ListChecks} tone="neutral" hint="Todas as competências monitoradas no recorte atual." onClick={() => applyMetric('all')} active={filters.deadline === 'all' && filters.status === 'all'} comparison={comparison(summary.total, data.previousPeriod?.totalTasks)} />
            <MetricButton label="Vencidas" value={numberFormat.format(summary.overdue)} icon={AlertTriangle} tone="danger" hint="Não concluídas cujo prazo final já passou." onClick={() => applyMetric('overdue')} active={filters.deadline === 'overdue'} comparison={comparison(summary.overdue, data.previousPeriod?.overdue)} />
            <MetricButton label="Vencem hoje" value={numberFormat.format(summary.today)} icon={Clock3} tone="warning" hint="Não concluídas com prazo final na data de hoje, em Brasília." onClick={() => applyMetric('today')} active={filters.deadline === 'today'} />
            <MetricButton label="Próximos 7 dias" value={numberFormat.format(summary.soon)} icon={CalendarClock} tone="warning" hint="Não concluídas com vencimento nos próximos sete dias." onClick={() => applyMetric('soon')} active={filters.deadline === 'soon'} />
            <MetricButton label="Em andamento" value={numberFormat.format(summary.inProgress)} icon={CircleDashed} tone="neutral" hint="Obrigações com status Trabalhando." onClick={() => applyMetric('all', 'Trabalhando')} active={filters.status === 'Trabalhando'} />
            <MetricButton label="Concluídas" value={numberFormat.format(summary.completed)} icon={CheckCircle2} tone="success" hint="Obrigações Enviadas ou Homologadas." onClick={() => applyMetric('completed', 'completed')} active={filters.status === 'completed'} comparison={comparison(summary.completed, data.previousPeriod?.completed)} />
            <MetricButton label="Concluídas no prazo" value={summary.onTimeRate === null ? '—' : `${summary.onTimeRate}%`} icon={ShieldCheck} tone="success" hint={summary.onTimeRate === null ? 'Sem histórico de conclusão suficiente para calcular.' : `Calculado sobre ${summary.onTimeKnown} conclusões com data conhecida.`} onClick={() => applyMetric('onTime', 'completed')} active={filters.deadline === 'onTime'} />
          </div>
        </section>

        <section aria-labelledby="attention-title" className="grid gap-4 xl:grid-cols-[1.55fr_0.45fr]">
          <Card className={cn(attentionTasks.length && 'border-amber-200')}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div id="attention-title"><CardTitle className="flex items-center gap-2"><AlertCircle size={16} className="text-amber-700" />Exigem atenção</CardTitle><CardDescription>Vencidas, próximas do prazo, bloqueadas ou sem atualização há 14 dias.</CardDescription></div>
              <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">{attentionTasks.length ? `${attentionTasks.length} prioritárias` : 'Nenhum alerta'}</span>
            </CardHeader>
            <CardContent>
              {attentionTasks.length ? <div className="divide-y divide-slate-100">
                {attentionTasks.map((task) => { const meta = deadlineMeta(task); const DeadlineIcon = meta.icon; return (
                  <button key={task.id} type="button" onClick={() => openTask(task)} className="group flex min-h-[64px] w-full items-center gap-3 py-2.5 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md border', task.deadlineSituation === 'overdue' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-800')}><DeadlineIcon size={16} /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-950">{task.municipalityName} · {task.obligationCode} · {task.competence}</span><span className={cn('mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium', meta.className)}><span>{meta.label}</span><span className="text-slate-300">•</span><span className="text-slate-600">Atualizada {dateTime.format(new Date(task.updatedAt))}{task.lastEditorName ? ` por ${task.lastEditorName}` : ''}</span>{task.blocked ? <span className="rounded bg-orange-50 px-1.5 py-0.5 text-orange-700">Bloqueada</span> : null}{task.stale ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">Sem atualização recente</span> : null}</span></span>
                    <span className="hidden items-center gap-1 text-[10px] font-semibold text-blue-700 sm:flex">Abrir<ChevronRight size={13} /></span>
                  </button>
                ); })}
              </div> : <div className="flex min-h-32 flex-col items-center justify-center text-center"><CheckCircle2 size={24} className="text-emerald-500" /><p className="mt-2 text-sm font-semibold text-slate-800">Nenhum item exige atenção</p><p className="mt-1 text-xs text-slate-500">Não há riscos no recorte selecionado.</p></div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Próximo prazo</CardTitle><CardDescription>Data mais próxima ainda aberta.</CardDescription></CardHeader>
            <CardContent>
              {nextDeadline ? <><p className="text-2xl font-semibold tracking-tight text-slate-950">{shortDate.format(new Date(nextDeadline.dueDate))}</p><p className="mt-2 text-xs font-semibold text-slate-800">{nextDeadline.obligationCode} · {nextDeadline.competence}</p><p className="mt-1 text-[11px] text-slate-500">{nextDeadline.municipalityName}</p><Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => openTask(nextDeadline)}>Abrir obrigação<ExternalLink size={13} /></Button></> : <p className="py-8 text-center text-xs text-slate-500">Nenhum prazo aberto neste recorte.</p>}
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="analysis-title">
          <h2 id="analysis-title" className="mb-2 text-sm font-semibold text-slate-950">Evolução e distribuição</h2>
          <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
            <Card>
              <CardHeader><CardTitle>Cumprimento por mês de vencimento</CardTitle><CardDescription>Concluídas e prazos perdidos no recorte atual. Uma obrigação concluída fora do prazo aparece nas duas séries.</CardDescription></CardHeader>
              <CardContent>
                {trendChart.length ? <div className="h-64" role="img" aria-label="Gráfico mensal de obrigações concluídas e prazos perdidos"><ResponsiveContainer width="100%" height="100%"><BarChart data={trendChart} margin={{ left: -20, right: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip /><Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="completed" name="Concluídas" fill="#059669" radius={[3, 3, 0, 0]} /><Line type="monotone" dataKey="missed" name="Prazo perdido" stroke="#dc2626" strokeWidth={2} dot={{ r: 2 }} /></BarChart></ResponsiveContainer></div> : <p className="py-20 text-center text-xs text-slate-500">Sem dados suficientes para este gráfico.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Distribuição por status</CardTitle><CardDescription>Volume atual, sem repetir a situação de prazo.</CardDescription></CardHeader>
              <CardContent>
                {statusChart.length ? <div className="grid items-center gap-3 sm:grid-cols-[180px_1fr] xl:grid-cols-1"><div className="h-44" role="img" aria-label="Gráfico de distribuição das obrigações por status"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusChart} dataKey="value" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={2}>{statusChart.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="space-y-1.5">{statusChart.map((item) => <button key={item.name} type="button" onClick={() => updateFilter('status', item.name)} className="flex min-h-8 w-full items-center justify-between rounded px-2 text-[11px] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span><b className="tabular-nums text-slate-950">{item.value}</b></button>)}</div></div> : <p className="py-20 text-center text-xs text-slate-500">Sem dados no recorte selecionado.</p>}
              </CardContent>
            </Card>
          </div>
        </section>

        <section aria-labelledby="list-title">
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div id="list-title"><CardTitle>Lista de obrigações</CardTitle><CardDescription>{numberFormat.format(filteredTasks.length)} itens · ordenados por {sort === 'dueDate' ? 'prazo' : sort === 'priority' ? 'prioridade' : sort === 'status' ? 'status' : 'última atualização'}.</CardDescription></div>
              <Select value={sort} onChange={(value) => handleSort(value as SortKey)} options={[{ value: 'dueDate', label: 'Ordenar: prazo' }, { value: 'priority', label: 'Ordenar: prioridade' }, { value: 'status', label: 'Ordenar: status' }, { value: 'updatedAt', label: 'Ordenar: última atualização' }]} size="sm" className="w-full sm:w-56" />
            </CardHeader>
            <CardContent>
              {sortedTasks.length ? <>
                <div className="hidden overflow-hidden rounded-lg border border-slate-200 md:block">
                  <table className="w-full table-fixed text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="w-[27%] px-3 py-2 font-semibold">Obrigação</th><th className="w-[10%] px-3 py-2 font-semibold">Categoria</th><th className="w-[17%] px-3 py-2 font-semibold"><SortButton label="Prazo" column="dueDate" sort={sort} direction={direction} onSort={handleSort} /></th><th className="w-[12%] px-3 py-2 font-semibold"><SortButton label="Prioridade" column="priority" sort={sort} direction={direction} onSort={handleSort} /></th><th className="w-[14%] px-3 py-2 font-semibold"><SortButton label="Status" column="status" sort={sort} direction={direction} onSort={handleSort} /></th><th className="w-[15%] px-3 py-2 font-semibold"><SortButton label="Última alteração" column="updatedAt" sort={sort} direction={direction} onSort={handleSort} /></th><th className="w-[5%] px-2 py-2"><span className="sr-only">Abrir</span></th></tr></thead>
                    <tbody className="divide-y divide-slate-100">{sortedTasks.slice(0, visibleCount).map((task) => { const meta = deadlineMeta(task); const DeadlineIcon = meta.icon; return <tr key={task.id} tabIndex={0} role="link" onClick={() => openTask(task)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openTask(task); } }} className="cursor-pointer transition-colors hover:bg-blue-50/40 focus:bg-blue-50 focus:outline-none"><td className="px-3 py-2.5"><span className="block truncate font-semibold text-slate-950">{task.municipalityName}</span><span className="mt-0.5 block truncate text-[10px] text-slate-500">{task.competence}</span></td><td className="px-3 py-2.5 font-semibold text-slate-700">{task.obligationCode}</td><td className="px-3 py-2.5"><span className={cn('flex items-center gap-1.5 text-[11px] font-semibold', meta.className)}><DeadlineIcon size={12} />{meta.label}</span></td><td className="px-3 py-2.5"><PriorityBadge task={task} /></td><td className="px-3 py-2.5"><StatusBadge status={task.status} /></td><td className="px-3 py-2.5"><span className="block truncate text-slate-700">{dateTime.format(new Date(task.updatedAt))}</span><span className="text-[9px] text-slate-500">{task.lastEditorName ? `Por ${task.lastEditorName}` : 'Autor não identificado'}</span></td><td className="px-2 py-2.5 text-blue-700"><ChevronRight size={15} /></td></tr>; })}</tbody>
                  </table>
                </div>
                <div className="space-y-2 md:hidden">{sortedTasks.slice(0, visibleCount).map((task) => { const meta = deadlineMeta(task); const DeadlineIcon = meta.icon; return <button key={task.id} type="button" onClick={() => openTask(task)} className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><span className="flex items-start justify-between gap-2"><span className="min-w-0"><strong className="block truncate text-sm text-slate-950">{task.municipalityName}</strong><span className="mt-0.5 block text-[11px] text-slate-500">{task.obligationCode} · {task.competence}</span></span><span className="flex shrink-0 flex-col items-end gap-1"><StatusBadge status={task.status} /><PriorityBadge task={task} /></span></span><span className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-2.5"><span><span className={cn('flex items-center gap-1.5 text-[11px] font-semibold', meta.className)}><DeadlineIcon size={12} />{meta.label}</span><span className="mt-1 block text-[10px] text-slate-600">Atualizada {dateTime.format(new Date(task.updatedAt))}{task.lastEditorName ? ` por ${task.lastEditorName}` : ''}</span></span><ChevronRight size={16} className="shrink-0 text-blue-700" /></span></button>; })}</div>
                {visibleCount < sortedTasks.length ? <div className="mt-3 flex justify-center"><Button variant="outline" size="sm" onClick={() => setVisibleCount((value) => value + 10)}>Carregar mais <span className="text-slate-400">({Math.min(10, sortedTasks.length - visibleCount)})</span></Button></div> : null}
              </> : <div className="flex min-h-48 flex-col items-center justify-center text-center"><Filter size={24} className="text-slate-300" /><p className="mt-2 text-sm font-semibold text-slate-800">Nenhuma obrigação encontrada</p><p className="mt-1 text-xs text-slate-500">Ajuste os filtros ou limpe o recorte atual.</p>{hasActiveFilters ? <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>Limpar filtros</Button> : null}</div>}
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="secondary-title" className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div id="secondary-title"><CardHeader><CardTitle>Municípios com mais pendências</CardTitle><CardDescription>Seis maiores volumes ainda não concluídos no recorte atual.</CardDescription></CardHeader></div>
            <CardContent className="space-y-3">{municipalityPendingChart.length ? municipalityPendingChart.map((item) => { const max = municipalityPendingChart[0]?.value || 1; return <button key={item.name} type="button" onClick={() => updateFilter('search', item.name)} className="block w-full rounded-md p-1 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><span className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="truncate font-medium text-slate-700">{item.name}</span><b className="tabular-nums text-slate-950">{item.value}</b></span><span className="block h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-600" style={{ width: `${(item.value / max) * 100}%` }} /></span></button>; }) : <p className="py-10 text-center text-xs text-slate-500">Sem pendências no recorte selecionado.</p>}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Qualidade dos dados</CardTitle><CardDescription>Contexto para interpretar os indicadores corretamente.</CardDescription></CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Base monitorada</p><p className="mt-1 text-lg font-semibold text-slate-950">{data.totalMunicipalities}</p><p className="text-[11px] text-slate-600">municípios ativos</p></div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Histórico válido</p><p className="mt-1 text-lg font-semibold text-slate-950">{summary.onTimeKnown}</p><p className="text-[11px] text-slate-600">conclusões com data conhecida</p></div>
              <div className="sm:col-span-2 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-[11px] leading-relaxed text-blue-900"><AlertCircle size={14} className="mt-0.5 shrink-0" /><p><strong>Critério:</strong> “Concluída” significa Enviada ou Homologada. O prazo termina no último dia do mês seguinte à competência, às 23h59 no horário de Brasília. “Bloqueada” reúne Pendência Cliente e Retificar.</p></div>
            </CardContent>
          </Card>
        </section>

        <p className="text-right text-[10px] font-medium text-slate-500">Dados atualizados em {dateTime.format(new Date(data.updatedAt))}</p>
      </div>
    </PageShell>
  );
}
