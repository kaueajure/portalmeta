import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { ServiceFormField, TicketOption } from '../types';

const isActiveOption = (option: TicketOption) =>
  option.ativo === true ||
  option.ativo === 1 ||
  option.ativo === '1' ||
  option.ativo === 'true';

const normalizeTicketOptions = (items: TicketOption[]) =>
  (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    id: Number(item.id),
    nome: item.nome,
    sigla: typeof item.sigla === 'string' ? item.sigla.trim().toUpperCase() : item.sigla,
    valor: item.valor,
    ativo: isActiveOption(item),
    formulario_json: normalizeForm(item.formulario_json),
  }));

const normalizeForm = (value: TicketOption['formulario_json']): ServiceFormField[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
};

interface TicketOptionsResponse {
  categories: TicketOption[];
  services: TicketOption[];
}

export function useTicketOptions(endpoint = '/tickets/options') {
  const [categories, setCategories] = useState<TicketOption[]>([]);
  const [services, setServices] = useState<TicketOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchOptions() {
      try {
        setLoading(true);
        setError(null);

        const response = await api.get<TicketOptionsResponse>(endpoint);
        if (!isMounted) return;
        setCategories(normalizeTicketOptions(response.categories));
        setServices(normalizeTicketOptions(response.services));
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Erro ao carregar opcoes do ticket');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchOptions();

    return () => { isMounted = false; };
  }, [endpoint]);

  const activeCategories = categories.filter(isActiveOption);
  const activeServices = services.filter(isActiveOption);

  return { 
    categories, 
    services, 
    activeCategories, 
    activeServices, 
    loading, 
    error
  };
}
