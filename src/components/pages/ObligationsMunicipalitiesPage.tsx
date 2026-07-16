import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  Building2, Check, Copy, Edit2, Mail, Phone, Plus, Search,
  ShieldCheck, Trash2, UserRound, X,
} from 'lucide-react';
import { api } from '../../lib/api';
import { hasPermission } from '../../lib/permissions';
import { cn } from '../../lib/utils';
import { User } from '../../types';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { LoadingState } from '../ui/LoadingState';
import { Modal } from '../ui/Modal';
import { PageShell } from '../layout/PageShell';

interface Municipality {
  id: number;
  name: string;
  state: string;
  responsibleConfig: Record<string, any>;
  phone: string | null;
  email: string | null;
  observations: string | null;
}
interface StaffUser { id: number; name: string; email: string; role: string | null; }
interface MunicipalitiesResponse { municipalities: Municipality[]; users: StaffUser[]; }
type FormMode = 'create' | 'edit' | 'clone';

const SERVICES = [
  { code: 'MSC', name: 'Matriz de Saldos Contábeis', tone: 'blue' },
  { code: 'RREO', name: 'Relatório Resumido de Execução Orçamentária', tone: 'cyan' },
  { code: 'RGF', name: 'Relatório de Gestão Fiscal', tone: 'violet' },
  { code: 'DCA', name: 'Declaração de Contas Anuais', tone: 'amber' },
  { code: 'SIOPE', name: 'Educação', tone: 'emerald' },
  { code: 'SIOPS', name: 'Saúde', tone: 'rose' },
] as const;
const EMPTY_RESPONSIBLES = Object.fromEntries(SERVICES.map(({ code }) => [code, '']));
const ALL_ACTIVE = Object.fromEntries(SERVICES.map(({ code }) => [code, true]));
const SERVICE_TONES: Record<string, string> = {
  blue: 'border-blue-200 bg-blue-50 text-blue-700', cyan: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700', amber: 'border-amber-200 bg-amber-50 text-amber-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700', rose: 'border-rose-200 bg-rose-50 text-rose-700',
};

