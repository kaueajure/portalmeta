import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Trash2, Plus, Edit2, Check, X, ShieldAlert } from 'lucide-react';
import { TicketOption, User } from '../../types';
import { hasPermission } from '../../lib/permissions';

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

  const [newCategorySigla, setNewCategorySigla] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newService, setNewService] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSigla, setEditSigla] = useState('');

  const canManageOptions = hasPermission(currentUser, 'empresas.gerenciar_configuracoes');
  const companyId = currentUser.empresa_id;

  const loadOptions = async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const [catRes, servRes] = await Promise.all([
        api.get<TicketOption[]>(`/companies/${companyId}/ticket-categories`),
        api.get<TicketOption[]>(`/companies/${companyId}/ticket-services`)
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
  }, [companyId]);

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
        await api.post(`/companies/${companyId}/ticket-categories`, {
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
      await api.post(`/companies/${companyId}/ticket-services`, {
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

  const handleDelete = async (type: 'category' | 'service', id: number) => {
    if (!confirm('Deseja realmente excluir esta opcao?')) return;
    try {
      const endpoint = type === 'category' ? 'ticket-categories' : 'ticket-services';
      await api.delete(`/companies/${companyId}/${endpoint}/${id}`);
      loadOptions();
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao excluir item'));
    }
  };

  const handleSaveEdit = async (type: 'category' | 'service', id: number) => {
    const nome = editName.trim();
    if (!nome) return;

    try {
      const endpoint = type === 'category' ? 'ticket-categories' : 'ticket-services';

      if (type === 'category') {
        const sigla = normalizeSigla(editSigla).trim();
        if (!sigla) {
          setError('A sigla da categoria e obrigatoria.');
          return;
        }

        await api.patch(`/companies/${companyId}/${endpoint}/${id}`, { nome, sigla });
      } else {
        await api.patch(`/companies/${companyId}/${endpoint}/${id}`, { nome });
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
                  <Button size="sm" variant="ghost" onClick={() => startEdit(type, item)} className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600">
                    <Edit2 size={13} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(type, item.id)} className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 hover:text-red-600">
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
    </div>
  );
};
