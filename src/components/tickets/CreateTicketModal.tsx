import React, { useState, useEffect } from 'react';
import { Building, Loader2 } from 'lucide-react';
import { User, Empresa as Company } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { api } from '../../lib/api';
import { useTicketOptions } from '../../hooks/useTicketOptions';
import { getCategoryShortLabel } from '../../lib/ticketOptions';

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onSuccess: () => void;
}

export const CreateTicketModal = ({ isOpen, onClose, currentUser, onSuccess }: CreateTicketModalProps) => {
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [empresaId, setEmpresaId] = useState<string>('');
  const targetCompanyId = currentUser.desenvolvedor ? empresaId : String(currentUser.empresa_id);
  
  const { activeCategories, activeServices, loading: optionsLoading } = useTicketOptions(targetCompanyId || undefined);

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

  useEffect(() => {
    if (categoryOptions.length > 0 && !categoria) setCategoria(categoryOptions[0].value);
    if (serviceOptions.length > 0 && !servico) setServico(serviceOptions[0].value);
  }, [categoryOptions, serviceOptions, categoria, servico]);

  useEffect(() => {
    if (isOpen && !!currentUser.desenvolvedor && !currentUser.empresa_id) {
      fetchCompanies();
    }
  }, [isOpen, currentUser]);

  const fetchCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const data = await api.get<Company[]>('/companies');
      setCompanies(data);
    } catch (err) {
      console.error('Erro ao buscar empresas:', err);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoadingCreate(true);
    setCreateError(null);
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    if (!!currentUser.desenvolvedor && !currentUser.empresa_id && !data.empresa_id) {
       setCreateError('Selecione uma empresa para abrir o chamado.');
       setLoadingCreate(false);
       return;
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

         {!!currentUser.desenvolvedor && !currentUser.empresa_id && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Empresa Solicitante</label>
            <div className="relative">
              <Building className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={14} />
              <Select 
                name="empresa_id"
                value={empresaId}
                onChange={setEmpresaId}
                placeholder="Selecione uma empresa..."
                buttonClassName="pl-8 h-9 text-sm"
                options={companies.map(emp => ({
                  value: String(emp.id),
                  label: emp.nome
                }))}
              />
              {loadingCompanies && (
                <div className="absolute right-8 top-1/2 -translate-y-1/2 z-10">
                  <Loader2 size={14} className="animate-spin text-blue-600" />
                </div>
              )}
            </div>
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
              onChange={setServico}
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
