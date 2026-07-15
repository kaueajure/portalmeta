import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Select } from '../ui/Select';
import { Plus, Zap, Edit2, Trash2, X, PlusCircle, AlertCircle, Info, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';

const parseJsonArray = (value: any) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const DEFAULT_STATUS_OPTIONS = [
  { value: 'aberto', label: 'Aberto' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'resolvido', label: 'Finalizado' },
];

const PRIORITY_OPTIONS = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

const GATILHOS = [
  { value: 'ticket_criado', label: 'Chamado criado' },
  { value: 'status_alterado', label: 'Status Alterado' },
  { value: 'prioridade_alterada', label: 'Prioridade Alterada' },
  { value: 'responsavel_alterado', label: 'Responsável Alterado' },
  { value: 'ticket_atualizado', label: 'Chamado atualizado' },
  { value: 'sla_primeira_resposta_vencido', label: 'SLA 1ª Resposta Vencido' },
  { value: 'sla_resolucao_vencido', label: 'SLA Resolução Vencido' },
  { value: 'tempo_sem_interacao', label: 'Tempo sem Interação' },
  { value: 'aguardando_cliente_por_tempo', label: 'Aguardando Cliente por Tempo' },
];

const CONDICAO_CAMPOS = [
  { value: 'status', label: 'Status' },
  { value: 'prioridade', label: 'Prioridade' },
  { value: 'categoria', label: 'Categoria' },
  { value: 'servico', label: 'Serviço' },
  { value: 'origem', label: 'Origem' },
  { value: 'responsavel_definido', label: 'Responsável Definido' },
  { value: 'tag', label: 'Tag' },
  { value: 'horas_desde_criacao', label: 'Horas desde Criação' },
  { value: 'horas_desde_atualizacao', label: 'Horas desde Atualização' },
  { value: 'sla_resolucao_vencido', label: 'SLA Resolução Vencido' },
];

const ACAO_TIPOS = [
  { value: 'alterar_status', label: 'Alterar Status' },
  { value: 'alterar_prioridade', label: 'Alterar Prioridade' },
  { value: 'atribuir_responsavel', label: 'Atribuir Responsável' },
  { value: 'remover_responsavel', label: 'Remover Responsável' },
  { value: 'adicionar_tag', label: 'Adicionar Tag' },
  { value: 'adicionar_comentario', label: 'Adicionar Comentário Interno' },
  { value: 'notificar_responsavel', label: 'Notificar Responsável' },
  { value: 'fechar_com_motivo', label: 'Fechar Chamado com Motivo' },
];

export const AutomationsManager = ({ currentCompanyId }: { currentCompanyId: number }) => {
  const [automations, setAutomations] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [statusOptions, setStatusOptions] = useState<{ value: string; label: string }[]>(DEFAULT_STATUS_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Form State
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [evento, setEvento] = useState('ticket_criado');
  const [ativo, setAtivo] = useState(true);
  const [ordem, setOrdem] = useState('0');
  const [condicoes, setCondicoes] = useState<any[]>([]);
  const [acoes, setAcoes] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    if (currentCompanyId) {
      setLoading(true);
      Promise.all([
        api.get(`/automations/company/${currentCompanyId}`),
        api.get(`/usuarios/empresa/${currentCompanyId}`),
        api.get<any[]>(`/companies/${currentCompanyId}/ticket-statuses`).catch(() => [])
      ]).then(([autoRes, userRes, statusRows]) => {
         setAutomations((autoRes as any).data || autoRes);
         const allUsers = (userRes as any).data || userRes;
         setAgents(allUsers.filter((u: any) => u.atendente || u.administrador));
         const mappedStatuses = (statusRows as any[])
           .filter((status: any) => Number(status.ativo) === 1)
           .map((status: any) => ({ value: status.valor, label: status.nome }));
         setStatusOptions(mappedStatuses.length > 0 ? mappedStatuses : DEFAULT_STATUS_OPTIONS);
      }).catch(err => {
         console.error('Error fetching data', err);
      }).finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    loadData();
  }, [currentCompanyId]);

  const handleOpenModal = (item?: any) => {
    setError(null);
    if (item) {
      setEditingItem(item);
      setNome(item.nome || '');
      setDescricao(item.descricao || '');
      setEvento(item.evento || 'ticket_criado');
      setAtivo(item.ativo === 1 || item.ativo === true);
      setOrdem(String(item.ordem || 0));
      setCondicoes(parseJsonArray(item.condicoes_json));
      setAcoes(parseJsonArray(item.acoes_json));
    } else {
      setEditingItem(null);
      setNome('');
      setDescricao('');
      setEvento('ticket_criado');
      setAtivo(true);
      setOrdem('0');
      setCondicoes([]);
      setAcoes([]);
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!nome.trim() || !evento) {
      setError('Nome e evento são obrigatórios.');
      return;
    }
    if (acoes.length === 0) {
      setError('Pelo menos uma ação é obrigatória.');
      return;
    }
    setError(null);
    try {
      const payload = {
        nome,
        descricao,
        evento,
        ativo: ativo ? 1 : 0,
        ordem: parseInt(ordem) || 0,
        condicoes_json: condicoes,
        acoes_json: acoes
      };

      if (editingItem) {
        await api.patch(`/automations/${editingItem.id}`, payload);
      } else {
        await api.post(`/automations/company/${currentCompanyId}`, payload);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar automação.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Excluir automação? Essa ação é irreversível.')) return;
    try {
      await api.delete(`/automations/${id}`);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const addCondicao = () => setCondicoes([...condicoes, { campo: 'status', operador: 'igual', valor: '' }]);
  const updateCondicao = (index: number, key: string, value: string) => {
    const newConds = [...condicoes];
    newConds[index][key] = value;
    // Reset defaults if field changes
    if (key === 'campo') {
       if (value === 'responsavel_definido') newConds[index].valor = 'true';
       else if (value.includes('horas')) newConds[index].valor = '24';
       else newConds[index].valor = '';
    }
    setCondicoes(newConds);
  };
  const removeCondicao = (index: number) => setCondicoes(condicoes.filter((_, i) => i !== index));

  const addAcao = () => setAcoes([...acoes, { tipo: 'alterar_status', valor: statusOptions[0]?.value || '' }]);
  const updateAcao = (index: number, key: string, value: string) => {
    const newAcoes = [...acoes];
    newAcoes[index][key] = value;
    if (key === 'tipo') {
       if (value === 'alterar_status') newAcoes[index].valor = statusOptions[0]?.value || '';
       else if (value === 'alterar_prioridade') newAcoes[index].valor = 'media';
       else newAcoes[index].valor = '';
    }
    setAcoes(newAcoes);
  };
  const removeAcao = (index: number) => setAcoes(acoes.filter((_, i) => i !== index));

  const getSummary = (item: any) => {
    const cCount = parseJsonArray(item.condicoes_json).length;
    const aCount = parseJsonArray(item.acoes_json).length;
    const trigger = GATILHOS.find(g => g.value === item.evento)?.label || item.evento;
    return `Quando "${trigger}", se atender ${cCount} condições, executar ${aCount} ações.`;
  };

  return (
    <Card className="p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Zap size={16} className="text-blue-500" /> Automações
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Configure o motor de regras automáticas.</p>
        </div>
        <Button size="sm" onClick={() => handleOpenModal()} className="h-8 text-xs shrink-0 bg-blue-600 hover:bg-blue-700">
          <Plus size={14} className="mr-1" /> Criar regra
        </Button>
      </div>

      {loading ? (
        <div className="text-xs text-slate-500 p-2">Carregando automações...</div>
      ) : automations.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-lg border border-dashed border-slate-200">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
             <Zap size={20} className="text-slate-400" />
          </div>
          <div className="text-xs font-semibold text-slate-700">Nenhuma automação ativa</div>
          <div className="text-xs text-slate-500 max-w-[250px] text-center mt-1">
            Automatize chamados baseados em eventos ou tempo.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {automations.map(a => (
            <div key={a.id} className="group p-3 border border-slate-200 rounded-md bg-white flex flex-col sm:flex-row justify-between gap-3 hover:border-blue-200 transition-all">
               <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-2 mb-1">
                   <h4 className="text-sm font-medium text-slate-800 truncate">{a.nome}</h4>
                   {a.ativo ? (
                     <Badge variant="emerald" className="text-[10px] h-5">Ativa</Badge>
                   ) : (
                     <Badge variant="slate" className="text-[10px] h-5">Inativa</Badge>
                   )}
                 </div>
                 <p className="text-xs text-slate-500 mb-2 truncate">{a.descricao || 'Sem descrição'}</p>
                 <div className="flex items-center gap-2 text-xs bg-slate-50 p-1.5 rounded border border-slate-100">
                    <span className="font-medium text-slate-500">Regra:</span>
                    <span className="text-slate-600 truncate">{getSummary(a)}</span>
                 </div>
               </div>
               <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Button variant="outline" size="sm" className="h-7 px-2 border-slate-200" onClick={() => handleOpenModal(a)}>
                    <Edit2 size={12} className="mr-1" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-red-600 border-slate-200 hover:bg-red-50" onClick={() => handleDelete(a.id)}>
                    <Trash2 size={12} />
                  </Button>
               </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg relative flex flex-col max-h-[95vh] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                 <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
                    <Zap size={16} />
                 </div>
                 <h3 className="font-semibold text-slate-900 text-sm">
                   {editingItem ? 'Editar Automação' : 'Configurar Nova Automação'}
                 </h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-50 text-slate-400"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              {error && (
                <div className="p-2 bg-red-50 border border-red-100 text-red-600 text-xs font-medium rounded-md flex items-center gap-1.5">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              {/* Informações Básicas */}
              <section className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-700 pb-1 border-b border-slate-100">Informações Básicas</h4>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-8 space-y-1">
                    <label className="text-xs font-medium text-slate-700">Título</label>
                    <Input 
                      value={nome} 
                      onChange={e => setNome(e.target.value)} 
                      placeholder="Ex: Auto-fechamento tickets inativos" 
                      className="text-xs h-8"
                    />
                  </div>
                  <div className="sm:col-span-4 space-y-1">
                    <label className="text-xs font-medium text-slate-700">Prioridade</label>
                    <Input 
                      type="number" 
                      value={ordem} 
                      onChange={e => setOrdem(e.target.value)} 
                      className="text-xs h-8"
                      placeholder="0"
                    />
                  </div>
                  <div className="sm:col-span-12 space-y-1">
                    <label className="text-xs font-medium text-slate-700">Descrição</label>
                    <Input 
                      value={descricao} 
                      onChange={e => setDescricao(e.target.value)} 
                      placeholder="Descreva o propósito desta regra" 
                      className="text-xs h-8"
                    />
                  </div>
                </div>
              </section>

              {/* Gatilho */}
              <section className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-700 pb-1 border-b border-slate-100">Gatilho (Evento)</h4>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Quando ocorrer:</label>
                  <Select 
                    value={evento} 
                    onChange={setEvento}
                    options={GATILHOS}
                    buttonClassName="h-8 text-xs"
                   />
                </div>
              </section>

              {/* Condições */}
              <section className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                   <h4 className="text-xs font-semibold text-slate-700">Condições (Filtros)</h4>
                   <Button variant="ghost" size="sm" onClick={addCondicao} className="h-6 px-2 text-[11px] font-medium text-blue-600 hover:bg-blue-50">
                     <PlusCircle size={12} className="mr-1" /> Adicionar Filtro
                   </Button>
                </div>
                
                {condicoes.length === 0 ? (
                  <div className="p-4 border border-dashed border-slate-200 rounded-md flex flex-col items-center justify-center text-center bg-slate-50/50">
                    <p className="text-xs text-slate-500 font-medium">
                      Sem filtros. Aplicará a todos que dispararem o gatilho.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {condicoes.map((cond, i) => (
                      <div key={i} className="group relative flex flex-col sm:flex-row items-start sm:items-center gap-2 p-2 border border-slate-200 rounded-md bg-white hover:border-slate-300">
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
                          <select 
                            className="h-8 text-xs border border-slate-200 rounded-md px-2 outline-none font-medium text-slate-700"
                            value={cond.campo}
                            onChange={e => updateCondicao(i, 'campo', e.target.value)}
                          >
                            {CONDICAO_CAMPOS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                          </select>

                          {/* Operador depends on type of field */}
                          {['status', 'prioridade', 'categoria', 'servico', 'origem', 'responsavel_definido'].includes(cond.campo) ? (
                            <select 
                              className="h-8 text-xs border border-slate-200 rounded-md px-2 outline-none font-medium text-slate-600"
                              value={cond.operador}
                              onChange={e => updateCondicao(i, 'operador', e.target.value)}
                            >
                              <option value="igual">É igual a</option>
                              <option value="diferente">É diferente de</option>
                              {['categoria', 'servico', 'tag'].includes(cond.campo) && <option value="contem">Contém</option>}
                            </select>
                          ) : (
                            <div className="h-8 flex items-center px-2 text-[11px] bg-slate-50 rounded-md text-slate-500 font-medium">
                                {cond.campo === 'sla_resolucao_vencido' ? 'Sempre' : 'For maior que'}
                            </div>
                          )}

                          {/* Value Input depends on field */}
                          {cond.campo === 'status' ? (
                            <select 
                              className="h-8 text-xs border border-slate-200 rounded-md px-2 outline-none font-medium"
                              value={cond.valor}
                              onChange={e => updateCondicao(i, 'valor', e.target.value)}
                            >
                              {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          ) : cond.campo === 'prioridade' ? (
                            <select 
                              className="h-8 text-xs border border-slate-200 rounded-md px-2 outline-none font-medium"
                              value={cond.valor}
                              onChange={e => updateCondicao(i, 'valor', e.target.value)}
                            >
                              {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          ) : cond.campo === 'responsavel_definido' ? (
                            <select 
                              className="h-8 text-xs border border-slate-200 rounded-md px-2 outline-none font-medium"
                              value={cond.valor}
                              onChange={e => updateCondicao(i, 'valor', e.target.value)}
                            >
                              <option value="true">Sim (Definido)</option>
                              <option value="false">Não (Vazio)</option>
                            </select>
                          ) : cond.campo === 'sla_resolucao_vencido' ? (
                             <div className="h-8 flex items-center px-2 text-[11px] text-slate-400 font-medium bg-slate-50 rounded-md">Auto-avaliado</div>
                          ) : (
                            <Input 
                              type={cond.campo.includes('horas') ? 'number' : 'text'} 
                              className="h-8 text-xs font-medium"
                              placeholder={cond.campo.includes('horas') ? 'Ex: 24' : 'Valor'}
                              value={cond.valor}
                              onChange={e => updateCondicao(i, 'valor', e.target.value)}
                            />
                          )}
                        </div>
                        <button 
                          onClick={() => removeCondicao(i)} 
                          className="p-1 h-8 w-8 flex items-center justify-center text-slate-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Ações */}
              <section className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                   <h4 className="text-xs font-semibold text-slate-700">Ações</h4>
                   <Button variant="ghost" size="sm" onClick={addAcao} className="h-6 px-2 text-[11px] font-medium text-blue-600 hover:bg-blue-50">
                     <PlusCircle size={12} className="mr-1" /> Adicionar Ação
                   </Button>
                </div>
                
                {acoes.length === 0 ? (
                  <div className="p-4 border border-dashed border-red-200 rounded-md flex flex-col items-center justify-center text-center bg-red-50/50">
                    <p className="text-[11px] text-red-600 font-medium">
                      Configure ao menos uma ação.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {acoes.map((acao, i) => (
                      <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-2 border border-slate-200 rounded-md bg-white hover:border-slate-300 transition-all">
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                          <select 
                            className="h-8 text-xs border border-slate-200 rounded-md px-2 outline-none font-medium text-slate-700"
                            value={acao.tipo}
                            onChange={e => updateAcao(i, 'tipo', e.target.value)}
                          >
                            {ACAO_TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>

                          {/* Value for action */}
                          {acao.tipo === 'alterar_status' ? (
                             <select 
                               className="h-8 text-xs border border-slate-200 rounded-md px-2 outline-none font-medium"
                               value={acao.valor}
                               onChange={e => updateAcao(i, 'valor', e.target.value)}
                             >
                                {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                             </select>
                          ) : acao.tipo === 'alterar_prioridade' ? (
                             <select 
                               className="h-8 text-xs border border-slate-200 rounded-md px-2 outline-none font-medium"
                               value={acao.valor}
                               onChange={e => updateAcao(i, 'valor', e.target.value)}
                             >
                               {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                             </select>
                          ) : acao.tipo === 'atribuir_responsavel' ? (
                             <select 
                               className="h-8 text-xs border border-slate-200 rounded-md px-2 outline-none font-medium"
                               value={acao.valor}
                               onChange={e => updateAcao(i, 'valor', String(e.target.value))}
                             >
                               <option value="">Selecionar Atendente</option>
                               {agents.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                             </select>
                          ) : acao.tipo === 'remover_responsavel' || acao.tipo === 'notificar_responsavel' ? (
                             <div className="h-8 flex items-center px-2 text-[11px] text-slate-500 bg-slate-50 rounded-md">Automático</div>
                          ) : (
                             <Input 
                               className="h-8 text-xs font-medium"
                               placeholder={acao.tipo === 'adicionar_comentario' ? 'Texto do comentário' : 'Valor'}
                               value={acao.valor}
                               onChange={e => updateAcao(i, 'valor', e.target.value)}
                             />
                          )}
                        </div>
                        <button 
                          onClick={() => removeAcao(i)} 
                          className="p-1 h-8 w-8 flex items-center justify-center text-slate-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              
              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-md">
                 <div className={`w-9 h-5 rounded-full p-1 transition-colors cursor-pointer ${ativo ? 'bg-blue-600' : 'bg-slate-300'}`} onClick={() => setAtivo(!ativo)}>
                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${ativo ? 'translate-x-4' : 'translate-x-0'}`} />
                 </div>
                 <label className="text-xs font-medium text-slate-700 cursor-pointer" onClick={() => setAtivo(!ativo)}>
                    Regra Ativada
                 </label>
              </div>

            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
              <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleSave}>
                 {editingItem ? 'Salvar' : 'Criar Automação'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

