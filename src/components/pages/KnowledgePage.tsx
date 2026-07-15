import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { BookOpen, Plus, Search, Edit2, Trash2, ShieldCheck, Globe, AlertCircle, X, Check, Save, Tag, LayoutGrid, LayoutList } from 'lucide-react';
import { User } from '../../types';
import MDEditor from '@uiw/react-md-editor/nohighlight';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { PageShell } from '../layout/PageShell';

interface KnowledgeManagerProps {
  currentUser: User;
}

interface Article {
  id: number;
  titulo: string;
  conteudo: string;
  categoria: string | null;
  publico: boolean;
  ativo: boolean;
  created_at: string;
}

export const KnowledgePage = ({ currentUser }: KnowledgeManagerProps) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [companies, setCompanies] = useState<{id: number, nome: string}[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    titulo: '',
    categoria: '',
    conteudo: '',
    publico: false,
    ativo: true,
  });

  const loadCompanies = async () => {
    if (!currentUser.desenvolvedor) return;
    try {
      const data = await api.get<any[]>('/companies?status=ativo');
      setCompanies(data);
    } catch {}
  };

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const qs = currentUser.desenvolvedor && selectedCompanyId ? `?empresa_id=${selectedCompanyId}` : '';
      const data = await api.get<any[]>(`/knowledge${qs}`);
      setArticles(data.map(d => ({
        ...d,
        publico: Boolean(Number(d.publico)),
        ativo: Boolean(Number(d.ativo)),
      })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const qs = currentUser.desenvolvedor && selectedCompanyId ? `?empresa_id=${selectedCompanyId}` : '';
      const data = await api.get<string[]>(`/knowledge/categories${qs}`);
      setCategories(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, [currentUser.desenvolvedor]);

  useEffect(() => {
    fetchArticles();
    fetchCategories();
  }, [selectedCompanyId, currentUser.desenvolvedor]);

  const openNew = () => {
    setEditingArticle(null);
    setFormData({ titulo: '', categoria: '', conteudo: '', publico: false, ativo: true });
    setIsModalOpen(true);
    setError(null);
  };

  const openEdit = (a: Article) => {
    setEditingArticle(a);
    setFormData({
      titulo: a.titulo,
      categoria: a.categoria || '',
      conteudo: a.conteudo,
      publico: a.publico,
      ativo: a.ativo
    });
    setIsModalOpen(true);
    setError(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza? Essa ação não pode ser desfeita.')) return;
    try {
      await api.delete(`/knowledge/${id}`);
      setArticles(prev => prev.filter(a => a.id !== id));
      fetchCategories();
    } catch (err) {
      alert('Erro ao excluir artigo');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo || !formData.conteudo) {
      setError('Título e conteúdo são obrigatórios.');
      return;
    }
    if (!editingArticle && currentUser.desenvolvedor && !selectedCompanyId) {
       setError('Selecione uma empresa antes de criar o artigo.');
       return;
    }
    
    setError(null);
    try {
      if (editingArticle) {
        await api.patch(`/knowledge/${editingArticle.id}`, { ...formData, empresa_id: selectedCompanyId || undefined });
      } else {
        await api.post('/knowledge', { ...formData, empresa_id: selectedCompanyId || undefined });
      }
      setIsModalOpen(false);
      fetchArticles();
      fetchCategories();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar artigo.');
    }
  };

  const filtered = articles.filter(a => {
    const matchesSearch = a.titulo.toLowerCase().includes(search.toLowerCase()) || 
                         (a.categoria || '').toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory ? a.categoria === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  return (
    <>
    <PageShell
      title="Base de Conhecimento"
      subtitle="Documentação técnica para equipe e autoatendimento para clientes"
      actions={
        <Button onClick={openNew} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm">
          <Plus size={16} className="mr-2" /> Novo Artigo
        </Button>
      }
      flush
    >
      <div className="space-y-4 w-full max-w-none p-4 sm:p-5 pb-8 bg-slate-50">
        {/* Toolbar compacta de filtros */}
      <div className="bg-white p-2 sm:p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col lg:flex-row items-center gap-3">
        <div className="relative flex-1 w-full group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={14} />
          <input 
            type="text"
            placeholder="Buscar nos artigos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 h-8 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
          {currentUser.desenvolvedor && (
            <Select
              value={selectedCompanyId}
              onChange={setSelectedCompanyId}
              placeholder="Empresa: Central"
              options={[
                { value: '', label: 'Gestifique Central' },
                ...companies.map(c => ({ value: String(c.id), label: c.nome }))
              ]}
              buttonClassName="h-8 bg-slate-50 border-slate-200 rounded-md text-xs font-medium min-w-[120px] flex-1 sm:flex-none"
            />
          )}

          <Select
            value={selectedCategory}
            onChange={setSelectedCategory}
            placeholder="Categorias"
            options={[
              { value: '', label: 'Todas Categorias' },
              ...categories.map(c => ({ value: c, label: c }))
            ]}
            buttonClassName="h-8 bg-slate-50 border-slate-200 rounded-md text-xs font-medium min-w-[120px] flex-1 sm:flex-none"
          />

          <div className="bg-slate-100 p-0.5 rounded flex gap-0.5 shrink-0 ml-auto">
            <button 
              onClick={() => setViewMode('list')}
              className={cn("p-1.5 rounded-sm transition-all", viewMode === 'list' ? "bg-white shadow-sm text-blue-600" : "text-slate-400 hover:text-slate-600")}
              title="Formato Lista"
            >
              <LayoutList size={14} />
            </button>
            <button 
              onClick={() => setViewMode('grid')}
              className={cn("p-1.5 rounded-sm transition-all", viewMode === 'grid' ? "bg-white shadow-sm text-blue-600" : "text-slate-400 hover:text-slate-600")}
              title="Formato Grade"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Listagem */}
      <div>
        {loading && articles.length === 0 ? (
          <div className="bg-white p-12 rounded-lg border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
             <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
             <p className="text-xs font-medium text-slate-500">Carregando Acervo...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white p-12 rounded-lg border border-dashed border-slate-200 text-center">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-4" />
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Nenhum artigo encontrado</h3>
            <p className="text-xs text-slate-500 mb-6">Ajuste os filtros ou crie um novo artigo.</p>
            <Button onClick={openNew} size="sm" variant="outline" className="border-slate-200 font-medium rounded-md hover:bg-slate-50 transition-all">
               <Plus size={14} className="mr-1.5" /> Criar Artigo
            </Button>
          </div>
        ) : (
          <div className={cn(
            "grid gap-3",
            viewMode === 'grid' ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
          )}>
            {filtered.map(article => (
              <div key={article.id} className={cn(
                "group bg-white border border-slate-200 rounded-lg p-3 shadow-sm hover:border-slate-300 transition-all flex justify-between gap-3",
                viewMode === 'grid' ? "flex-col" : "flex-row items-center"
              )}>
                <div className={cn("min-w-0 flex-1", viewMode === 'grid' ? "" : "flex items-center gap-4")}>
                  <div className={cn("flex flex-col min-w-0", viewMode === 'grid' ? "mb-3" : "")}>
                     <h4 className="font-semibold text-slate-800 truncate text-[13px] group-hover:text-blue-600 transition-colors">
                       {article.titulo}
                     </h4>
                     {article.categoria && (
                       <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                          <Tag size={10} /> <span className="truncate">{article.categoria}</span>
                       </div>
                     )}
                  </div>
                  
                  <div className={cn("flex items-center gap-2", viewMode === 'grid' ? "" : "ml-auto")}>
                     {article.publico ? (
                       <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-medium rounded border border-emerald-100 whitespace-nowrap">
                          <Globe size={10} /> Público
                       </span>
                     ) : (
                       <span className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded border border-slate-200 whitespace-nowrap">
                          <ShieldCheck size={10} /> Interno
                       </span>
                     )}
                     {!article.ativo && (
                       <span className="px-1.5 py-0.5 bg-red-50 text-red-600 text-[10px] font-medium rounded border border-red-100 whitespace-nowrap">
                         Inativo
                       </span>
                     )}
                  </div>
                </div>

                <div className={cn("flex items-center gap-1 shrink-0", viewMode === 'grid' ? "justify-end pt-2 border-t border-slate-100" : "")}>
                   <button 
                     onClick={() => openEdit(article)}
                     className="w-7 h-7 rounded text-slate-400 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-colors"
                   >
                     <Edit2 size={14} />
                   </button>
                   <button 
                     onClick={() => handleDelete(article.id)}
                     className="w-7 h-7 rounded text-slate-400 hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-colors"
                   >
                     <Trash2 size={14} />
                   </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
      </PageShell>

      {/* Editor Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col relative z-10 overflow-hidden border border-slate-200"
            >
              <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-white gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <BookOpen size={16}/>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-800 text-sm truncate">
                      {editingArticle ? 'Editar Artigo' : 'Novo Artigo'}
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">Documentação da base de conhecimento</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 hover:bg-slate-50 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors shrink-0">
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 sm:p-5 overflow-y-auto flex-1 custom-scrollbar min-h-0">
                <form id="knowledge-form" onSubmit={handleSave} className="space-y-5">
                  {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-xs font-medium rounded-md flex items-center gap-2 border border-red-100">
                      <AlertCircle size={14} /> {error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-600">Título do Artigo <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        required
                        placeholder="Ex: Como configurar seu e-mail..."
                        className="w-full h-9 bg-white border border-slate-200 rounded-md px-3 text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all outline-none font-sans"
                        value={formData.titulo}
                        onChange={e => setFormData(f => ({ ...f, titulo: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5 relative">
                      <label className="text-[11px] font-semibold text-slate-600">Categoria</label>
                      <input 
                        type="text" 
                        placeholder="Selecione ou digite uma nova..."
                        className="w-full h-9 bg-white border border-slate-200 rounded-md px-3 text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all outline-none font-sans"
                        value={formData.categoria}
                        onChange={e => setFormData(f => ({ ...f, categoria: e.target.value }))}
                        list="category-suggestions"
                      />
                      <datalist id="category-suggestions">
                        {categories.map(c => <option key={c} value={c} />)}
                      </datalist>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-600">Conteúdo (Markdown) <span className="text-red-500">*</span></label>
                    <div className="bg-white rounded-md border border-slate-200 overflow-hidden" data-color-mode="light">
                      <MDEditor
                        value={formData.conteudo}
                        onChange={(val) => setFormData(f => ({ ...f, conteudo: val || '' }))}
                        height={320}
                        preview="edit"
                        className="border-none shadow-none font-sans"
                        textareaProps={{
                          placeholder: 'Utilize markdown para formatar seu texto...'
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input 
                          type="checkbox" 
                          className="peer appearance-none w-5 h-5 border border-slate-300 rounded checked:bg-blue-600 checked:border-blue-600 transition-all hover:border-blue-400 bg-white"
                          checked={formData.publico}
                          onChange={e => setFormData(f => ({ ...f, publico: e.target.checked }))}
                        />
                        <Check size={12} className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none" strokeWidth={3} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-700 leading-none">Artigo Público</span>
                        <span className="text-[10px] text-slate-500 mt-1">Visível para clientes no autoatendimento</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input 
                          type="checkbox" 
                          className="peer appearance-none w-5 h-5 border border-slate-300 rounded checked:bg-emerald-600 checked:border-emerald-600 transition-all hover:border-emerald-400 bg-white"
                          checked={formData.ativo}
                          onChange={e => setFormData(f => ({ ...f, ativo: e.target.checked }))}
                        />
                        <Check size={12} className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none" strokeWidth={3} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-700 leading-none">Página Ativa</span>
                        <span className="text-[10px] text-slate-500 mt-1">Disponível para leitura na base</span>
                      </div>
                    </label>
                  </div>
                </form>
              </div>

              <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:gap-3 bg-slate-50/50">
                <Button variant="ghost" size="sm" className="font-medium text-slate-500 w-full sm:w-auto font-sans" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                <Button type="submit" form="knowledge-form" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm w-full sm:w-auto font-sans">
                  <Save size={14} className="mr-1.5" /> {editingArticle ? 'Atualizar' : 'Publicar'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
