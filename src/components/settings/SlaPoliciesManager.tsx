import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Plus, Trash2, Edit2, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useTicketOptions } from '../../hooks/useTicketOptions';

export const SlaPoliciesManager = ({ currentCompanyId }: { currentCompanyId: number }) => {
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<any>(null);

  const [nome, setNome] = useState('');
  const [prioridade, setPrioridade] = useState('');
  const [categoria, setCategoria] = useState('');
  const [servico, setServico] = useState('');
  const [tempoResolucao, setTempoResolucao] = useState('');

  const { categories, services } = useTicketOptions(currentCompanyId);

  const loadData = () => {
    if (currentCompanyId) {
      setLoading(true);
      api.get(`/companies/${currentCompanyId}/sla-policies`).then(res => {
         setPolicies((res as any).data || res);
      }).catch(err => {
         console.error('Error loading SLAs', err);
      }).finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    loadData();
  }, [currentCompanyId]);

  const handleOpenModal = (policy?: any) => {
    if (policy) {
      setEditingPolicy(policy);
      setNome(policy.nome);
      setPrioridade(policy.prioridade || '');
      setCategoria(policy.categoria || '');
      setServico(policy.servico || '');
      setTempoResolucao(String(policy.tempo_resolucao_minutos / 60));
    } else {
      setEditingPolicy(null);
      setNome('');
      setPrioridade('');
      setCategoria('');
      setServico('');
      setTempoResolucao('24');
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        nome,
        prioridade: prioridade || null,
        categoria: categoria || null,
        servico: servico || null,
        tempo_resolucao_minutos: parseInt(tempoResolucao) * 60,
        ativo: 1
      };

      if (editingPolicy) {
        await api.patch(`/companies/${currentCompanyId}/sla-policies/${editingPolicy.id}`, payload);
      } else {
        await api.post(`/companies/${currentCompanyId}/sla-policies`, payload);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      console.error('Save failed', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Excluir esta política?')) return;
    try {
      await api.delete(`/companies/${currentCompanyId}/sla-policies/${id}`);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Políticas de SLA</h3>
          <p className="text-xs text-slate-500">Configure prazos de resolução.</p>
        </div>
        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleOpenModal()}>
          <Plus size={14} className="mr-1" /> Nova política
        </Button>
      </div>

      {loading ? (
        <div className="text-xs text-slate-500">Carregando...</div>
      ) : policies.length === 0 ? (
        <div className="text-xs text-slate-500 italic p-4 bg-slate-50 rounded-lg text-center border border-slate-100">
          Nenhuma política configurada. Utilizando SLA padrão do sistema.
        </div>
      ) : (
        <div className="space-y-1.5">
          {policies.map(p => (
            <div key={p.id} className="flex items-center justify-between p-2 border border-slate-100 rounded-md bg-slate-50">
               <div>
                 <div className="text-sm font-medium">{p.nome}</div>
                 <div className="text-[11px] text-slate-500">
                   Prioridade: {p.prioridade || 'Todas'} 
                   {p.categoria ? ` • Categoria: ${categories?.find(c => c.valor === p.categoria)?.nome || p.categoria}` : ''}
                   {p.servico ? ` • Serviço: ${services?.find(s => s.valor === p.servico)?.nome || p.servico}` : ''}
                   {' • Resol: '}{p.tempo_resolucao_minutos / 60}h
                 </div>
               </div>
               <div className="flex items-center gap-1">
                  <button onClick={() => handleOpenModal(p)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded bg-white border border-slate-200 shadow-sm">
                    <Edit2 size={12} />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded bg-white border border-slate-200 shadow-sm">
                    <Trash2 size={12} />
                  </button>
               </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 p-4">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold">{editingPolicy ? 'Editar' : 'Nova'} Política SLA</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
               <div>
                 <label className="block text-xs font-medium text-slate-700 mb-1">Nome</label>
                 <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Prioridade SLA Urgente" className="h-8 text-sm" />
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="block text-xs font-medium text-slate-700 mb-1">Prioridade</label>
                   <select value={prioridade} onChange={e => setPrioridade(e.target.value)} className="w-full h-8 px-2 text-sm flex items-center border border-slate-200 rounded-md outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                     <option value="">Todas</option>
                     <option value="baixa">Baixa</option>
                     <option value="media">Média</option>
                     <option value="alta">Alta</option>
                     <option value="urgente">Urgente</option>
                   </select>
                 </div>
                 <div>
                   <label className="block text-xs font-medium text-slate-700 mb-1">Resolver em (horas)</label>
                   <Input type="number" value={tempoResolucao} onChange={e => setTempoResolucao(e.target.value)} className="h-8 text-sm" />
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="block text-xs font-medium text-slate-700 mb-1">Categoria (Opc)</label>
                   <select value={categoria} onChange={e => setCategoria(e.target.value)} className="w-full h-8 px-2 text-sm flex items-center border border-slate-200 rounded-md outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                     <option value="">Todas</option>
                     {categories?.map(c => (
                       <option key={c.valor} value={c.valor}>{c.nome}</option>
                     ))}
                   </select>
                 </div>
                 <div>
                   <label className="block text-xs font-medium text-slate-700 mb-1">Serviço (Opc)</label>
                   <select value={servico} onChange={e => setServico(e.target.value)} className="w-full h-8 px-2 text-sm flex items-center border border-slate-200 rounded-md outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                     <option value="">Todos</option>
                     {services?.map(s => (
                       <option key={s.valor} value={s.valor}>{s.nome}</option>
                     ))}
                   </select>
                 </div>
               </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
              <Button size="sm" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={!nome || !tempoResolucao}>Salvar</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

