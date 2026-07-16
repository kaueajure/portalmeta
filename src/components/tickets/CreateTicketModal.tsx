import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { api } from '../../lib/api';
import { useTicketOptions } from '../../hooks/useTicketOptions';
import { getCategoryShortLabel } from '../../lib/ticketOptions';
import { hasPermission } from '../../lib/permissions';
import { ServiceFormFields } from './ServiceFormFields';

interface RequesterOption {
  usuario_id: number | null;
  nome: string;
  email: string;
}

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onSuccess: () => void;
}

export const CreateTicketModal = ({ isOpen, onClose, currentUser, onSuccess }: CreateTicketModalProps) => {
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [requesterMode, setRequesterMode] = useState<'self' | 'customer'>('self');
  const [requesterSearch, setRequesterSearch] = useState('');
  const [requesterResults, setRequesterResults] = useState<RequesterOption[]>([]);
  const [selectedRequester, setSelectedRequester] = useState<RequesterOption | null>(null);
  const [newRequesterName, setNewRequesterName] = useState('');
  const [newRequesterEmail, setNewRequesterEmail] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  
  const { activeCategories, activeServices, loading: optionsLoading } = useTicketOptions();

  // Fallbacks
  const defaultCategories = [
    { value: 'suporte_tecnico', label: 'Suporte Técnico' },
    { value: 'financeiro', label: 'Financeiro' },
    { value: 'recursos_humanos', label: 'RH' },
    { value: 'comercial', label: 'Comercial' },
    { value: 'outros', label: 'Outros' }
  ];
  
  const defaultServices = [
    { value: 'suporte', label: 'Suporte' },
    { value: 'implantacao', label: 'Implantação' },
    { value: 'treinamento', label: 'Treinamento' },
    { value: 'outros', label: 'Outros' }
  ];

  const categoryOptions = activeCategories.length > 0 
    ? activeCategories.map(c => ({ value: c.valor, label: getCategoryShortLabel(c) }))
    : defaultCategories;

  const serviceOptions = activeServices.length > 0 
    ? activeServices.map(s => ({ value: s.valor, label: s.nome }))
    : defaultServices;

  const [categoria, setCategoria] = useState<string>('');
  const [servico, setServico] = useState<string>('');
  const [prioridade, setPrioridade] = useState<string>('media');
  const canCreateForCustomer = hasPermission(currentUser, 'tickets.criar_para_cliente');
  const rawServiceFields = activeServices.find(item => item.valor === servico)?.formulario_json;
  const serviceFields = Array.isArray(rawServiceFields) ? rawServiceFields : [];

  useEffect(() => {
    if (categoryOptions.length > 0 && !categoria) setCategoria(categoryOptions[0].value);
    if (serviceOptions.length > 0 && !servico) setServico(serviceOptions[0].value);
  }, [categoryOptions, serviceOptions, categoria, servico]);

  useEffect(() => {
    if (!isOpen || requesterMode !== 'customer' || requesterSearch.trim().length < 2) {
      setRequesterResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        setRequesterResults(await api.get<RequesterOption[]>(`/tickets/requesters?search=${encodeURIComponent(requesterSearch.trim())}`));
      } catch { setRequesterResults([]); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [isOpen, requesterMode, requesterSearch]);

  const handleCreateTicket = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoadingCreate(true);
    setCreateError(null);
    const formData = new FormData(e.currentTarget);
    const data: any = Object.fromEntries(formData.entries());
    data.campos_personalizados = customFields;
    if (requesterMode === 'customer') {
      data.solicitante = selectedRequester
        ? { usuario_id: selectedRequester.usuario_id, nome: selectedRequester.nome, email: selectedRequester.email }
        : { nome: newRequesterName.trim(), email: newRequesterEmail.trim() };
    }

    try {
      if (data.titulo && String(data.titulo).length < 3) throw new Error("O título precisa ter no mínimo 3 caracteres");
      if (data.descricao && String(data.descricao).length < 5) throw new Error("A descrição precisa ter no mínimo 5 caracteres");
      
      await api.post('/tickets', data);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar chamado.';
      setCreateError(message);
    } finally {
      setLoadingCreate(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Novo chamado"
      size="lg"
    >
      <form onSubmit={handleCreateTicket} className="space-y-4">
        {createError && (
            <div className="p-2 bg-red-50 border border-red-100 rounded text-red-600 text-xs font-medium mb-2">
              {createError}
            </div>
          )}
        
        <div className="space-y-1">
          <Input 
            label="Assunto do Chamado"
            name="titulo" 
            required 
            placeholder="Descreva o assunto brevemente" 
            minLength={3}
            className="h-9 text-sm"
          />
        </div>

        {canCreateForCustomer && (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Solicitante</label>
              <Select
                value={requesterMode}
                onChange={value => { setRequesterMode(value as 'self' | 'customer'); setSelectedRequester(null); }}
                options={[
                  { value: 'self', label: `${currentUser.nome} (eu)` },
                  { value: 'customer', label: 'Cliente' },
                ]}
              />
            </div>
            {requesterMode === 'customer' && (
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    label="Buscar cliente já atendido"
                    value={requesterSearch}
                    onChange={event => { setRequesterSearch(event.target.value); setSelectedRequester(null); }}
                    placeholder="Digite nome ou e-mail"
                  />
                  {requesterResults.length > 0 && !selectedRequester && (
                    <div className="absolute z-30 mt-1 max-h-44 w-full overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                      {requesterResults.map((item, index) => (
                        <button
                          key={`${item.usuario_id || 'externo'}-${item.email}-${index}`}
                          type="button"
                          onClick={() => { setSelectedRequester(item); setRequesterSearch(`${item.nome} — ${item.email}`); }}
                          className="block w-full rounded px-2 py-2 text-left hover:bg-blue-50"
                        >
                          <span className="block text-xs font-semibold text-slate-800">{item.nome}</span>
                          <span className="block text-xs text-slate-500">{item.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {!selectedRequester && (
                  <div className="grid gap-2 border-t border-slate-200 pt-3 sm:grid-cols-2">
                    <Input label="Nome do novo solicitante" value={newRequesterName} onChange={event => setNewRequesterName(event.target.value)} required />
                    <Input label="E-mail do novo solicitante" type="email" value={newRequesterEmail} onChange={event => setNewRequesterEmail(event.target.value)} required />
                  </div>
                )}
                {selectedRequester && <p className="text-xs font-medium text-emerald-700">Chamado será aberto para {selectedRequester.nome}.</p>}
              </div>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Categoria</label>
            <Select 
              name="categoria"
              value={categoria}
              onChange={setCategoria}
              options={categoryOptions}
              buttonClassName="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Serviço</label>
            <Select 
              name="servico"
              value={servico}
              onChange={value => { setServico(value); setCustomFields({}); }}
              options={serviceOptions}
              buttonClassName="h-9 text-sm"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-slate-700">Prioridade</label>
            <Select 
              name="prioridade"
              value={prioridade}
              onChange={setPrioridade}
              buttonClassName="h-9 text-sm"
              options={[
                { value: 'baixa', label: 'Baixa' },
                { value: 'media', label: 'Média' },
                { value: 'alta', label: 'Alta' },
                { value: 'urgente', label: 'Urgente' }
              ]}
            />
          </div>
        </div>

        <ServiceFormFields fields={serviceFields} values={customFields} onChange={setCustomFields} />

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">Descrição</label>
          <textarea 
            name="descricao" 
            required
            minLength={5}
            rows={4}
            placeholder="Descreva os detalhes da sua solicitação..."
            className="w-full bg-slate-50 border border-slate-200 rounded-md p-2.5 text-sm outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all resize-none"
          ></textarea>
        </div>

        <div className="pt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button size="sm" type="submit" loading={loadingCreate}>
              Criar chamado
            </Button>
        </div>
      </form>
    </Modal>
  );
};
