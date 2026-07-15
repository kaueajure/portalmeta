import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { TicketOption } from '../types';

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
  }));

interface TicketOptionsResponse {
  empresa_id: number | null;
  categories: TicketOption[];
  services: TicketOption[];
}

interface UseTicketOptionsConfig {
  scope?: 'company' | 'current-user';
}

export function useTicketOptions(companyId?: string | number, config: UseTicketOptionsConfig = {}) {
  const [categories, setCategories] = useState<TicketOption[]>([]);
  const [services, setServices] = useState<TicketOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId && config.scope !== 'current-user') {
      setLoading(false);
      setCategories([]);
      setServices([]);
      return;
    }

    let isMounted = true;

    async function fetchOptions() {
      try {
        setLoading(true);
        setError(null);

        if (config.scope === 'current-user') {
          const params = companyId ? `?empresa_id=${encodeURIComponent(String(companyId))}` : '';
          const response = await api.get<TicketOptionsResponse>(`/tickets/options${params}`);
          if (!isMounted) return;
          setCategories(normalizeTicketOptions(response.categories));
          setServices(normalizeTicketOptions(response.services));
        } else {
          const [catRes, servRes] = await Promise.all([
            api.get(`/companies/${companyId}/ticket-categories`),
            api.get(`/companies/${companyId}/ticket-services`)
          ]);
          if (!isMounted) return;
          setCategories(normalizeTicketOptions(catRes as unknown as TicketOption[]));
          setServices(normalizeTicketOptions(servRes as unknown as TicketOption[]));
        }
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
  }, [companyId, config.scope]);

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
