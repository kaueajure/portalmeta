import React, { useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { PortalTab } from './PortalLayout';
import { Send } from 'lucide-react';
import { useTicketOptions } from '../../hooks/useTicketOptions';
import { FileUpload } from '../ui/FileUpload';
import { ServiceFormFields } from '../tickets/ServiceFormFields';

interface PortalNewTicketPageProps {
  onNavigate: (tab: PortalTab, ticketId?: number) => void;
}

export const PortalNewTicketPage = ({ onNavigate }: PortalNewTicketPageProps) => {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [servico, setServico] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { activeCategories, activeServices, loading: optionsLoading, error: optionsError } = useTicketOptions('/portal/options');
  const rawServiceFields = activeServices.find(item => item.valor === servico)?.formulario_json;
  const serviceFields = Array.isArray(rawServiceFields) ? rawServiceFields : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo || !descricao) {
      setError('Por favor, preencha o título e a descrição.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('titulo', titulo);
      formData.append('descricao', descricao);
      formData.append('categoria', categoria);
      formData.append('servico', servico);
      formData.append('campos_personalizados', JSON.stringify(customFields));
      files.forEach(file => formData.append('files', file));
      const data = await api.post<{message: string, ticketId: number}>('/portal/tickets', formData);
      onNavigate('tickets', data.ticketId);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar chamado');
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="space-y-4">
        <div>
          <h1 className="mb-1 text-lg font-semibold tracking-tight text-slate-950">Abrir novo chamado</h1>
          <p className="text-slate-500 text-sm">Preencha os detalhes abaixo para que possamos te ajudar da melhor forma.</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-md border border-red-100">
                {error}
              </div>
            )}
            {optionsError && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Não foi possível carregar categorias e serviços. Tente recarregar a página.</div>}
            
            <Input
              label="Assunto do Chamado"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Problema de acesso, Dúvida sobre funcionalidade..."
              required
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 px-1">Categoria (Opcional)</label>
                <Select
                  value={categoria}
                  onChange={setCategoria}
                  options={[
                    { value: '', label: 'Selecione...' },
                    ...activeCategories.map(c => ({ value: c.valor, label: c.nome }))
                  ]}
                  disabled={optionsLoading}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 px-1">Serviço (Opcional)</label>
                <Select
                  value={servico}
                  onChange={value => { setServico(value); setCustomFields({}); }}
                  options={[
                    { value: '', label: 'Selecione...' },
                    ...activeServices.map(s => ({ value: s.valor, label: s.nome }))
                  ]}
                  disabled={optionsLoading}
                />
              </div>
            </div>

            <ServiceFormFields fields={serviceFields} values={customFields} onChange={setCustomFields} />

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 px-1">Descrição Detalhada</label>
              <textarea
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                required
                rows={4}
                placeholder="Descreva o máximo de detalhes possível para agilizarmos seu atendimento..."
                className="w-full resize-y rounded-md border border-slate-200 bg-slate-50/80 p-3 text-sm outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Anexos</label>
              <FileUpload onFilesChange={setFiles} />
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" disabled={loading} className="w-full sm:w-auto h-9 px-6 text-sm">
                {loading ? 'Criando...' : <span className="flex items-center"><Send size={16} className="mr-2" /> Enviar Chamado</span>}
              </Button>
            </div>
          </form>
        </div>
      </div>

    </div>
  );
};
