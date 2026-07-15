import React, { useState } from 'react';
import { 
  Bookmark, 
  Plus, 
  Trash2,
  X
} from 'lucide-react';
import { Button } from '../ui/Button';
import { TicketView } from '../../types';

import { Select } from '../ui/Select';

interface Props {
  views: TicketView[];
  currentViewId: number | null;
  onSelectView: (view: TicketView | null) => void;
  onSaveCurrent: (name: string) => void;
  onDeleteView: (id: number) => void;
}

export const TicketSavedViews: React.FC<Props> = ({ 
  views, 
  currentViewId, 
  onSelectView, 
  onSaveCurrent,
  onDeleteView
}) => {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  const handleSave = () => {
    if (newViewName.trim()) {
      onSaveCurrent(newViewName.trim());
      setNewViewName('');
      setShowSaveModal(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={currentViewId ?? 'none'}
        onChange={(value) => {
          if (value === 'none') {
            onSelectView(null);
          } else {
            const view = views.find(v => v.id === parseInt(value));
            if (view) onSelectView(view);
          }
        }}
        className="min-w-[180px]"
        buttonClassName="h-8 shadow-sm font-medium text-sm"
        options={[
          { value: 'none', label: 'Filtros Personalizados' },
          ...views.map(view => ({
            value: String(view.id),
            label: view.nome
          }))
        ]}
      />

      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowSaveModal(true)}
        className="text-slate-600 hover:text-blue-600 hover:bg-blue-50 gap-2 border-slate-200 h-8 bg-white shadow-sm"
        title="Salvar filtros atuais como view"
      >
        <Plus size={16} />
        Salvar View
      </Button>

      {currentViewId && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDeleteView(currentViewId)}
          className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 border-slate-200 h-8 w-8 p-0 bg-white shadow-sm flex items-center justify-center"
          title="Excluir view selecionada"
        >
          <Trash2 size={16} />
        </Button>
      )}

      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-lg w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Bookmark className="text-blue-500" size={16} />
                  Salvar View
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Os filtros atuais serão salvos.</p>
              </div>
              <button
                onClick={() => setShowSaveModal(false)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="p-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Nome da View</label>
                <input
                  type="text"
                  autoFocus
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  placeholder="Ex: Meus Urgentes"
                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors placeholder:text-slate-400"
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowSaveModal(false)}>
                Cancelar
              </Button>
              <Button 
                size="sm"
                onClick={handleSave} 
                disabled={!newViewName.trim()}
              >
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
