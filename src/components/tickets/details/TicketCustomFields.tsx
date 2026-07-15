import React, { useState } from 'react';
import { TicketCustomField } from '../../../types';
import { LayoutGrid, Plus, Trash2, Edit2, Check, X, Info } from 'lucide-react';
import { Button } from '../../ui/Button';

interface TicketCustomFieldsProps {
  fields: TicketCustomField[];
  onUpdate: (fields: TicketCustomField[]) => void;
  readOnly?: boolean;
}

export const TicketCustomFields = ({ fields, onUpdate, readOnly }: TicketCustomFieldsProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [tempField, setTempField] = useState({ label: '', value: '' });

  const handleAddField = () => {
    if (!tempField.label.trim()) return;
    
    const key = tempField.label.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!key) return;

    if (fields.some(f => f.field_key === key)) {
      alert('Já existe um campo com esse nome.');
      return;
    }

    const newFields = [
      ...fields,
      { field_key: key, field_label: tempField.label, field_value: tempField.value }
    ];
    onUpdate(newFields);
    setTempField({ label: '', value: '' });
    setIsAdding(false);
  };

  const handleUpdateValue = (key: string, value: string) => {
    const newFields = fields.map(f => 
      f.field_key === key ? { ...f, field_value: value } : f
    );
    onUpdate(newFields);
    setEditingKey(null);
  };

  const handleRemoveField = (key: string) => {
    if (confirm('Tem certeza que deseja remover este campo personalizado?')) {
      const newFields = fields.filter(f => f.field_key !== key);
      onUpdate(newFields);
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
           <LayoutGrid size={14} className="text-slate-400" />
           <h4 className="text-xs font-semibold text-slate-700">Campos Personalizados</h4>
        </div>
        {!readOnly && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsAdding(true)}
            className="h-6 px-2 text-xs font-medium"
          >
            <Plus size={12} className="mr-1" />
            Adicionar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-1">
        {fields.map((field) => (
          <div 
            key={field.field_key} 
            className="group flex flex-col p-3 rounded-xl border border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-500 truncate max-w-[150px]" title={field.field_key}>
                {field.field_label}
              </span>
              {!readOnly && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                     onClick={() => {
                       setEditingKey(field.field_key);
                       setTempField({ label: field.field_label, value: field.field_value || '' });
                     }}
                     className="p-1 text-slate-400 hover:text-blue-500 transition-colors"
                     title="Editar"
                     aria-label="Editar"
                   >
                     <Edit2 size={12} />
                   </button>
                   <button 
                     onClick={() => handleRemoveField(field.field_key)}
                     className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                     title="Remover"
                     aria-label="Remover"
                   >
                     <Trash2 size={12} />
                   </button>
                </div>
              )}
            </div>

            {editingKey === field.field_key ? (
              <div className="flex gap-1 mt-1">
                <input
                  autoFocus
                  type="text"
                  value={tempField.value}
                  onChange={(e) => setTempField({ ...tempField, value: e.target.value })}
                  className="flex-1 text-sm px-2 py-1.5 border border-blue-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Valor..."
                />
                <button 
                  onClick={() => handleUpdateValue(field.field_key, tempField.value)}
                  className="p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  aria-label="Salvar"
                >
                  <Check size={14} />
                </button>
                <button 
                  onClick={() => setEditingKey(null)}
                  className="p-1.5 bg-slate-100 text-slate-500 rounded-md hover:bg-slate-200 transition-colors"
                  aria-label="Cancelar"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="text-sm font-semibold text-slate-900 break-words">
                {field.field_value || <span className="opacity-50 italic text-sm font-normal">Vazio</span>}
              </div>
            )}
          </div>
        ))}

        {isAdding && (
          <div className="p-3 rounded-xl border border-blue-200 bg-blue-50 animate-in zoom-in-95 duration-200">
             <div className="space-y-3">
                <div>
                   <label className="text-xs font-semibold text-blue-700 mb-1 block">Nome do Campo</label>
                   <input
                     autoFocus
                     type="text"
                     value={tempField.label}
                     onChange={(e) => setTempField({ ...tempField, label: e.target.value })}
                     className="w-full text-sm px-2 py-1.5 border border-blue-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                     placeholder="Ex: Número do Contrato"
                   />
                </div>
                <div>
                   <label className="text-xs font-semibold text-blue-700 mb-1 block">Valor Inicial (Opcional)</label>
                   <input
                     type="text"
                     value={tempField.value}
                     onChange={(e) => setTempField({ ...tempField, value: e.target.value })}
                     className="w-full text-sm px-2 py-1.5 border border-blue-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                     placeholder="Ex: 123.456"
                   />
                </div>
                <div className="flex gap-2 pt-1">
                   <Button size="sm" className="flex-1 text-xs h-8" onClick={handleAddField}>Salvar</Button>
                   <Button variant="outline" size="sm" className="flex-1 text-xs h-8" onClick={() => setIsAdding(false)}>Cancelar</Button>
                </div>
             </div>
          </div>
        )}

        {!isAdding && fields.length === 0 && (
          <div className="py-6 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
             <Info size={16} className="text-slate-400 mb-2" />
             <p className="text-xs font-medium text-slate-500 text-center px-4">Nenhum campo personalizado</p>
          </div>
        )}
      </div>
    </div>
  );
};
