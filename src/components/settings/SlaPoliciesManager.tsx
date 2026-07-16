import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { api } from '../../lib/api';
import { useTicketOptions } from '../../hooks/useTicketOptions';

export const SlaPoliciesManager = () => {
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const [nome, setNome] = useState('');
  const [prioridade, setPrioridade] = useState('');
  const [categoria, setCategoria] = useState('');
  const [servico, setServico] = useState('');
  const [tempoResolucao, setTempoResolucao] = useState('');

  const { categories, services } = useTicketOptions();

  const loadData = () => {
      setLoading(true);
      api.get('/ticket-settings/sla-policies').then(res => {
         setPolicies((res as any).data || res);
      }).catch(err => {
         console.error('Error loading SLAs', err);
      }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

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
        await api.patch(`/ticket-settings/sla-policies/${editingPolicy.id}`, payload);
      } else {
        await api.post('/ticket-settings/sla-policies', payload);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      console.error('Save failed', err);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/ticket-settings/sla-policies/${deleteTarget.id}`);
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
                  <button type="button" aria-label={`Editar política ${p.nome}`} onClick={() => handleOpenModal(p)} className="flex h-9 w-9 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-blue-700">
                    <Edit2 size={12} />
                  </button>
                  <button type="button" aria-label={`Excluir política ${p.nome}`} onClick={() => setDeleteTarget(p)} className="flex h-9 w-9 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-red-700">
                    <Trash2 size={12} />
                  </button>
               </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`${editingPolicy ? 'Editar' : 'Nova'} política de SLA`}
        size="sm"
        footer={<><Button size="sm" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button><Button size="sm" onClick={handleSave} disabled={!nome || !tempoResolucao}>Salvar</Button></>}
      >
            <div className="space-y-3">
               <div>
                 <label className="block text-xs font-medium text-slate-700 mb-1">Nome</label>
                 <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Prioridade SLA Urgente" className="h-8 text-sm" />
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="block text-xs font-medium text-slate-700 mb-1">Prioridade</label>
                   <Select value={prioridade} onChange={setPrioridade} options={[{ value: '', label: 'Todas' }, { value: 'baixa', label: 'Baixa' }, { value: 'media', label: 'Média' }, { value: 'alta', label: 'Alta' }, { value: 'urgente', label: 'Urgente' }]} />
                 </div>
                 <div>
                   <label className="block text-xs font-medium text-slate-700 mb-1">Resolver em (horas)</label>
                   <Input type="number" value={tempoResolucao} onChange={e => setTempoResolucao(e.target.value)} className="h-8 text-sm" />
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="block text-xs font-medium text-slate-700 mb-1">Categoria (Opc)</label>
                   <Select value={categoria} onChange={setCategoria} options={[{ value: '', label: 'Todas' }, ...(categories || []).map(c => ({ value: c.valor, label: c.nome }))]} />
                 </div>
                 <div>
                   <label className="block text-xs font-medium text-slate-700 mb-1">Serviço (Opc)</label>
                   <Select value={servico} onChange={setServico} options={[{ value: '', label: 'Todos' }, ...(services || []).map(s => ({ value: s.valor, label: s.nome }))]} />
                 </div>
               </div>
            </div>
      </Modal>
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir política de SLA?"
        description={`A política ${deleteTarget?.nome || ''} deixará de definir prazos para novos chamados. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir política"
        variant="danger"
      />
    </Card>
  );
};
