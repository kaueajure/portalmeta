import { User } from '../types';

const API_BASE = '/api';

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
  errors?: string[];
}

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}, isFormData: boolean = false): Promise<T> {
    const headers: Record<string, string> = { ...options.headers } as any;
    if (!isFormData) {
       headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers,
    });

    if (response.status === 401) {
      if (endpoint.startsWith("/portal") && !endpoint.startsWith("/portal-auth")) {
        localStorage.removeItem("portal_token");
        window.dispatchEvent(new CustomEvent("portal:unauthorized"));
        throw new Error("Acesso ao portal expirado. Solicite um novo código.");
      }

      // Avoid triggering unauthorized event for endpoints that handle their own errors
      // or for the initial session check.
      const silentEndpoints = ['/profile', '/auth/login'];
      const isSilent = silentEndpoints.some(e => endpoint.includes(e));
      
      if (!isSilent) {
        window.dispatchEvent(new CustomEvent('api:unauthorized', { detail: { endpoint } }));
      }

      // Try to get message from body
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          const result = await response.json();
          throw new Error(result?.message || result?.error || 'Sessão expirada. Faça login novamente.');
        } catch (e: any) {
          if (e instanceof Error && (e.message.includes('Sessão expirada') || e.message.includes('E-mail') || e.message.includes('conta'))) {
            throw e;
          }
          // Fallback if parsing fails or if we didn't throw above
        }
      }
      
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      if (text.trim().startsWith('<')) {
        throw new Error(`A API retornou HTML em vez de JSON para ${endpoint}. Verifique se o backend está rodando e se a rota existe.`);
      }
      throw new Error('Resposta inválida da API (não é JSON).');
    }

    let result: ApiResponse<T>;
    try {
      result = await response.json();
    } catch (e) {
      throw new Error('Erro ao processar resposta JSON da API.');
    }

    if (!result.success) {
      throw new Error(result.message || 'Erro na requisição');
    }

    return result.data;
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T>(endpoint: string, body: any) {
    const isFormData = body instanceof FormData;
    return this.request<T>(endpoint, {
      method: 'POST',
      body: isFormData ? body : JSON.stringify(body),
    }, isFormData);
  }

  patch<T>(endpoint: string, body: any) {
    const isFormData = body instanceof FormData;
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: isFormData ? body : JSON.stringify(body),
    }, isFormData);
  }

  put<T>(endpoint: string, body: any) {
    const isFormData = body instanceof FormData;
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: isFormData ? body : JSON.stringify(body),
    }, isFormData);
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiService();
