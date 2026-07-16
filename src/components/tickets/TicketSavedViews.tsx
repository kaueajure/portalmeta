import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { TicketView } from '../../types';

import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';

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

      <Modal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        title="Salvar visualização"
        size="sm"
        footer={<><Button size="sm" variant="ghost" onClick={() => setShowSaveModal(false)}>Cancelar</Button><Button size="sm" onClick={handleSave} disabled={!newViewName.trim()}>Salvar</Button></>}
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Os filtros atuais ficarão disponíveis na sua lista de visualizações.</p>
          <Input label="Nome da visualização" autoFocus value={newViewName} onChange={(event) => setNewViewName(event.target.value)} placeholder="Ex.: Meus urgentes" onKeyDown={(event) => event.key === 'Enter' && handleSave()} />
        </div>
      </Modal>
    </div>
  );
};
