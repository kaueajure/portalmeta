
import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { PricingSettings, PricingPlan } from '../../types';
import { 
  Save, 
  RefreshCw, 
  Plus, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  Copy, 
  Info, 
  AlertCircle,
  CheckCircle2,
  Settings,
  Layout,
  MessageSquare,
  HelpCircle,
  Zap,
  ArrowRight,
  CreditCard
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export const PricingSettingsManager: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<PricingSettings | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<PricingSettings>('/public-settings/pricing');
      setSettings(data);
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar configurações de preços.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    setSuccess(null);
    setError(null);

    try {
      await api.put('/public-settings/pricing', settings);
      setSuccess('Configurações salvas com sucesso!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Tem certeza que deseja restaurar os textos padrão da página de preços? Todas as alterações atuais serão perdidas.')) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const data = await api.post<PricingSettings>('/public-settings/pricing/reset', {});
      setSettings(data);
      setSuccess('Configurações restauradas para o padrão.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Falha ao restaurar configurações.');
    } finally {
      setSaving(false);
    }
  };

  const updateHeader = (field: 'title' | 'subtitle', value: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      header: { ...settings.header, [field]: value }
    });
  };

  const updateBilling = (field: keyof NonNullable<PricingSettings['billing']>, value: any) => {
    if (!settings) return;
    setSettings({
      ...settings,
      billing: { 
        ...settings.billing || {
          annualDiscountPercent: 20,
          showBillingToggle: true,
          monthlyLabel: "Mensal",
          annualLabel: "Anual",
          annualEconomyText: "Economize {discount}% no plano anual"
        }, 
        [field]: value 
      }
    });
  };

  const updateCTA = (field: keyof PricingSettings['cta'], value: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      cta: { ...settings.cta, [field]: value }
    });
  };

  const updatePlan = (index: number, updates: Partial<PricingPlan>) => {
    if (!settings) return;
    const newPlans = [...settings.plans];
    newPlans[index] = { ...newPlans[index], ...updates };
    setSettings({ ...settings, plans: newPlans });
  };

  const addPlan = () => {
    if (!settings) return;
    const newPlan: PricingPlan = {
      id: `plan-${Date.now()}`,
      name: 'Novo Plano',
      target: 'Descrição do público-alvo',
      highlightText: 'Destaque',
      priceLabel: 'Sob consulta',
      priceMode: 'consult',
      priceMonthly: null,
      features: ['Nova funcionalidade'],
      highlight: false,
      active: true,
      order: settings.plans.length + 1
    };
    setSettings({ ...settings, plans: [...settings.plans, newPlan] });
  };

  const removePlan = (index: number) => {
    if (!settings) return;
    const newPlans = settings.plans.filter((_, i) => i !== index);
    setSettings({ ...settings, plans: newPlans });
  };

  const movePlan = (index: number, direction: 'up' | 'down') => {
    if (!settings) return;
    const newPlans = [...settings.plans];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newPlans.length) return;

    [newPlans[index], newPlans[targetIndex]] = [newPlans[targetIndex], newPlans[index]];
    
    // Update orders
    const orderedPlans = newPlans.map((p, i) => ({ ...p, order: i + 1 }));
    setSettings({ ...settings, plans: orderedPlans });
  };

  const addFeature = (planIndex: number) => {
    if (!settings) return;
    const newPlans = [...settings.plans];
    newPlans[planIndex].features.push('Nova funcionalidade');
    setSettings({ ...settings, plans: newPlans });
  };

  const removeFeature = (planIndex: number, featureIndex: number) => {
    if (!settings) return;
    const newPlans = [...settings.plans];
    newPlans[planIndex].features = newPlans[planIndex].features.filter((_, i) => i !== featureIndex);
    setSettings({ ...settings, plans: newPlans });
  };

  const updateFeature = (planIndex: number, featureIndex: number, value: string) => {
    if (!settings) return;
    const newPlans = [...settings.plans];
    newPlans[planIndex].features[featureIndex] = value;
    setSettings({ ...settings, plans: newPlans });
  };

  const addProposalFactor = () => {
    if (!settings) return;
    setSettings({ ...settings, proposalFactors: [...settings.proposalFactors, 'Novo fator'] });
  };

  const removeProposalFactor = (index: number) => {
    if (!settings) return;
    setSettings({ ...settings, proposalFactors: settings.proposalFactors.filter((_, i) => i !== index) });
  };

  const updateProposalFactor = (index: number, value: string) => {
    if (!settings) return;
    const newFactors = [...settings.proposalFactors];
    newFactors[index] = value;
    setSettings({ ...settings, proposalFactors: newFactors });
  };

  const addFAQ = () => {
    if (!settings) return;
    setSettings({ 
      ...settings, 
      faq: [...settings.faq, { question: 'Nova pergunta', answer: 'Sua resposta aqui.' }] 
    });
  };

  const removeFAQ = (index: number) => {
    if (!settings) return;
    setSettings({ ...settings, faq: settings.faq.filter((_, i) => i !== index) });
  };

  const updateFAQ = (index: number, field: 'question' | 'answer', value: string) => {
    if (!settings) return;
    const newFAQ = [...settings.faq];
    newFAQ[index] = { ...newFAQ[index], [field]: value };
    setSettings({ ...settings, faq: newFAQ });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200">
         <RefreshCw size={32} className="text-blue-500 animate-spin mb-4" />
         <p className="text-sm font-medium text-slate-500">Carregando configurações de preços...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-8 text-center bg-red-50 rounded-xl border border-red-100">
        <AlertCircle className="mx-auto text-red-500 mb-2" size={32} />
        <h4 className="text-red-900 font-bold mb-1">Erro ao carregar dados</h4>
        <p className="text-red-700 text-sm">{error || 'Não foi possível carregar as configurações.'}</p>
        <Button variant="outline" className="mt-4" onClick={fetchSettings}>Tentar Novamente</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
           <h3 className="text-lg font-bold text-slate-900">Configurar Página de Preços</h3>
           <p className="text-sm text-slate-500">Gerencie planos, textos e destaques da página pública /precos.</p>
        </div>
        <div className="flex items-center gap-2">
           {(success || error) && (
             <div className={cn(
               "px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-1",
               success ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"
             )}>
                {success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                {success || error}
             </div>
           )}
           <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
              Restaurar Padrão
           </Button>
           <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <RefreshCw size={14} className="animate-spin mr-2" /> : <Save size={14} className="mr-2" />}
              Salvar Alterações
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          {/* Billing Configuration Section */}
          <Card className="overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
               <CreditCard size={18} className="text-emerald-600" />
               <h4 className="text-sm font-bold text-slate-900">Cobrança e Descontos</h4>
            </div>
            <div className="p-5 space-y-5">
               <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={settings.billing?.showBillingToggle}
                      onChange={(e) => updateBilling('showBillingToggle', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">Mostrar seletor Mensal/Anual</span>
                  </label>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input 
                    type="number"
                    label="Desconto Anual (%)"
                    value={settings.billing?.annualDiscountPercent}
                    onChange={(e) => updateBilling('annualDiscountPercent', Number(e.target.value))}
                    min={0}
                    max={90}
                    placeholder="Ex: 20"
                  />
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Texto de Economia</label>
                    <Input 
                      value={settings.billing?.annualEconomyText}
                      onChange={(e) => updateBilling('annualEconomyText', e.target.value)}
                      placeholder="Ex: Economize {discount}% no plano anual"
                    />
                    <p className="text-[10px] text-slate-500 italic">Use {"{discount}"} para inserir automaticamente o percentual.</p>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input 
                    label="Label do botão Mensal"
                    value={settings.billing?.monthlyLabel}
                    onChange={(e) => updateBilling('monthlyLabel', e.target.value)}
                  />
                  <Input 
                    label="Label do botão Anual"
                    value={settings.billing?.annualLabel}
                    onChange={(e) => updateBilling('annualLabel', e.target.value)}
                  />
               </div>
            </div>
          </Card>

          {/* Header Section */}
          <Card className="overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
               <Layout size={18} className="text-blue-600" />
               <h4 className="text-sm font-bold text-slate-900">Cabeçalho da Página</h4>
            </div>
            <div className="p-5 space-y-4">
               <Input 
                 label="Título Principal"
                 value={settings.header.title}
                 onChange={(e) => updateHeader('title', e.target.value)}
                 placeholder="Ex: Planos para sua operação"
               />
               <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Subtítulo / Descrição</label>
                  <textarea 
                    value={settings.header.subtitle}
                    onChange={(e) => updateHeader('subtitle', e.target.value)}
                    rows={3}
                    className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-100 transition-all outline-none resize-none"
                    placeholder="Descrição detalhada abaixo do título"
                  />
               </div>
            </div>
          </Card>

          {/* Plans Section */}
          <div className="space-y-4">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="blue" className="h-6">Página : /precos</Badge>
                  <h4 className="text-sm font-bold text-slate-900 ml-1">Planos Oferecidos</h4>
                </div>
                <Button variant="subtle" size="sm" onClick={addPlan}>
                   <Plus size={14} className="mr-1.5" /> Adicionar Plano
                </Button>
             </div>

             <div className="space-y-4">
                {settings.plans.map((plan, planIdx) => (
                  <Card key={plan.id} className={cn("overflow-hidden border-2 transition-all", plan.highlight ? "border-blue-100" : "border-slate-100")}>
                    <div className={cn("px-4 py-2 flex items-center justify-between border-b", plan.highlight ? "bg-blue-50/50 border-blue-100" : "bg-slate-50/50 border-slate-100")}>
                       <div className="flex items-center gap-3">
                          <span className="text-slate-400 font-mono text-xs">{planIdx + 1}.</span>
                          <span className="text-sm font-bold text-slate-900">{plan.name || 'Sem nome'}</span>
                          {plan.highlight && <Badge variant="blue" className="text-[10px]">DESTAQUE</Badge>}
                          {!plan.active && <Badge variant="slate" className="text-[10px]">INATIVO</Badge>}
                       </div>
                       <div className="flex items-center gap-1.5">
                          <button 
                            onClick={() => movePlan(planIdx, 'up')} 
                            disabled={planIdx === 0}
                            className="p-1.5 text-slate-400 hover:text-slate-900 disabled:opacity-30"
                          >
                             <ChevronUp size={16} />
                          </button>
                          <button 
                            onClick={() => movePlan(planIdx, 'down')} 
                            disabled={planIdx === settings.plans.length - 1}
                            className="p-1.5 text-slate-400 hover:text-slate-900 disabled:opacity-30"
                          >
                             <ChevronDown size={16} />
                          </button>
                          <button 
                            onClick={() => removePlan(planIdx)}
                            className="p-1.5 text-slate-400 hover:text-red-500"
                          >
                             <Trash2 size={16} />
                          </button>
                       </div>
                    </div>
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="space-y-4">
                          <Input 
                            label="Nome do Plano"
                            value={plan.name}
                            onChange={(e) => updatePlan(planIdx, { name: e.target.value })}
                          />
                          <Input 
                            label="Público Alvo"
                            value={plan.target}
                            onChange={(e) => updatePlan(planIdx, { target: e.target.value })}
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                               <label className="text-xs font-bold text-slate-700">Tipo de Preço</label>
                               <select 
                                 value={plan.priceMode || 'consult'}
                                 onChange={(e) => updatePlan(planIdx, { priceMode: e.target.value as any })}
                                 className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-sm focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                               >
                                 <option value="consult">Sob consulta</option>
                                 <option value="fixed">Preço fixo mensal</option>
                               </select>
                            </div>
                            {plan.priceMode === 'fixed' ? (
                              <Input 
                                type="number"
                                label="Preço Mensal (Base)"
                                value={plan.priceMonthly || ''}
                                onChange={(e) => updatePlan(planIdx, { priceMonthly: e.target.value === '' ? null : Number(e.target.value) })}
                                placeholder="0,00"
                              />
                            ) : (
                              <Input 
                                label="Label de Preço"
                                value={plan.priceLabel}
                                onChange={(e) => updatePlan(planIdx, { priceLabel: e.target.value })}
                                placeholder="Sob consulta"
                              />
                            )}
                          </div>

                          {plan.priceMode === 'fixed' && typeof plan.priceMonthly === 'number' && (
                            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-1">
                               <div className="flex justify-between text-[11px]">
                                  <span className="text-slate-500">Normal:</span>
                                  <span className="font-bold text-slate-700">R$ {plan.priceMonthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês</span>
                               </div>
                               <div className="flex justify-between text-[11px]">
                                  <span className="text-emerald-600 font-medium">Anual (com {settings.billing?.annualDiscountPercent}% OFF):</span>
                                  <span className="font-bold text-emerald-700">R$ {(plan.priceMonthly * (1 - (settings.billing?.annualDiscountPercent || 0) / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês</span>
                               </div>
                               <div className="flex justify-between text-[11px] pt-1 border-t border-slate-200 mt-1">
                                  <span className="text-slate-500">Total Anual:</span>
                                  <span className="font-bold text-slate-900 font-mono">R$ {(plan.priceMonthly * 12 * (1 - (settings.billing?.annualDiscountPercent || 0) / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/ano</span>
                               </div>
                            </div>
                          )}

                          <Input 
                            label="Texto de Destaque"
                            value={plan.highlightText}
                            onChange={(e) => updatePlan(planIdx, { highlightText: e.target.value })}
                          />
                          <div className="flex items-center gap-6 pt-2">
                             <label className="flex items-center gap-2 cursor-pointer group">
                               <input 
                                 type="checkbox" 
                                 checked={plan.highlight}
                                 onChange={(e) => updatePlan(planIdx, { highlight: e.target.checked })}
                                 className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                               />
                               <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900">Destacar Plano</span>
                             </label>
                             <label className="flex items-center gap-2 cursor-pointer group">
                               <input 
                                 type="checkbox" 
                                 checked={plan.active}
                                 onChange={(e) => updatePlan(planIdx, { active: e.target.checked })}
                                 className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                               />
                               <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900">Ativo no Site</span>
                             </label>
                          </div>
                       </div>
                       <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-700">Funcionalidades inclusas</label>
                            <button 
                              onClick={() => addFeature(planIdx)}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                            >
                               <Plus size={12} /> Adicionar
                            </button>
                          </div>
                          <div className="space-y-2 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                             {plan.features.map((feature, featIdx) => (
                               <div key={featIdx} className="flex items-center gap-2">
                                  <input 
                                    value={feature}
                                    onChange={(e) => updateFeature(planIdx, featIdx, e.target.value)}
                                    className="flex-1 bg-white border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:border-blue-300"
                                  />
                                  <button 
                                    onClick={() => removeFeature(planIdx, featIdx)}
                                    className="p-1 text-slate-400 hover:text-red-500"
                                  >
                                     <Trash2 size={14} />
                                  </button>
                               </div>
                             ))}
                          </div>
                       </div>
                    </div>
                  </Card>
                ))}
             </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
           {/* Proposal Factors Section */}
           <Card className="overflow-hidden">
             <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <Zap size={18} className="text-amber-500" />
                   <h4 className="text-sm font-bold text-slate-900">Influência da Proposta</h4>
                </div>
                <button onClick={addProposalFactor} className="p-1 text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                  <Plus size={18} />
                </button>
             </div>
             <div className="p-4 space-y-3">
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">Itens que mostram ao cliente o que analisamos para compor o valor final.</p>
                <div className="space-y-2">
                   {settings.proposalFactors.map((factor, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                         <input 
                           value={factor}
                           onChange={(e) => updateProposalFactor(idx, e.target.value)}
                           className="flex-1 bg-white border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:border-blue-300"
                         />
                         <button onClick={() => removeProposalFactor(idx)} className="text-slate-400 hover:text-red-500">
                           <Trash2 size={14} />
                         </button>
                      </div>
                   ))}
                </div>
             </div>
           </Card>

           {/* FAQ Section */}
           <Card className="overflow-hidden">
             <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <HelpCircle size={18} className="text-indigo-600" />
                   <h4 className="text-sm font-bold text-slate-900">Dúvidas Frequentes</h4>
                </div>
                <button onClick={addFAQ} className="p-1 text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                  <Plus size={18} />
                </button>
             </div>
             <div className="p-4 space-y-4">
                {settings.faq.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-lg space-y-2 relative group">
                     <button 
                       onClick={() => removeFAQ(idx)}
                       className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-slate-200 shadow-sm rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                     >
                        <Trash2 size={12} />
                     </button>
                     <input 
                        value={item.question}
                        onChange={(e) => updateFAQ(idx, 'question', e.target.value)}
                        placeholder="Pergunta"
                        className="w-full bg-transparent font-bold text-xs text-slate-900 outline-none border-b border-slate-200 pb-1 focus:border-blue-300"
                     />
                     <textarea 
                        value={item.answer}
                        onChange={(e) => updateFAQ(idx, 'answer', e.target.value)}
                        placeholder="Resposta"
                        rows={2}
                        className="w-full bg-transparent text-[11px] text-slate-600 outline-none resize-none focus:text-slate-900"
                     />
                  </div>
                ))}
             </div>
           </Card>

           {/* CTA Section */}
           <Card className="overflow-hidden bg-blue-600 text-white">
             <div className="p-4 border-b border-blue-500/50 flex items-center gap-2">
                <ArrowRight size={18} />
                <h4 className="text-sm font-bold">CTA Final</h4>
             </div>
             <div className="p-4 space-y-4">
                <div className="space-y-1.5">
                   <label className="text-[11px] font-bold text-blue-100">Título</label>
                   <input 
                      value={settings.cta.title}
                      onChange={(e) => updateCTA('title', e.target.value)}
                      className="w-full bg-blue-700/50 border border-blue-400/50 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-white"
                   />
                </div>
                <div className="space-y-1.5">
                   <label className="text-[11px] font-bold text-blue-100">Subtítulo</label>
                   <textarea 
                      value={settings.cta.subtitle}
                      onChange={(e) => updateCTA('subtitle', e.target.value)}
                      rows={2}
                      className="w-full bg-blue-700/50 border border-blue-400/50 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-white resize-none"
                   />
                </div>
                <div className="space-y-1.5">
                   <label className="text-[11px] font-bold text-blue-100">Texto do Botão</label>
                   <input 
                      value={settings.cta.buttonText}
                      onChange={(e) => updateCTA('buttonText', e.target.value)}
                      className="w-full bg-white text-blue-600 border-none rounded px-2 py-1.5 text-xs font-bold outline-none"
                   />
                </div>
             </div>
           </Card>
        </div>
      </div>
    </div>
  );
};
