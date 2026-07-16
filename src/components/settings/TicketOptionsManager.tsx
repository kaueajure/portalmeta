import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Trash2, Plus, Edit2, Check, X, ShieldAlert, ListChecks } from 'lucide-react';
import { ServiceFormField, TicketOption, User } from '../../types';
import { hasPermission } from '../../lib/permissions';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { Checkbox } from '../ui/Checkbox';

interface TicketOptionsManagerProps {
  currentUser: User;
}

const CATEGORY_SIGLA_MAX_LENGTH = 6;

const normalizeSigla = (value: string) =>
  value.toUpperCase().slice(0, CATEGORY_SIGLA_MAX_LENGTH);

const slugifyOptionValue = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const getErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

export const TicketOptionsManager = ({ currentUser }: TicketOptionsManagerProps) => {
  const [categories, setCategories] = useState<TicketOption[]>([]);
  const [services, setServices] = useState<TicketOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'category' | 'service'; id: number; name: string } | null>(null);

  const [newCategorySigla, setNewCategorySigla] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newService, setNewService] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSigla, setEditSigla] = useState('');
  const [formService, setFormService] = useState<TicketOption | null>(null);
  const [formFields, setFormFields] = useState<ServiceFormField[]>([]);

  const canManageOptions = hasPermission(currentUser, 'configuracoes.atendimento');

  const parseServiceForm = (value: TicketOption['formulario_json']): ServiceFormField[] => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return [];
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  };

  const openServiceForm = (service: TicketOption) => {
    setFormService(service);
    setFormFields(parseServiceForm(service.formulario_json));
  };

  const addFormField = () => setFormFields(fields => [...fields, {
    chave: `campo_${fields.length + 1}`,
    rotulo: '',
    tipo: 'texto',
    obrigatorio: false,
  }]);

  const updateFormField = (index: number, patch: Partial<ServiceFormField>) => {
    setFormFields(fields => fields.map((field, position) => position === index ? { ...field, ...patch } : field));
  };

  const saveServiceForm = async () => {
    if (!formService) return;
    try {
      await api.patch(`/ticket-settings/services/${formService.id}`, { formulario_json: formFields });
      setFormService(null);
      await loadOptions();
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao salvar formulario do servico'));
    }
  };

  const loadOptions = async () => {
    try {
      setLoading(true);
      const [catRes, servRes] = await Promise.all([
        api.get<TicketOption[]>('/ticket-settings/categories'),
        api.get<TicketOption[]>('/ticket-settings/services')
      ]);
      setCategories(catRes);
      setServices(servRes);
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao carregar configurações'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOptions();
  }, []);

  const handleAdd = async (type: 'category' | 'service') => {
    setError(null);

    if (type === 'category') {
      const sigla = normalizeSigla(newCategorySigla).trim();
      const nome = newCategoryName.trim();

      if (!sigla || !nome) {
        setError('Sigla e nome da categoria sao obrigatorios.');
        return;
      }

      try {
        await api.post('/ticket-settings/categories', {
          sigla,
          nome,
          valor: slugifyOptionValue(sigla) || slugifyOptionValue(nome),
          ativo: 1,
          ordem: categories.length
        });
        setNewCategorySigla('');
        setNewCategoryName('');
        loadOptions();
      } catch (err) {
        setError(getErrorMessage(err, 'Erro ao adicionar categoria'));
      }
      return;
    }

    const value = newService.trim();
    if (!value) return;

    try {
      await api.post('/ticket-settings/services', {
        nome: value,
        valor: slugifyOptionValue(value),
        ativo: 1,
        ordem: services.length
      });
      setNewService('');
      loadOptions();
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao adicionar servico'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const path = deleteTarget.type === 'category' ? 'categories' : 'services';
      await api.delete(`/ticket-settings/${path}/${deleteTarget.id}`);
      loadOptions();
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao excluir item'));
    }
  };

  const handleSaveEdit = async (type: 'category' | 'service', id: number) => {
    const nome = editName.trim();
    if (!nome) return;

    try {
      if (type === 'category') {
        const sigla = normalizeSigla(editSigla).trim();
        if (!sigla) {
          setError('A sigla da categoria e obrigatoria.');
          return;
        }

        await api.patch(`/ticket-settings/${type === 'category' ? 'categories' : 'services'}/${id}`, { nome, sigla });
      } else {
        await api.patch(`/ticket-settings/services/${id}`, { nome });
      }

      setEditingId(null);
      setEditName('');
      setEditSigla('');
      loadOptions();
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao atualizar item'));
    }
  };

  const startEdit = (type: 'category' | 'service', item: TicketOption) => {
    setEditingId(`${type}_${item.id}`);
    setEditName(item.nome);
    setEditSigla(item.sigla || '');
  };

  const renderList = (type: 'category' | 'service', items: TicketOption[]) => (
    <div className="space-y-1.5 mt-3">
      {items.map(item => {
        const isEditing = editingId === `${type}_${item.id}`;

        return (
          <div key={item.id} className="flex justify-between items-center gap-2 p-2 border border-slate-100 rounded-md hover:border-slate-200 bg-slate-50/50">
            {isEditing ? (
              <div className="flex-1 grid gap-2 mr-2 sm:grid-cols-[88px_1fr]">
                {type === 'category' && (
                  <Input
                    value={editSigla}
                    onChange={e => setEditSigla(normalizeSigla(e.target.value))}
                    maxLength={CATEGORY_SIGLA_MAX_LENGTH}
                    autoFocus
                    className="h-7 text-xs font-bold uppercase tracking-wide"
                    placeholder="Sigla"
                  />
                )}
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  autoFocus={type === 'service'}
                  className="h-7 text-xs"
                  placeholder={type === 'category' ? 'Nome da categoria' : 'Nome do servico'}
                />
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {type === 'category' && (
                  <span className="flex h-7 min-w-12 shrink-0 items-center justify-center rounded border border-blue-100 bg-blue-50 px-2 text-[11px] font-bold uppercase tracking-wide text-blue-700">
                    {item.sigla || '--'}
                  </span>
                )}
                <span className="truncate text-sm font-medium text-slate-800">{item.nome}</span>
              </div>
            )}

            <div className="flex shrink-0 gap-1">
              {isEditing ? (
                <>
                  <Button size="sm" className="h-7 w-7 p-0" onClick={() => handleSaveEdit(type, item.id)}><Check size={14}/></Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingId(null)}><X size={14}/></Button>
                </>
              ) : (
                <>
                  {type === 'service' && (
                    <Button size="sm" variant="ghost" onClick={() => openServiceForm(item)} className="h-7 gap-1 px-2 text-xs text-blue-600 hover:bg-blue-50">
                      <ListChecks size={13} /> Formulário
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => startEdit(type, item)} className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600">
                    <Edit2 size={13} />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label={`Excluir ${item.nome}`} onClick={() => setDeleteTarget({ type, id: item.id, name: item.nome })} className="text-red-600 hover:bg-red-50 hover:text-red-700">
                    <Trash2 size={13} />
                  </Button>
                </>
              )}
            </div>
          </div>
        );
      })}
      {items.length === 0 && (
        <div className="text-center p-4 bg-slate-50 rounded-md border border-slate-100 text-slate-400 text-xs">
          Nenhuma opcao configurada.
        </div>
      )}
    </div>
  );

  if (!canManageOptions) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-xl flex items-center gap-3">
        <ShieldAlert size={20} />
        Acesso restrito. Sua conta não pode gerenciar configurações de chamados.
      </div>
    );
  }

  if (loading) return <div className="p-6 text-slate-500 text-sm">Carregando configurações...</div>;

  return (
    <div className="space-y-6">
      {error && <div className="p-3 bg-red-50 text-red-600 text-xs font-semibold rounded-lg border border-red-100">{error}</div>}

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-0.5">Categorias</h3>
          <p className="text-xs text-slate-500 mb-4">Configure a sigla e o nome completo das categorias de chamados.</p>

          <div className="grid gap-2 sm:grid-cols-[88px_1fr_auto]">
            <Input
              value={newCategorySigla}
              onChange={e => setNewCategorySigla(normalizeSigla(e.target.value))}
              placeholder="PTS"
              maxLength={CATEGORY_SIGLA_MAX_LENGTH}
              className="h-8 text-sm font-bold uppercase tracking-wide"
              onKeyDown={e => e.key === 'Enter' && handleAdd('category')}
            />
            <Input
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              placeholder="Portal Terceiro Setor"
              className="h-8 text-sm"
              onKeyDown={e => e.key === 'Enter' && handleAdd('category')}
            />
            <Button size="sm" onClick={() => handleAdd('category')}><Plus size={14} className="mr-1" /> Adicionar</Button>
          </div>

          {renderList('category', categories)}
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-0.5">Serviços</h3>
          <p className="text-xs text-slate-500 mb-4">Serviços oferecidos nos chamados.</p>

          <div className="flex gap-2">
            <Input
              value={newService}
              onChange={e => setNewService(e.target.value)}
              placeholder="Ex: Consultoria"
              className="flex-1 h-8 text-sm"
              onKeyDown={e => e.key === 'Enter' && handleAdd('service')}
            />
            <Button size="sm" onClick={() => handleAdd('service')}><Plus size={14} className="mr-1" /> Adicionar</Button>
          </div>

          {renderList('service', services)}
        </Card>
      </div>
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Excluir ${deleteTarget?.type === 'category' ? 'categoria' : 'serviço'}?`}
        description={`${deleteTarget?.name || 'Esta opção'} deixará de estar disponível para classificação dos chamados. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir opção"
        variant="danger"
      />
      <Modal
        isOpen={!!formService}
        onClose={() => setFormService(null)}
        title={`Formulário — ${formService?.nome || 'serviço'}`}
        size="lg"
        footer={<><Button variant="ghost" size="sm" onClick={() => setFormService(null)}>Cancelar</Button><Button size="sm" onClick={saveServiceForm}>Salvar formulário</Button></>}
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Estes campos aparecem quando o serviço é selecionado na abertura do chamado.</p>
          {formFields.map((field, index) => (
            <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_160px_auto]">
                <Input
                  label="Nome do campo"
                  value={field.rotulo}
                  onChange={event => updateFormField(index, { rotulo: event.target.value, chave: slugifyOptionValue(event.target.value) || field.chave })}
                  placeholder="Ex: Número do contrato"
                />
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Tipo</label>
                  <Select
                    value={field.tipo}
                    onChange={value => updateFormField(index, { tipo: value as ServiceFormField['tipo'], opcoes: value === 'selecao' ? field.opcoes || [] : undefined })}
                    options={[
                      { value: 'texto', label: 'Texto curto' },
                      { value: 'texto_longo', label: 'Texto longo' },
                      { value: 'numero', label: 'Número' },
                      { value: 'data', label: 'Data' },
                      { value: 'selecao', label: 'Lista de opções' },
                    ]}
                  />
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label="Remover campo" onClick={() => setFormFields(fields => fields.filter((_, position) => position !== index))} className="self-end text-red-600 hover:bg-red-50"><Trash2 size={15} /></Button>
              </div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Checkbox checked={Boolean(field.obrigatorio)} onChange={event => updateFormField(index, { obrigatorio: event.target.checked })} label="Obrigatório" />
                {field.tipo === 'selecao' && (
                  <Input
                    value={(field.opcoes || []).join(', ')}
                    onChange={event => updateFormField(index, { opcoes: event.target.value.split(',').map(value => value.trim()).filter(Boolean) })}
                    placeholder="Opções separadas por vírgula"
                    className="flex-1"
                  />
                )}
              </div>
            </div>
          ))}
          {!formFields.length && <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Este serviço ainda não possui campos adicionais.</div>}
          <Button type="button" variant="outline" size="sm" onClick={addFormField}><Plus size={14} className="mr-1" /> Adicionar campo</Button>
        </div>
      </Modal>
    </div>
  );
};
