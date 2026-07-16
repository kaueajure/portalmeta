import React from 'react';
import { ServiceFormField } from '../../types';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';

interface ServiceFormFieldsProps {
  fields: ServiceFormField[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}

export function ServiceFormFields({ fields, values, onChange }: ServiceFormFieldsProps) {
  if (!fields.length) return null;
  const update = (key: string, value: string) => onChange({ ...values, [key]: value });

  return (
    <fieldset className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/35 p-3">
      <legend className="px-1 text-xs font-semibold text-blue-900">Informações do serviço</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(field => (
          <div key={field.chave} className={field.tipo === 'texto_longo' ? 'sm:col-span-2' : ''}>
            {field.tipo === 'selecao' ? (
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">{field.rotulo}{field.obrigatorio ? ' *' : ''}</label>
                <Select
                  value={values[field.chave] || ''}
                  onChange={value => update(field.chave, value)}
                  options={[{ value: '', label: 'Selecione...' }, ...(field.opcoes || []).map(value => ({ value, label: value }))]}
                />
              </div>
            ) : field.tipo === 'texto_longo' ? (
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">{field.rotulo}{field.obrigatorio ? ' *' : ''}</label>
                <textarea
                  value={values[field.chave] || ''}
                  onChange={event => update(field.chave, event.target.value)}
                  required={field.obrigatorio}
                  rows={3}
                  className="w-full resize-y rounded-md border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                />
              </div>
            ) : (
              <Input
                label={`${field.rotulo}${field.obrigatorio ? ' *' : ''}`}
                type={field.tipo === 'numero' ? 'number' : field.tipo === 'data' ? 'date' : 'text'}
                value={values[field.chave] || ''}
                onChange={event => update(field.chave, event.target.value)}
                required={field.obrigatorio}
              />
            )}
          </div>
        ))}
      </div>
    </fieldset>
  );
}
