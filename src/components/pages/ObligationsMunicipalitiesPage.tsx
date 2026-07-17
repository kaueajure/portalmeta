import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  Building2, Check, CircleOff, Clock3, Copy, Edit2, Mail, Phone, Plus, Search,
  ShieldCheck, Trash2, X,
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
import { DEFAULT_OBLIGATION_DEFINITIONS, ObligationDefinition, obligationColor } from '../../lib/obligationDefinitions';

interface Municipality {
  id: number;
  name: string;
  state: string;
  serviceConfig: { activeServices?: Record<string, boolean> };
  phone: string | null;
  email: string | null;
  observations: string | null;
  version: number;
  updatedAt: string;
  lastEditorName: string | null;
}
interface MunicipalityPayload {
  name: string; state: string; serviceConfig: { activeServices: Record<string, boolean> };
  phone: string | null; email: string | null; observations: string | null; version: number;
}
interface MunicipalitiesResponse { municipalities: Municipality[]; definitions: ObligationDefinition[]; }
type FormMode = 'create' | 'edit' | 'clone';

function MunicipalityForm({
  isOpen, mode, municipality, services, saving, error, onClose, onSave,
}: {
  isOpen: boolean; mode: FormMode; municipality: Municipality | null;
  services: ObligationDefinition[];
  saving: boolean; error: string; onClose: () => void;
  onSave: (payload: MunicipalityPayload) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [observations, setObservations] = useState('');
  const [activeServices, setActiveServices] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen) return;
    const config = municipality?.serviceConfig || {};
    setName(mode === 'clone' ? '' : municipality?.name || '');
    setPhone(municipality?.phone || '');
    setEmail(municipality?.email || ''); setObservations(municipality?.observations || '');
    setActiveServices(Object.fromEntries(services.map(({ code }) => [code, config.activeServices?.[code] !== false])));
  }, [isOpen, mode, municipality?.id, services]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSave({
      name, state: 'SP', phone: phone || null, email: email || null,
      observations: observations || null,
      serviceConfig: { activeServices },
      version: municipality?.version || 1,
    });
  };

  const title = mode === 'edit' ? 'Editar município' : mode === 'clone' ? 'Clonar município' : 'Novo município';
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" title={title}>
      <form onSubmit={submit} className="space-y-5">
        {mode === 'clone' ? <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"><Copy size={15} className="mt-0.5 shrink-0" /><p><strong className="block">Configuração copiada</strong>Serviços e contatos foram preenchidos com base no município original.</p></div> : null}
        {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">{error}</div> : null}

        <label className="block space-y-1.5 text-xs font-semibold text-slate-700">Nome do município <span className="text-rose-500">*</span><input required autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={255} placeholder="Ex.: Campinas" className="h-9 w-full rounded-md border border-slate-200 px-3 text-[13px] font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-semibold text-slate-700">Telefone<input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={100} placeholder="(00) 00000-0000" className="h-9 w-full rounded-md border border-slate-200 px-3 text-[13px] font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
          <label className="space-y-1.5 text-xs font-semibold text-slate-700">E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} placeholder="contato@municipio.gov.br" className="h-9 w-full rounded-md border border-slate-200 px-3 text-[13px] font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
        </div>

        <section className="space-y-2 border-t border-slate-100 pt-4">
          <div><h4 className="text-xs font-bold text-slate-900">Serviços aplicáveis</h4><p className="mt-0.5 text-[11px] text-slate-500">Defina quais obrigações fazem parte do acompanhamento deste município.</p></div>
          <div className="grid gap-2 sm:grid-cols-2">
            {services.map((service) => {
              const active = activeServices[service.code] !== false;
              return <div key={service.code} className={cn('rounded-lg border transition-colors', active ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-70')}>
                <div className="flex items-center gap-2 p-2.5">
                  <button type="button" onClick={() => setActiveServices((current) => ({ ...current, [service.code]: !active }))} aria-label={`${active ? 'Desativar' : 'Ativar'} ${service.code}`} className={cn('flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors', active ? 'bg-blue-600' : 'bg-slate-300')}><span className={cn('h-4 w-4 rounded-full bg-white shadow-sm transition-transform', active && 'translate-x-4')} /></button>
                  <div className="min-w-0 flex-1"><span className="flex items-center gap-1.5"><strong className="text-xs text-slate-900">{service.code}</strong><span className="truncate text-[10px] text-slate-400">{service.name}</span></span><span className="mt-0.5 block text-[10px] font-medium text-slate-500">{active ? 'Incluído no acompanhamento' : 'Não se aplica'}</span></div>
                  {active ? <Check size={13} className="text-emerald-600" /> : <CircleOff size={13} className="text-slate-400" />}
                </div>
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
  const services = data?.definitions?.length ? data.definitions : DEFAULT_OBLIGATION_DEFINITIONS;
  const filtered = useMemo(() => municipalities.filter((municipality) => {
    if (!deferredSearch) return true;
    return `${municipality.name} ${municipality.email || ''} ${municipality.phone || ''}`.toLocaleLowerCase('pt-BR').includes(deferredSearch);
  }), [municipalities, deferredSearch]);
  const stats = useMemo(() => {
    let activeServices = 0; let withoutContact = 0;
    for (const municipality of municipalities) for (const { code } of services) {
      if (municipality.serviceConfig?.activeServices?.[code] === false) continue;
      activeServices += 1;
    }
    for (const municipality of municipalities) if (!municipality.email && !municipality.phone) withoutContact += 1;
    return { activeServices, withoutContact };
  }, [municipalities, services]);
  const summaryCards = [
    { label: 'Municípios', value: municipalities.length, icon: Building2, color: 'text-slate-900' },
    { label: 'Serviços ativos', value: stats.activeServices, icon: ShieldCheck, color: 'text-emerald-700' },
    { label: 'Sem contato', value: stats.withoutContact, icon: Mail, color: stats.withoutContact ? 'text-amber-700' : 'text-slate-900' },
    { label: 'Atualizados', value: municipalities.filter((item) => item.lastEditorName).length, icon: Clock3, color: 'text-blue-700' },
  ];

  const openForm = (mode: FormMode, municipality: Municipality | null = null) => {
    setFormMode(mode); setSelected(municipality); setFormError(''); setFormOpen(true);
  };
  useEffect(() => {
    if (!openCreateOnMount) return;
    openForm('create');
    onCreateOpened?.();
  }, [openCreateOnMount]);
  const saveMunicipality = async (payload: MunicipalityPayload) => {
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
    const { id: targetId, version: targetVersion } = deleteTarget;
    setDeleteTarget(null); setSaving(true); setError('');
    try {
      await api.delete(`/obligations/municipalities/${targetId}?version=${targetVersion}`);
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
        <div className="relative w-full sm:max-w-md"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar município ou contato..." className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-8 text-xs font-medium outline-none transition focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-400" />{search ? <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"><X size={13} /></button> : null}</div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-4">
          {summaryCards.map(({ label, value, icon: Icon, color }) => <div key={label} className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2"><Icon size={14} className="text-slate-400" /><span className="min-w-0 flex-1 truncate text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span><strong className={cn('text-sm', color)}>{value}</strong></div>)}
        </div>
      </div>

      {error ? <div className="flex shrink-0 items-center justify-between rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"><span>{error}</span><button onClick={() => setError('')}><X size={14} /></button></div> : null}

      <section className="min-h-0 flex-1 overflow-auto bg-white">
        {!filtered.length ? <EmptyState className="m-4 min-h-[300px]" title="Nenhum município encontrado" description={search ? 'Ajuste ou remova o termo pesquisado.' : 'Cadastre o primeiro município para começar.'} icon={<Building2 size={22} />} action={canCreate && !search ? { label: 'Cadastrar município', onClick: () => openForm('create') } : undefined} /> : (
          <div className="divide-y divide-slate-100">
            {filtered.map((municipality) => {
              const activeCount = services.filter(({ code }) => municipality.serviceConfig?.activeServices?.[code] !== false).length;
              return <article key={municipality.id} className="group px-3 py-3 transition-colors hover:bg-slate-50/70 sm:px-4">
                <div className="grid gap-3 xl:grid-cols-[220px_1fr_230px_auto] xl:items-center">
                  <div className="min-w-0"><h3 className="truncate text-[13px] font-bold text-slate-950">{municipality.name}</h3><p className="mt-0.5 text-[10px] font-medium text-slate-400">{activeCount} de {services.length} serviços ativos</p></div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">{services.map((service) => {
                    const active = municipality.serviceConfig?.activeServices?.[service.code] !== false;
                    return <div key={service.code} title={active ? 'Incluído no acompanhamento' : 'Não se aplica'} className={cn('min-w-0 rounded-md border px-2 py-1.5', active ? obligationColor(service.color).chip : 'border-slate-200 bg-slate-50 text-slate-300')}><div className="flex items-center justify-between gap-1"><strong className="text-[9px]">{service.code}</strong>{active ? <Check size={9} /> : null}</div><p className="mt-0.5 truncate text-[9px] font-semibold opacity-80">{active ? 'Ativo' : 'Inativo'}</p></div>;
                  })}</div>
                  <div className="space-y-1 text-[10px] text-slate-500"><p className="flex items-center gap-1.5 truncate"><Mail size={11} className="shrink-0 text-slate-400" />{municipality.email || 'E-mail não informado'}</p><p className="flex items-center gap-1.5 truncate"><Phone size={11} className="shrink-0 text-slate-400" />{municipality.phone || 'Telefone não informado'}</p></div>
                  <div className="flex items-center justify-end gap-1 opacity-70 transition-opacity group-hover:opacity-100">{canCreate ? <Button size="icon" variant="ghost" onClick={() => openForm('clone', municipality)} title="Clonar"><Copy size={14} /></Button> : null}{canEdit ? <Button size="icon" variant="ghost" onClick={() => openForm('edit', municipality)} title="Editar"><Edit2 size={14} /></Button> : null}{canDelete ? <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(municipality)} title="Excluir" className="hover:bg-rose-50 hover:text-rose-700"><Trash2 size={14} /></Button> : null}</div>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[10px] text-slate-400">{municipality.observations ? <p className="min-w-0 flex-1 truncate italic">{municipality.observations}</p> : <span />}{municipality.lastEditorName ? <span>Última alteração por <strong className="text-slate-600">{municipality.lastEditorName}</strong></span> : null}</div>
              </article>;
            })}
          </div>
        )}
      </section>

      <MunicipalityForm isOpen={formOpen} mode={formMode} municipality={selected} services={services} saving={saving} error={formError} onClose={() => setFormOpen(false)} onSave={saveMunicipality} />
      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={deleteMunicipality} title="Desativar município?" description={`Ao desativar ${deleteTarget?.name || 'este município'}, ele deixará de aparecer no módulo. Obrigações, histórico, comentários e anexos serão preservados.`} confirmLabel="Desativar município" variant="danger" />
    </PageShell>
  );
}
