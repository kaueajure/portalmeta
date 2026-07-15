import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import { 
  Shield, 
  X, 
  Loader2, 
  Check, 
  Ban, 
  RotateCcw,
  AlertTriangle,
  HelpCircle,
  Eye,
  Settings,
  Search,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Filter,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';

interface PermissionCatalogItem {
  key: string;
  modulo: string;
  grupo: string;
  nome: string;
  descricao: string | null;
  nivel_risk: 'baixo' | 'medio' | 'alto' | 'critico';
  ativo: boolean;
  ordem: number;
}

interface UserPermissionMatrix {
  user: {
    id: number;
    nome: string;
    email: string;
    perfil: string;
    administrador: boolean;
    desenvolvedor: boolean;
  };
  rolePermissions: string[];
  overrides: Array<{ permission_key: string; effect: 'allow' | 'deny'; motivo?: string }>;
  effectivePermissions: string[];
  catalog: PermissionCatalogItem[];
}

interface PermissionUserModalProps {
  userId: number;
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
}

export const PermissionUserModal = ({ userId, isOpen, onClose, currentUser }: PermissionUserModalProps) => {
  const [loading, setLoading] = useState(true);
  const [matrix, setMatrix] = useState<UserPermissionMatrix | null>(null);
  const [reason, setReason] = useState<string>('');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<string>('all');

  const fetchMatrix = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setActionError(null);
    try {
      const resp = await api.get<any>(`/permissions/users/${userId}`);
      if (resp && resp.user) {
        setMatrix(resp);
      } else {
        setActionError('Erro ao carregar os dados de permissão.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Falha ao buscar matriz de permissões.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && userId) {
      fetchMatrix(true);
      setReason('');
      setSearchQuery('');
      setRiskFilter('all');
      setActionSuccess(null);
    }
  }, [isOpen, userId]);

  // Group and Filter Catalog Items
  const filteredCatalog = useMemo(() => {
    if (!matrix) return [];
    return matrix.catalog.filter(item => {
      // 1. Module filter label
      if (activeTab !== 'all' && item.modulo !== activeTab) return false;

      // 2. Risk level filter
      if (riskFilter !== 'all' && item.nivel_risk !== riskFilter) return false;

      // 3. Search text query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchesName = item.nome.toLowerCase().includes(query);
        const matchesKey = item.key.toLowerCase().includes(query);
        const matchesDesc = item.descricao ? item.descricao.toLowerCase().includes(query) : false;
        const matchesGroup = item.grupo.toLowerCase().includes(query);
        const matchesModule = item.modulo.toLowerCase().includes(query);
        return matchesName || matchesKey || matchesDesc || matchesGroup || matchesModule;
      }

      return true;
    });
  }, [matrix, activeTab, searchQuery, riskFilter]);

  // Group filtered items by modulo and group
  const groupedAndFiltered = useMemo(() => {
    const grouped: Record<string, Record<string, PermissionCatalogItem[]>> = {};

    filteredCatalog.forEach(item => {
      if (!grouped[item.modulo]) {
        grouped[item.modulo] = {};
      }
      if (!grouped[item.modulo][item.grupo]) {
        grouped[item.modulo][item.grupo] = [];
      }
      grouped[item.modulo][item.grupo].push(item);
    });

    return grouped;
  }, [filteredCatalog]);

  const stats = useMemo(() => {
    if (!matrix) return { total: 0, allowed: 0, denied: 0, activeOverrides: 0, inheritedAllowed: 0 };
    const total = matrix.catalog.length;
    const activeOverrides = matrix.overrides.length;
    
    let allowed = 0;
    let denied = 0;
    let inheritedAllowed = 0;

    matrix.catalog.forEach(item => {
      const isProfileAllowed = matrix.rolePermissions.includes(item.key);
      const override = matrix.overrides.find(o => o.permission_key === item.key);
      const isEffectiveAllowed = matrix.effectivePermissions.includes(item.key) || matrix.effectivePermissions.includes('*');

      if (isEffectiveAllowed) allowed++;
      else denied++;

      if (isProfileAllowed && !override) inheritedAllowed++;
    });

    return { total, allowed, denied, activeOverrides, inheritedAllowed };
  }, [matrix]);

  if (!isOpen) return null;

  const handleOverride = async (key: string, effect: 'allow' | 'deny') => {
    setActionError(null);
    setActionSuccess(null);
    setSavingKey(key);
    try {
      await api.put(`/permissions/users/${userId}/override`, {
        permission_key: key,
        effect,
        motivo: reason
      });
      // Keep selected reason if needed or clear standard reason on edit success
      await fetchMatrix(false);
      setActionSuccess(`Permissão "${key}" atualizada.`);
    } catch (err: any) {
      setActionError(err.message || 'Falha ao salvar permissão personalizada.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleResetOverride = async (key: string) => {
    setActionError(null);
    setActionSuccess(null);
    setSavingKey(key);
    try {
      await api.delete(`/permissions/users/${userId}/override/${key}`);
      await fetchMatrix(false);
      setActionSuccess('Restaurada ao comportamento padrão.');
    } catch (err: any) {
      setActionError(err.message || 'Falha ao redefinir override.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleResetAll = async () => {
    if (!window.confirm('Tem certeza de que deseja resetar todas as permissões do usuário para o padrão do perfil?')) return;
    
    setActionError(null);
    setActionSuccess(null);
    setLoading(true);
    try {
      await api.post(`/permissions/users/${userId}/reset`, {});
      setReason('');
      await fetchMatrix(true);
      setActionSuccess('Todas as permissões foram resetadas ao padrão do perfil.');
    } catch (err: any) {
      setActionError(err.message || 'Falha ao resetar permissões do usuário.');
    } finally {
      setLoading(false);
    }
  };

  // Module Level Bulk Actions
  const handleBulkAllowModule = async (moduleName: string, keys: string[]) => {
    setActionError(null);
    setActionSuccess(null);
    setBulkActionLoading(moduleName + '-allow');
    try {
      await api.post(`/permissions/users/${userId}/bulk`, {
        permission_keys: keys,
        effect: 'allow',
        motivo: reason || `Permissão ampla do módulo ${moduleName}`
      });
      await fetchMatrix(false);
      setActionSuccess(`Ativado todas as ${keys.length} permissões do módulo "${moduleName}".`);
    } catch (err: any) {
      setActionError(err.message || 'Falha ao aplicar alterações em lote.');
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleBulkDenyModule = async (moduleName: string, keys: string[]) => {
    setActionError(null);
    setActionSuccess(null);
    setBulkActionLoading(moduleName + '-deny');
    try {
      await api.post(`/permissions/users/${userId}/bulk`, {
        permission_keys: keys,
        effect: 'deny',
        motivo: reason || `Bloqueio amplo do módulo ${moduleName}`
      });
      await fetchMatrix(false);
      setActionSuccess(`Bloqueado todas as ${keys.length} permissões do módulo "${moduleName}".`);
    } catch (err: any) {
      setActionError(err.message || 'Falha ao aplicar bloqueio em lote.');
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleBulkResetModule = async (moduleName: string, keys: string[]) => {
    setActionError(null);
    setActionSuccess(null);
    setBulkActionLoading(moduleName + '-reset');
    try {
      await api.post(`/permissions/users/${userId}/bulk-reset`, {
        permission_keys: keys
      });
      await fetchMatrix(false);
      setActionSuccess(`Restauradas padrões das ${keys.length} permissões do módulo "${moduleName}".`);
    } catch (err: any) {
      setActionError(err.message || 'Falha ao restaurar padrões em lote.');
    } finally {
      setBulkActionLoading(null);
    }
  };

  const renderRiskBadge = (risk: string) => {
    switch (risk) {
      case 'critico':
        return <Badge variant="red" className="text-[10px] font-semibold border-none rounded uppercase tracking-wider px-1.5 py-0.5">Crítico</Badge>;
      case 'alto':
        return <Badge variant="orange" className="text-[10px] font-semibold border-none rounded uppercase tracking-wider px-1.5 py-0.5">Alto</Badge>;
      case 'medio':
        return <Badge variant="blue" className="text-[10px] font-semibold border-none rounded uppercase tracking-wider px-1.5 py-0.5">Médio</Badge>;
      default:
        return <Badge variant="slate" className="text-[10px] text-slate-500 font-semibold border-none rounded uppercase tracking-wider px-1.5 py-0.5">Baixo</Badge>;
    }
  };

  // Raw module lists from catalog for sidebar
  const modulos = useMemo(() => {
    if (!matrix) return [];
    return Array.from(new Set(matrix.catalog.map(item => item.modulo))).sort();
  }, [matrix]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop with sophisticated blur */}
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity" onClick={onClose} />

      {/* Container - Fully modern card layout */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-250 border border-slate-100">
        
        {/* Header with elegant details */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <Shield size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  Matriz de Permissões Efetivas
                </h3>
                <span className="text-[10px] font-medium bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
                  Gestifique RBAC v3
                </span>
              </div>
              <p className="text-[12px] text-slate-500 mt-0.5">
                Investigue acessos resolvidos e sobreponha privilégios de forma cirúrgica com auditoria nativa.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:ring-2 focus:ring-indigo-150 outline-none"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        {loading && !matrix ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 msg-status">
            <div className="relative flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
              <Shield size={18} className="absolute text-indigo-600" />
            </div>
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Acessando registro de governança...</span>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Top Stats and Identity Banner */}
            {matrix && (
              <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* User Profile Summary */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 ring-2 ring-white shadow-sm uppercase">
                      {matrix.user.nome.substring(0, 2)}
                    </div>
                    <div>
                      <div className="text-[14px] font-bold text-slate-900 flex items-center gap-2">
                        {matrix.user.nome}
                        <span className={cn(
                          "text-[10px] font-bold uppercase px-2 py-0.5 rounded-md tracking-wider border",
                          matrix.user.desenvolvedor 
                            ? "bg-red-50 text-red-700 border-red-150"
                            : matrix.user.administrador
                            ? "bg-amber-50 text-amber-700 border-amber-150"
                            : "bg-indigo-50 text-indigo-700 border-indigo-150"
                        )}>
                          {matrix.user.desenvolvedor ? 'Desenvolvedor (Super)' : matrix.user.administrador ? 'Administrador (Super)' : matrix.user.perfil}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono">{matrix.user.email}</span>
                        <span className="text-slate-300">•</span>
                        <span>ID: #{matrix.user.id}</span>
                      </div>
                    </div>
                  </div>

                  {/* Micro dashboard of perm categories count */}
                  <div className="flex items-center gap-3 flex-wrap">
                    
                    <div className="bg-white border border-slate-100 rounded-xl px-3 py-1.5 flex flex-col min-w-[75px]">
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Permitido</span>
                      <span className="text-sm font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                        <CheckCircle2 size={13} /> {matrix.user.desenvolvedor || matrix.user.administrador ? 'Tudo' : stats.allowed}
                      </span>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-xl px-3 py-1.5 flex flex-col min-w-[75px]">
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Bloqueado</span>
                      <span className="text-sm font-bold text-slate-600 flex items-center gap-1 mt-0.5">
                        <XCircle size={13} /> {matrix.user.desenvolvedor || matrix.user.administrador ? 0 : stats.denied}
                      </span>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-xl px-3 py-1.5 flex flex-col min-w-[75px]">
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Personalizadas</span>
                      <span className="text-sm font-bold text-indigo-600 flex items-center gap-1 mt-0.5">
                        <Sparkles size={13} /> {stats.activeOverrides}
                      </span>
                    </div>

                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={handleResetAll}
                      className="text-xs h-9 bg-white text-rose-600 border-rose-100 hover:bg-rose-50 hover:border-rose-200 transition-all rounded-xl ml-2"
                      disabled={matrix.overrides.length === 0}
                    >
                      <RotateCcw size={12} className="mr-1.5" />
                      Limpar Overrides
                    </Button>
                  </div>

                </div>
              </div>
            )}

            {/* Error & Success Messages */}
            {actionError && (
              <div className="mx-6 mt-4 p-3.5 bg-red-50 border border-red-150 text-red-700 rounded-xl flex items-center gap-3 text-xs animate-in slide-in-from-top-2">
                <AlertTriangle size={15} className="flex-shrink-0 text-red-500 animate-bounce" />
                <span className="font-medium">{actionError}</span>
              </div>
            )}

            {actionSuccess && (
              <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-150 text-emerald-800 rounded-xl flex items-center gap-3 text-xs animate-in slide-in-from-top-2">
                <CheckCircle2 size={15} className="flex-shrink-0 text-emerald-600" />
                <span className="font-medium">{actionSuccess}</span>
              </div>
            )}

            {/* Core Workspace Layout - Split panel */}
            <div className="flex-1 flex overflow-hidden">
              
              {/* Sidebar Left: Filters and Modules navigation */}
              <div className="w-56 bg-slate-50/50 border-r border-slate-150/70 p-4 overflow-y-auto flex flex-col justify-between">
                
                <div className="space-y-5">
                  
                  {/* Quick search input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Filtro Rápido</label>
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
                      <input 
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Pesquisar..."
                        className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none transition-all placeholder-slate-400 font-medium"
                      />
                      {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Nivel de risco filter */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Classificação Riscos</label>
                    <div className="grid grid-cols-2 gap-1 bg-white border border-slate-200 rounded-xl p-1">
                      <button 
                        onClick={() => setRiskFilter('all')}
                        className={cn(
                          "px-2 py-1 text-[10px] font-semibold rounded text-center transition-all",
                          riskFilter === 'all' ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        Todos
                      </button>
                      <button 
                        onClick={() => setRiskFilter('critico')}
                        className={cn(
                          "px-2 py-1 text-[10px] font-semibold rounded text-center transition-all",
                          riskFilter === 'critico' ? "bg-red-600 text-white" : "text-slate-600 hover:bg-red-50 text-red-600"
                        )}
                      >
                        Crítico
                      </button>
                    </div>
                  </div>

                  {/* Modules Nav */}
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1.5 mb-2">Módulos</div>
                    
                    <button 
                      onClick={() => setActiveTab('all')}
                      className={cn(
                        "w-full text-left px-3 py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-between",
                        activeTab === 'all' 
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" 
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Settings size={12} />
                        Todos os Itens
                      </span>
                      {matrix && (
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.2 rounded-full",
                          activeTab === 'all' ? "bg-indigo-750 text-indigo-100" : "bg-slate-150 text-slate-600"
                        )}>
                          {matrix.catalog.length}
                        </span>
                      )}
                    </button>

                    {modulos.map(mod => {
                      const count = matrix?.catalog.filter(i => i.modulo === mod).length || 0;
                      return (
                        <button 
                          key={mod}
                          onClick={() => setActiveTab(mod)}
                          className={cn(
                            "w-full text-left px-3 py-2 text-xs font-semibold rounded-xl transition-all truncate flex items-center justify-between",
                            activeTab === mod 
                              ? "bg-indigo-50 border border-indigo-150 text-indigo-800" 
                              : "text-slate-600 border border-transparent hover:bg-slate-100 hover:text-slate-950"
                          )}
                        >
                          <span className="truncate flex items-center gap-2 capitalize">
                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full flex-shrink-0" />
                            {mod}
                          </span>
                          <span className={cn(
                            "text-[10px] font-bold font-mono px-1.5 py-0.2 rounded",
                            activeTab === mod ? "bg-indigo-150 text-indigo-700" : "text-slate-400"
                          )}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                </div>

                {/* Legend help info */}
                <div className="pt-4 mt-4 border-t border-slate-150 bg-slate-50/50 -mx-4 -mb-4 p-4 text-[10px] text-slate-400 font-medium space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 mb-1">
                    <HelpCircle size={12} className="text-slate-400" /> Regra do Escopo
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                    <span>Permissão Efetiva Permitida</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-slate-300 rounded-full" />
                    <span>Bloqueado por Padrão</span>
                  </div>
                </div>

              </div>

              {/* Items Panel with full options */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/20">
                
                {/* Reason override input banner */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50/30 border border-amber-150/70 rounded-2xl p-4 text-xs shadow-sm shadow-amber-50/50">
                  <div className="font-bold text-amber-950 flex items-center gap-2 mb-1.5">
                    <Clock size={14} className="text-amber-600 animate-spin-slow" />
                    Registro de Auditoria Obrigatório
                  </div>
                  <p className="text-amber-800 mb-2 leading-relaxed">
                    Toda alteração manual de privilégio (override) exige justificativa técnica registrada sob logs permanentes de conformidade.
                  </p>
                  <input 
                    type="text"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Ex: Habilitar acesso emergencial para cobrir férias do gestor de suporte"
                    className="w-full bg-white border border-amber-200 outline-none rounded-xl px-3.5 py-2 text-slate-700 text-xs placeholder-slate-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-200 transition-all shadow-inner"
                  />
                </div>

                {/* If no items fit filter */}
                {Object.keys(groupedAndFiltered).length === 0 ? (
                  <div className="py-12 text-center text-slate-500 space-y-2">
                    <Search size={28} className="mx-auto text-slate-300" />
                    <div className="text-xs font-bold uppercase tracking-wider">Nenhuma permissão encontrada</div>
                    <p className="text-[11px] max-w-xs mx-auto text-slate-400 text-center">
                      Modifique os termos da busca, mude o filtro de risco ou selecione outra aba de módulo.
                    </p>
                  </div>
                ) : (
                  Object.keys(groupedAndFiltered).map(modulo => {
                    // Extract all keys belonging to this module for bulk operations
                    const moduleKeys = matrix?.catalog.filter(i => i.modulo === modulo).map(i => i.key) || [];

                    return (
                      <div key={modulo} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                        
                        {/* Module header with title AND bulk operations */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Módulo</span>
                            <h4 className="text-sm font-extrabold text-indigo-900 uppercase tracking-wider">{modulo}</h4>
                          </div>

                          {/* Bulk overrides controls for module */}
                          {matrix && !matrix.user.desenvolvedor && !matrix.user.administrador && (
                            <div className="flex items-center gap-1.5 flex-wrap bg-slate-50 border border-slate-100/50 px-2 py-1.5 rounded-xl">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mr-1.5 pl-1">Lote:</span>
                              
                              <button 
                                onClick={() => handleBulkAllowModule(modulo, moduleKeys)}
                                disabled={bulkActionLoading !== null}
                                className="h-6.5 px-2 text-[10px] font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-1 disabled:opacity-50"
                              >
                                {bulkActionLoading === modulo + '-allow' ? (
                                  <Loader2 size={10} className="animate-spin" />
                                ) : (
                                  <CheckCircle2 size={10} />
                                )}
                                Permitir Todos
                              </button>

                              <button 
                                onClick={() => handleBulkDenyModule(modulo, moduleKeys)}
                                disabled={bulkActionLoading !== null}
                                className="h-6.5 px-2 text-[10px] font-bold rounded-lg bg-red-50 text-red-700 border border-red-100 hover:bg-red-600 hover:text-white transition-all flex items-center gap-1 disabled:opacity-50"
                              >
                                {bulkActionLoading === modulo + '-deny' ? (
                                  <Loader2 size={10} className="animate-spin" />
                                ) : (
                                  <XCircle size={10} />
                                )}
                                Negar Todos
                              </button>

                              <button 
                                onClick={() => handleBulkResetModule(modulo, moduleKeys)}
                                disabled={bulkActionLoading !== null}
                                className="h-6.5 px-2 text-[10px] font-bold rounded-lg bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-700 hover:text-white transition-all flex items-center gap-1 disabled:opacity-50"
                              >
                                {bulkActionLoading === modulo + '-reset' ? (
                                  <Loader2 size={10} className="animate-spin" />
                                ) : (
                                  <RotateCcw size={10} />
                                )}
                                Resetar
                              </button>
                            </div>
                          )}
                        </div>

                        {/* List Groups in module */}
                        {Object.keys(groupedAndFiltered[modulo]).map(grupo => {
                          const items = groupedAndFiltered[modulo][grupo];
                          const groupKeys = items.map(i => i.key);
                          const actionPrefix = `${modulo}-${grupo}`;

                          return (
                            <div key={grupo} className="space-y-2.5">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pl-1 mb-1.5 pb-1 border-b border-dashed border-slate-100">
                                <div className="flex items-center gap-2">
                                  <span className="w-1 h-3.5 bg-indigo-500 rounded" />
                                  <h5 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{grupo}</h5>
                                </div>
                                {matrix && !matrix.user.desenvolvedor && !matrix.user.administrador && (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mr-1 px-1">Grupo:</span>
                                    
                                    <button 
                                      onClick={() => handleBulkAllowModule(actionPrefix, groupKeys)}
                                      disabled={bulkActionLoading !== null}
                                      className="h-5.5 px-1.5 text-[9px] font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-0.5 disabled:opacity-50"
                                    >
                                      {bulkActionLoading === actionPrefix + '-allow' ? (
                                        <Loader2 size={8} className="animate-spin" />
                                      ) : (
                                        <CheckCircle2 size={9} />
                                      )}
                                      Aplicar todos
                                    </button>

                                    <button 
                                      onClick={() => handleBulkDenyModule(actionPrefix, groupKeys)}
                                      disabled={bulkActionLoading !== null}
                                      className="h-5.5 px-1.5 text-[9px] font-bold rounded-md bg-red-50 text-red-700 border border-red-100 hover:bg-red-600 hover:text-white transition-all flex items-center gap-0.5 disabled:opacity-50"
                                    >
                                      {bulkActionLoading === actionPrefix + '-deny' ? (
                                        <Loader2 size={8} className="animate-spin" />
                                      ) : (
                                        <XCircle size={9} />
                                      )}
                                      Remover todos
                                    </button>

                                    <button 
                                      onClick={() => handleBulkResetModule(actionPrefix, groupKeys)}
                                      disabled={bulkActionLoading !== null}
                                      className="h-5.5 px-1.5 text-[9px] font-bold rounded-md bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-700 hover:text-white transition-all flex items-center gap-0.5 disabled:opacity-50"
                                    >
                                      {bulkActionLoading === actionPrefix + '-reset' ? (
                                        <Loader2 size={8} className="animate-spin" />
                                      ) : (
                                        <RotateCcw size={9} />
                                      )}
                                      Restaurar padrão
                                    </button>
                                  </div>
                                )}
                              </div>
                              
                              <div className="grid gap-2.5">
                                {items.map(item => {
                                  const isProfileAllowed = matrix?.rolePermissions.includes(item.key);
                                  const override = matrix?.overrides.find(o => o.permission_key === item.key);
                                  const isCurrentlyAllowed = matrix?.effectivePermissions.includes(item.key) || matrix?.effectivePermissions.includes('*');
                                  const isSuper = !!(matrix?.user.desenvolvedor || matrix?.user.administrador);

                                  return (
                                    <div 
                                      key={item.key} 
                                      className={cn(
                                        "border rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:bg-slate-50/30",
                                        isCurrentlyAllowed 
                                          ? "border-emerald-100 bg-emerald-50/5" 
                                          : "border-slate-150 bg-slate-50/10"
                                      )}
                                    >
                                      {/* Icon Outcome indicator and texts */}
                                      <div className="flex gap-3 select-none">
                                        <div className={cn(
                                          "w-8.5 h-8.5 rounded-lg flex items-center justify-center border flex-shrink-0 mt-0.5",
                                          isCurrentlyAllowed 
                                            ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                                            : "bg-slate-100 border-slate-200 text-slate-400"
                                        )}>
                                          {isCurrentlyAllowed ? <Check size={16} /> : <Ban size={14} />}
                                        </div>

                                        <div className="space-y-1 min-w-0 flex-1">
                                          <div className="flex items-center gap-2.5 flex-wrap">
                                            <span className="text-[13px] font-bold text-slate-800 leading-none">{item.nome}</span>
                                            <span className="font-mono text-[9px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-150/50">{item.key}</span>
                                            {renderRiskBadge(item.nivel_risk)}
                                            
                                            {override && (
                                              <Badge variant={override.effect === 'allow' ? 'emerald' : 'red'} className="text-[9px] font-semibold uppercase rounded tracking-wider border-none">
                                                {override.effect === 'allow' ? 'Forçar Permitido' : 'Forçar Negado'}
                                              </Badge>
                                            )}
                                          </div>
                                          <p className="text-[11.5px] text-slate-500 leading-relaxed">
                                            {item.descricao || 'Sem descrição cadastrada para esta permissão.'}
                                          </p>
                                          
                                          {override?.motivo && (
                                            <div className="text-[10.5px] text-amber-800 font-semibold bg-amber-50 rounded-lg px-2.5 py-1 inline-block border border-amber-100 flex items-center gap-1.5">
                                              <Clock size={11} className="text-amber-600" /> Justificativa: "{override.motivo}"
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Override Controls actions */}
                                      <div className="flex items-center gap-1.5 flex-shrink-0 self-end md:self-center">
                                        {savingKey === item.key ? (
                                          <Loader2 className="w-5 h-5 text-indigo-500 animate-spin mr-2" />
                                        ) : isSuper ? (
                                          <div className="text-[11.5px]" title="Super-usuários possuem wildcard '*' irrestrito">
                                            <Badge className="bg-slate-100 border border-slate-200 text-slate-600 font-bold uppercase rounded-lg">Herdado (*)</Badge>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1 bg-white border border-slate-150/75 p-1 rounded-xl shadow-xs">
                                            <button
                                              title="Usar o Padrão do perfil do Usuário"
                                              onClick={() => handleResetOverride(item.key)}
                                              className={cn(
                                                "h-7 px-2.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1",
                                                !override 
                                                  ? "bg-slate-50 text-slate-400 cursor-not-allowed" 
                                                  : "bg-white hover:bg-slate-100 text-slate-600"
                                              )}
                                              disabled={!override}
                                            >
                                              <RotateCcw size={11} />
                                              Herdar ({isProfileAllowed ? 'Sim' : 'Não'})
                                            </button>

                                            <button
                                              title="Ativar esta permissão para este usuário"
                                              onClick={() => handleOverride(item.key, 'allow')}
                                              className={cn(
                                                "h-7 px-3 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1",
                                                override?.effect === 'allow'
                                                  ? "bg-emerald-600 text-white font-extrabold shadow-sm"
                                                  : "bg-white text-slate-600 hover:bg-emerald-500 hover:text-white"
                                              )}
                                            >
                                              <Check size={12} />
                                              Sim
                                            </button>

                                            <button
                                              title="Bloquear/Negar esta permissão para este usuário"
                                              onClick={() => handleOverride(item.key, 'deny')}
                                              className={cn(
                                                "h-7 px-3 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1",
                                                override?.effect === 'deny'
                                                  ? "bg-rose-600 text-white font-extrabold shadow-sm"
                                                  : "bg-white text-slate-600 hover:bg-rose-500 hover:text-white"
                                              )}
                                            >
                                              <Ban size={11} />
                                              Não
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
