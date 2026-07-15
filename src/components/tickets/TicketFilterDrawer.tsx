import React from 'react';
import { X, Calendar, Tag as TagIcon, User, Globe, Clock, Search, Layers, ShieldAlert } from 'lucide-react';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { TicketAdvancedFilters as IFilters, TicketStatus, TicketStatusSpecial } from '../../types';
import { AnimatePresence, motion } from 'motion/react';

interface TicketFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  priorityFilter: string;
  setPriorityFilter: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  serviceFilter: string;
  setServiceFilter: (v: string) => void;
  filters: IFilters;
  onFilterChange: (filters: IFilters) => void;
  onClear: () => void;
  agents: any[];
  categoryOptions?: {value: string; label: string}[];
  serviceOptions?: {value: string; label: string}[];
  statusOptions?: { value: TicketStatus; label: string; special?: TicketStatusSpecial | string | null }[];
}

export const TicketFilterDrawer: React.FC<TicketFilterDrawerProps> = ({
  isOpen,
  onClose,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  categoryFilter,
  setCategoryFilter,
  serviceFilter,
  setServiceFilter,
  filters,
  onFilterChange,
  onClear,
  agents,
  categoryOptions,
  serviceOptions,
  statusOptions = []
}) => {
  const handleChange = (field: keyof IFilters, value: any) => {
    onFilterChange({ ...filters, [field]: value });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 w-[320px] max-w-full bg-white shadow-xl z-[110] flex flex-col border-l border-slate-200"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Filtros Avançados</h2>
                <p className="text-xs text-slate-500 mt-0.5">Refine sua busca por chamados</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Fechar filtros"
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-20 space-y-5 no-scrollbar">
              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  <Globe size={14} className="text-slate-400" /> Status do chamado
                </label>
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  buttonClassName="h-8 text-xs font-medium bg-slate-50 border-slate-200 rounded-md px-3"
                  options={[
                    { value: 'todos', label: 'Todos os Status' },
                    ...statusOptions.map((status) => ({
                      value: status.value,
                      label: status.label
                    }))
                  ]}
                  className="w-full"
                />
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  <Clock size={14} className="text-slate-400" /> Prioridade
                </label>
                <Select
                  value={priorityFilter}
                  onChange={setPriorityFilter}
                  buttonClassName="h-8 text-xs font-medium bg-slate-50 border-slate-200 rounded-md px-3"
                  options={[
                    { value: 'todas', label: 'Todas as Prioridades' },
                    { value: 'urgente', label: 'Urgente' },
                    { value: 'alta', label: 'Alta' },
                    { value: 'media', label: 'Média' },
                    { value: 'baixa', label: 'Baixa' }
                  ]}
                  className="w-full"
                />
              </div>

              <div className="h-px bg-slate-100 my-2" />

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  <Layers size={14} className="text-slate-400" /> Categoria
                </label>
                <Select
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  buttonClassName="h-8 text-xs font-medium bg-slate-50 border-slate-200 rounded-md px-3"
                  options={categoryOptions || [
                    { value: 'todas', label: 'Todas as Categorias' }
                  ]}
                  className="w-full"
                />
              </div>

              {/* Service */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  <Search size={14} className="text-slate-400" /> Serviço / Produto
                </label>
                <Select
                  value={serviceFilter}
                  onChange={setServiceFilter}
                  buttonClassName="h-8 text-xs font-medium bg-slate-50 border-slate-200 rounded-md px-3"
                  options={serviceOptions || [
                    { value: 'todos', label: 'Todos os Serviços' }
                  ]}
                  className="w-full"
                />
              </div>

              {/* Responsável */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  <User size={14} className="text-slate-400" /> Atendente Responsável
                </label>
                <Select
                  value={filters.responsavel_id ? String(filters.responsavel_id) : ''}
                  onChange={(value) => handleChange('responsavel_id', value ? parseInt(value) : undefined)}
                  buttonClassName="h-8 text-xs font-medium bg-slate-50 border-slate-200 rounded-md px-3"
                  options={[
                    { value: '', label: 'Qualquer Atendente' },
                    ...agents.map(agent => ({
                      value: String(agent.id),
                      label: agent.nome
                    }))
                  ]}
                  className="w-full"
                />
              </div>

              {/* SLA Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  <ShieldAlert size={14} className="text-slate-400" /> Condição do SLA
                </label>
                <Select
                  value={filters.sla_status || 'todos'}
                  onChange={(value) => handleChange('sla_status', value)}
                  buttonClassName="h-8 text-xs font-medium bg-slate-50 border-slate-200 rounded-md px-3"
                  options={[
                    { value: 'todos', label: 'Todos (Com e Sem SLA)' },
                    { value: 'dentro_sla', label: 'Dentro do Prazo' },
                    { value: 'vencendo', label: 'Vencendo em breve' },
                    { value: 'vencido', label: 'SLA Vencido' },
                    { value: 'sem_sla', label: 'Sem SLA definido' }
                  ]}
                  className="w-full"
                />
              </div>

              {/* Tag */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                   <TagIcon size={14} className="text-slate-400" /> Filtrar por Tag
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    value={filters.tag || ''}
                    onChange={(e) => handleChange('tag', e.target.value)}
                    placeholder="Ex: login, urgente..."
                    className="w-full h-8 bg-slate-50 border border-slate-200 rounded-md px-3 text-xs font-medium focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Criado Em */}
              <div className="space-y-1.5 pb-2">
                <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  <Calendar size={14} className="text-slate-400" /> Intervalo de Criação
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={filters.created_from || ''}
                    onChange={(e) => handleChange('created_from', e.target.value)}
                    className="w-full h-8 bg-slate-50 border border-slate-200 rounded-md px-2 text-xs font-medium focus:ring-1 focus:ring-blue-500 outline-none transition-all text-slate-600"
                  />
                  <input
                    type="date"
                    value={filters.created_to || ''}
                    onChange={(e) => handleChange('created_to', e.target.value)}
                    className="w-full h-8 bg-slate-50 border border-slate-200 rounded-md px-2 text-xs font-medium focus:ring-1 focus:ring-blue-500 outline-none transition-all text-slate-600"
                  />
                </div>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                className="flex-[0.4]"
                onClick={() => {
                  setStatusFilter('todos');
                  setPriorityFilter('todas');
                  setCategoryFilter('todas');
                  setServiceFilter('todos');
                  onClear();
                }}
              >
                Limpar
              </Button>
              <Button 
                size="sm"
                className="flex-[0.6]"
                onClick={onClose}
              >
                Aplicar
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