function selectedNames(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function MunicipalityForm({
  isOpen, mode, municipality, users, saving, error, onClose, onSave,
}: {
  isOpen: boolean; mode: FormMode; municipality: Municipality | null; users: StaffUser[];
  saving: boolean; error: string; onClose: () => void;
  onSave: (payload: Omit<Municipality, 'id'>) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [observations, setObservations] = useState('');
  const [responsibles, setResponsibles] = useState<Record<string, string>>(EMPTY_RESPONSIBLES);
  const [activeServices, setActiveServices] = useState<Record<string, boolean>>(ALL_ACTIVE);
  const [expandedService, setExpandedService] = useState<string | null>('MSC');

  useEffect(() => {
    if (!isOpen) return;
    const config = municipality?.responsibleConfig || {};
    setName(mode === 'clone' ? '' : municipality?.name || '');
    setPhone(municipality?.phone || '');
    setEmail(municipality?.email || ''); setObservations(municipality?.observations || '');
    setResponsibles(Object.fromEntries(SERVICES.map(({ code }) => [code, String(config[code] || '')])));
    setActiveServices(Object.fromEntries(SERVICES.map(({ code }) => [code, config._activeServices?.[code] !== false])));
    setExpandedService('MSC');
  }, [isOpen, mode, municipality?.id]);

  const toggleUser = (service: string, userName: string) => {
    setResponsibles((current) => {
      const names = selectedNames(current[service] || '');
      const next = names.includes(userName) ? names.filter((item) => item !== userName) : [...names, userName];
      return { ...current, [service]: next.join(', ') };
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSave({
      name, state: 'SP', phone: phone || null, email: email || null,
      observations: observations || null,
      responsibleConfig: { ...responsibles, _activeServices: activeServices },
    });
  };

  const title = mode === 'edit' ? 'Editar município' : mode === 'clone' ? 'Clonar município' : 'Novo município';
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" title={title}>
      <form onSubmit={submit} className="space-y-5">
        {mode === 'clone' ? <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"><Copy size={15} className="mt-0.5 shrink-0" /><p><strong className="block">Configuração copiada</strong>Responsáveis, serviços e contatos foram preenchidos com base no município original.</p></div> : null}
        {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">{error}</div> : null}

        <label className="block space-y-1.5 text-xs font-semibold text-slate-700">Nome do município <span className="text-rose-500">*</span><input required autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={255} placeholder="Ex.: Campinas" className="h-9 w-full rounded-md border border-slate-200 px-3 text-[13px] font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-semibold text-slate-700">Telefone<input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={100} placeholder="(00) 00000-0000" className="h-9 w-full rounded-md border border-slate-200 px-3 text-[13px] font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
          <label className="space-y-1.5 text-xs font-semibold text-slate-700">E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} placeholder="contato@municipio.gov.br" className="h-9 w-full rounded-md border border-slate-200 px-3 text-[13px] font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
        </div>

        <section className="space-y-2 border-t border-slate-100 pt-4">
          <div><h4 className="text-xs font-bold text-slate-900">Serviços e responsáveis</h4><p className="mt-0.5 text-[11px] text-slate-500">Os responsáveis são usuários internos ativos do Portal Meta.</p></div>
          <div className="grid gap-2 sm:grid-cols-2">
            {SERVICES.map((service) => {
              const active = activeServices[service.code] !== false;
              const names = selectedNames(responsibles[service.code] || '');
              const expanded = expandedService === service.code;
              return <div key={service.code} className={cn('rounded-lg border transition-colors', active ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-70')}>
                <div className="flex items-center gap-2 p-2.5">
                  <button type="button" onClick={() => setActiveServices((current) => ({ ...current, [service.code]: !active }))} aria-label={`${active ? 'Desativar' : 'Ativar'} ${service.code}`} className={cn('flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors', active ? 'bg-blue-600' : 'bg-slate-300')}><span className={cn('h-4 w-4 rounded-full bg-white shadow-sm transition-transform', active && 'translate-x-4')} /></button>
                  <button type="button" disabled={!active} onClick={() => setExpandedService(expanded ? null : service.code)} className="min-w-0 flex-1 text-left"><span className="flex items-center gap-1.5"><strong className="text-xs text-slate-900">{service.code}</strong><span className="truncate text-[10px] text-slate-400">{service.name}</span></span><span className="mt-0.5 block truncate text-[10px] font-medium text-slate-500">{active ? names.length ? names.join(', ') : 'Sem responsável' : 'Não se aplica'}</span></button>
                </div>
                {active && expanded ? <div className="max-h-36 space-y-0.5 overflow-y-auto border-t border-slate-100 p-2">
                  {!users.length ? <p className="p-2 text-[11px] text-slate-400">Nenhum usuário interno ativo.</p> : users.map((user) => {
                    const checked = names.includes(user.name);
                    return <label key={user.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50"><input type="checkbox" checked={checked} onChange={() => toggleUser(service.code, user.name)} className="rounded border-slate-300 text-blue-600" /><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold text-slate-700">{user.name}</span><span className="block truncate text-[9px] text-slate-400">{user.role || user.email}</span></span></label>;
                  })}
                </div> : null}
              </div>;
            })}
          </div>
        </section>

        <label className="block space-y-1.5 text-xs font-semibold text-slate-700">Observações<textarea value={observations} onChange={(e) => setObservations(e.target.value)} maxLength={10000} rows={3} placeholder="Informações adicionais sobre o atendimento municipal..." className="w-full resize-none rounded-md border border-slate-200 p-3 text-[13px] font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" loading={saving}>{mode === 'edit' ? 'Salvar alterações' : 'Cadastrar município'}</Button></div>
      </form>
    </Modal>
  );
}

export function ObligationsMunicipalitiesPage({ currentUser, openCreateOnMount = false, onCreateOpened }: {
  currentUser: User;
  openCreateOnMount?: boolean;
  onCreateOpened?: () => void;
}) {
  const [data, setData] = useState<MunicipalitiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase('pt-BR'));
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [selected, setSelected] = useState<Municipality | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Municipality | null>(null);

  const canCreate = hasPermission(currentUser, 'obrigacoes.municipios.criar');
  const canEdit = hasPermission(currentUser, 'obrigacoes.municipios.editar');
  const canDelete = hasPermission(currentUser, 'obrigacoes.municipios.excluir');

  const load = async () => {
    setLoading(true); setError('');
    try { setData(await api.get<MunicipalitiesResponse>('/obligations/municipalities')); }
    catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const municipalities = data?.municipalities || [];
  const filtered = useMemo(() => municipalities.filter((municipality) => {
    if (!deferredSearch) return true;
    const responsibles = SERVICES.map(({ code }) => municipality.responsibleConfig?.[code] || '').join(' ');
    return `${municipality.name} ${municipality.email || ''} ${municipality.phone || ''} ${responsibles}`.toLocaleLowerCase('pt-BR').includes(deferredSearch);
  }), [municipalities, deferredSearch]);
  const stats = useMemo(() => {
    let activeServices = 0; let missingResponsible = 0;
    for (const municipality of municipalities) for (const { code } of SERVICES) {
      if (municipality.responsibleConfig?._activeServices?.[code] === false) continue;
      activeServices += 1;
      if (!String(municipality.responsibleConfig?.[code] || '').trim()) missingResponsible += 1;
    }
    return { activeServices, missingResponsible };
  }, [municipalities]);
  const summaryCards = [
    { label: 'Municípios', value: municipalities.length, icon: Building2, color: 'text-slate-900' },
    { label: 'Serviços ativos', value: stats.activeServices, icon: ShieldCheck, color: 'text-emerald-700' },
    { label: 'Sem responsável', value: stats.missingResponsible, icon: UserRound, color: stats.missingResponsible ? 'text-amber-700' : 'text-slate-900' },
    { label: 'Usuários internos', value: data?.users.length || 0, icon: UserRound, color: 'text-blue-700' },
  ];

  const openForm = (mode: FormMode, municipality: Municipality | null = null) => {
    setFormMode(mode); setSelected(municipality); setFormError(''); setFormOpen(true);
  };
  useEffect(() => {
    if (!openCreateOnMount) return;
    openForm('create');
    onCreateOpened?.();
  }, [openCreateOnMount]);
  const saveMunicipality = async (payload: Omit<Municipality, 'id'>) => {
    setSaving(true); setFormError('');
    try {
      const saved = formMode === 'edit' && selected
        ? await api.put<Municipality>(`/obligations/municipalities/${selected.id}`, payload)
        : await api.post<Municipality>('/obligations/municipalities', payload);
      setData((current) => current ? {
        ...current,
        municipalities: formMode === 'edit'
          ? current.municipalities.map((item) => item.id === saved.id ? saved : item).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
          : [...current.municipalities, saved].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      } : current);
      setFormOpen(false);
    } catch (err: any) { setFormError(err.message); }
    finally { setSaving(false); }
  };
  const deleteMunicipality = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    setDeleteTarget(null); setSaving(true); setError('');
    try {
      await api.delete(`/obligations/municipalities/${targetId}`);
      setData((current) => current ? { ...current, municipalities: current.municipalities.filter((item) => item.id !== targetId) } : current);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  if (loading && !data) return <LoadingState className="h-full w-full" message="Carregando municípios..." />;
  if (error && !data) return <ErrorState className="h-full w-full" message={error} onRetry={load} />;

  return (
    <PageShell
      actions={canCreate ? <Button size="sm" onClick={() => openForm('create')}><Plus size={14} />Novo município</Button> : undefined}
      flush
      contentClassName="flex min-h-0 flex-col"
    >
      <div className="shrink-0 border-b border-slate-200/70 bg-white p-3 sm:p-4">
        <div className="relative w-full sm:max-w-md"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar município, contato ou responsável..." className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-8 text-xs font-medium outline-none transition focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-400" />{search ? <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"><X size={13} /></button> : null}</div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-4">
          {summaryCards.map(({ label, value, icon: Icon, color }) => <div key={label} className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2"><Icon size={14} className="text-slate-400" /><span className="min-w-0 flex-1 truncate text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span><strong className={cn('text-sm', color)}>{value}</strong></div>)}
        </div>
      </div>

      {error ? <div className="flex shrink-0 items-center justify-between rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"><span>{error}</span><button onClick={() => setError('')}><X size={14} /></button></div> : null}

      <section className="min-h-0 flex-1 overflow-auto bg-white">
        {!filtered.length ? <EmptyState className="m-4 min-h-[300px]" title="Nenhum município encontrado" description={search ? 'Ajuste ou remova o termo pesquisado.' : 'Cadastre o primeiro município para começar.'} icon={<Building2 size={22} />} action={canCreate && !search ? { label: 'Cadastrar município', onClick: () => openForm('create') } : undefined} /> : (
          <div className="divide-y divide-slate-100">
            {filtered.map((municipality) => {
              const activeCount = SERVICES.filter(({ code }) => municipality.responsibleConfig?._activeServices?.[code] !== false).length;
              return <article key={municipality.id} className="group px-3 py-3 transition-colors hover:bg-slate-50/70 sm:px-4">
                <div className="grid gap-3 xl:grid-cols-[220px_1fr_230px_auto] xl:items-center">
                  <div className="min-w-0"><h3 className="truncate text-[13px] font-bold text-slate-950">{municipality.name}</h3><p className="mt-0.5 text-[10px] font-medium text-slate-400">{activeCount} de {SERVICES.length} serviços ativos</p></div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">{SERVICES.map((service) => {
                    const active = municipality.responsibleConfig?._activeServices?.[service.code] !== false;
                    const names = String(municipality.responsibleConfig?.[service.code] || '').trim();
                    return <div key={service.code} title={active ? names || 'Sem responsável' : 'Não se aplica'} className={cn('min-w-0 rounded-md border px-2 py-1.5', active ? SERVICE_TONES[service.tone] : 'border-slate-200 bg-slate-50 text-slate-300')}><div className="flex items-center justify-between gap-1"><strong className="text-[9px]">{service.code}</strong>{active && names ? <Check size={9} /> : null}</div><p className="mt-0.5 truncate text-[9px] font-semibold opacity-80">{active ? names || 'Sem responsável' : 'Inativo'}</p></div>;
                  })}</div>
                  <div className="space-y-1 text-[10px] text-slate-500"><p className="flex items-center gap-1.5 truncate"><Mail size={11} className="shrink-0 text-slate-400" />{municipality.email || 'E-mail não informado'}</p><p className="flex items-center gap-1.5 truncate"><Phone size={11} className="shrink-0 text-slate-400" />{municipality.phone || 'Telefone não informado'}</p></div>
                  <div className="flex items-center justify-end gap-1 opacity-70 transition-opacity group-hover:opacity-100">{canCreate ? <Button size="icon" variant="ghost" onClick={() => openForm('clone', municipality)} title="Clonar"><Copy size={14} /></Button> : null}{canEdit ? <Button size="icon" variant="ghost" onClick={() => openForm('edit', municipality)} title="Editar"><Edit2 size={14} /></Button> : null}{canDelete ? <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(municipality)} title="Excluir" className="hover:bg-rose-50 hover:text-rose-700"><Trash2 size={14} /></Button> : null}</div>
                </div>
                {municipality.observations ? <p className="mt-2 truncate border-t border-slate-100 pt-2 text-[10px] italic text-slate-400">{municipality.observations}</p> : null}
              </article>;
            })}
          </div>
        )}
      </section>

      <MunicipalityForm isOpen={formOpen} mode={formMode} municipality={selected} users={data?.users || []} saving={saving} error={formError} onClose={() => setFormOpen(false)} onSave={saveMunicipality} />
      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={deleteMunicipality} title="Excluir município?" description={`Ao excluir ${deleteTarget?.name || 'este município'}, todas as competências, alterações, comentários e anexos vinculados serão removidos permanentemente.`} confirmLabel="Excluir permanentemente" variant="danger" />
    </PageShell>
  );
}
