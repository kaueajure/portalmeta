export interface AccessProfile {
  id: number;
  empresa_id: number | null;
  nome: string;
  descricao?: string | null;
  base_perfil?: string | null;
  sistema: boolean;
  ativo: boolean;
  usuarios_count?: number;
  permissions_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface User {
  id: number;
  empresa_id: number | null;
  nome: string;
  email: string;
  cargo: string | null;
  perfil?: 'desenvolvedor' | 'administrador' | 'gestor' | 'atendente' | 'cliente' | string | null;
  access_profile_id?: number | null;
  access_profile_nome?: string | null;
  administrador: boolean;
  desenvolvedor: boolean;
  ativo: boolean;
  telefone: string | null;
  foto: string | null;
  ultimo_login: string | null;
  empresa_nome?: string;
  empresa_telefone?: string;
  empresa_email?: string;
  empresa_cnpj?: string;
  empresa_logo?: string | null;
  empresa_cor_principal?: string;
  empresa_endereco?: string;
  empresa_email_assinatura?: string | null;
  created_at: string;
  permissions?: string[];
  isSuperUser?: boolean;
}

export interface Empresa {
  id: number;
  nome: string;
  cnpj: string;
  email: string;
  email_suporte: string;
  telefone: string;
  logo: string | null;
  email_assinatura?: string | null;
  cor_principal: string;
  ativo: boolean;
  created_at: string;
  total_usuarios?: number;
  total_tickets?: number;
}

export interface UserFormData {
  nome: string;
  email: string;
  password?: string;
  cargo: string;
  telefone: string;
  empresa_id: number | null;
  administrador: boolean;
  desenvolvedor: boolean;
  perfil?: 'desenvolvedor' | 'administrador' | 'gestor' | 'atendente' | 'cliente' | string | null;
  access_profile_id?: number | null;
}

export interface CompanyFormData {
  nome: string;
  cnpj: string;
  email: string;
  email_suporte: string;
  telefone: string;
  cor_principal: string;
  logo?: string | null;
  email_assinatura?: string | null;
}

export type TicketStatus = string;
export type TicketStatusSpecial = 'normal' | 'inicial' | 'aguardando_cliente' | 'finalizado' | 'encerrado';
export type TicketPriority = 'baixa' | 'media' | 'alta' | 'urgente';
export type TicketQueue = 'todos' | 'meus' | 'sem_responsavel' | 'urgentes' | 'sla_vencido' | 'vence_em_breve' | 'aguardando_cliente' | 'precisa_resposta';

export interface TicketListResponse {
  data: Ticket[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: Record<string, number>;
  queues?: Record<TicketQueue, number>;
}

export interface TicketKanbanColumn {
  id: TicketStatus;
  title: string;
  count: number;
  tickets: Ticket[];
  loadedCount?: number;
  hasMore?: boolean;
}

export interface TicketKanbanResponse {
  columns: TicketKanbanColumn[];
  totals: Record<string, number>;
  queues?: Record<TicketQueue, number>;
  meta?: {
    perColumnLimit: number;
    truncated: boolean;
    totalLoaded: number;
    totalAvailable: number;
  };
}

export interface TicketOption {
  id: number;
  nome: string;
  sigla?: string | null;
  valor: string;
  ativo: boolean | number | string;
  kanban_visivel?: boolean | number | string;
  cor?: string | null;
  especial?: TicketStatusSpecial | string | null;
  ordem?: number;
}

export interface Ticket {
  id: number;
  empresa_id: number;
  usuario_id: number | null;
  solicitante_nome?: string | null;
  solicitante_email?: string | null;
  responsavel_id: number | null;
  titulo: string;
  descricao: string;
  status: TicketStatus;
  prioridade: TicketPriority;
  categoria: string;
  servico?: string;
  origem?: string;
  email_channel_id?: number | null;
  message_id?: string | null;
  prazo_sla?: string | null;
  prazo_primeira_resposta?: string | null;
  primeira_resposta_em?: string | null;
  sla_primeira_resposta_status?: 'cumprido' | 'violado' | 'aguardando' | null;
  sla_resolucao_status?: 'cumprido' | 'violado' | 'dentro_do_prazo' | null;
  precisa_revisao_responsavel?: boolean;
  estado_atendimento?: 'cliente_respondeu' | 'aguardando_cliente' | 'atendente_respondeu' | 'sem_resposta' | 'finalizado';
  nao_lido?: boolean;
  precisa_resposta?: boolean;
  ultima_mensagem_em?: string;
  ultima_mensagem_por_nome?: string;
  ultima_mensagem_interna?: boolean;
  cliente_nome?: string;
  cliente_email?: string;
  responsavel_nome?: string;
  empresa_nome?: string;
  finalizado_em: string | null;
  sla_pausado_em?: string | null;
  sla_pausado_total_minutos?: number;
  sla_status_operacional?: string | null;
  resolucao_motivo?: string | null;
  resolucao_observacao?: string | null;
  reaberto_em?: string | null;
  reaberto_por?: number | null;
  created_at: string;
  updated_at: string;
  tags?: string[];
  custom_fields?: TicketCustomField[];
  satisfacao?: {
    id?: number;
    token?: string;
    nota?: number;
    comentario?: string;
    respondido_em?: string;
    status: 'nao_enviada' | 'aguardando_resposta' | 'respondida';
  };
}

export interface TicketAdvancedFilters {
  responsavel_id?: number;
  tag?: string;
  origem?: string;
  email_channel_id?: number;
  created_from?: string;
  created_to?: string;
  updated_from?: string;
  updated_to?: string;
  sla_status?: 'todos' | 'dentro_sla' | 'vencendo' | 'vencido' | 'sem_sla';
  custom_field_search?: string;
}

export interface TicketView {
  id: number;
  empresa_id: number;
  usuario_id: number;
  nome: string;
  filtros_json: {
    status?: TicketStatus | 'todos';
    prioridade?: TicketPriority | 'todas';
    categoria?: string | 'todas';
    servico?: string | 'todos';
    fila?: TicketQueue;
    search?: string;
    advanced?: TicketAdvancedFilters;
    mode?: 'list' | 'kanban';
    sort_by?: 'operacional' | 'id' | 'updated_at' | 'prioridade' | 'status' | 'titulo';
    sort_order?: 'asc' | 'desc';
  };
  created_at: string;
  updated_at: string;
}

export interface TicketCustomField {
  id?: number;
  ticket_id?: number;
  field_key: string;
  field_label: string;
  field_value: string | null;
}

export interface TicketMacro {
  id: number;
  empresa_id: number;
  titulo: string;
  conteudo: string;
  categoria?: string;
  ativo?: boolean;
  created_at: string;
}

export interface Message {
  id: number;
  ticket_id: number;
  usuario_id: number | null;
  usuario_nome: string;
  mensagem: string;
  interno: boolean;
  anexo: string | null;
  message_id?: string | null;
  created_at: string;
  attachments?: TicketAttachment[];
}

export interface TicketAttachment {
  id: number;
  ticket_id: number;
  mensagem_id?: number | null;
  usuario_id: number;
  empresa_id?: number | null;
  nome_original: string;
  nome_arquivo?: string;
  mime_type: string;
  tamanho_bytes: number;
  tipo?: string;
  interno?: boolean;
  created_at: string;
  usuario_nome?: string;
  url?: string;
}

export interface TicketTimelineItem {
  type: 'creation' | 'response' | 'internal_note' | 'system' | 'completion' | 'reopen' | 'tag_change' | 'custom_field';
  date: string;
  author: string;
  description: string;
  id?: number;
  is_internal?: boolean;
  action?: string;
  icon?: string;
}

export interface Log {
  id: number;
  acao: string;
  descricao?: string;
  usuario_nome?: string;
  created_at: string;
}

export interface SystemLog {
  id: number;
  usuario_id?: number | null;
  empresa_id?: number | null;
  acao: string;
  descricao?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  created_at: string;
  usuario_nome?: string | null;
  empresa_nome?: string | null;
}

export interface DashboardData {
  chamadosAtivos: number;
  resolvidosMes: number;
  totalEmpresas?: number;
  totalUsuarios: number;
  slaAtrasados?: number;
  vencendoHoje?: number;
  tempoMedioPrimeiraRespostaHoras?: number | null;
  tempoMedioResolucaoHoras?: number | null;
  slaCumprido?: number;
  slaViolado?: number;
  recentTickets: Ticket[];
  byStatus: Array<{
    status: string;
    qtd: number;
  }>;
  byPriority?: Array<{
    prioridade: string;
    qtd: number;
  }>;
  byResponsavel?: Array<{
    responsavel: string;
    qtd: number;
  }>;
  backlogPorIdade?: Array<{
    faixa: string;
    qtd: number;
  }>;
  filters?: {
    period: string;
    from: string;
    to: string;
    empresa_id?: number | null;
    responsavel_id?: number | null;
  };
}

export interface Notification {
  id: number;
  usuario_id: number;
  empresa_id?: number | null;
  tipo: string;
  titulo: string;
  mensagem?: string | null;
  link?: string | null;
  lida: boolean;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  read_at?: string | null;
}

export interface PricingPlan {
  id: string;
  name: string;
  target: string;
  highlightText: string;
  priceLabel?: string;
  priceMonthly?: number | null;
  priceMode?: 'fixed' | 'consult';
  features: string[];
  highlight: boolean;
  active: boolean;
  order: number;
}

export interface PricingSettings {
  header: {
    title: string;
    subtitle: string;
  };
  billing?: {
    annualDiscountPercent: number;
    showBillingToggle: boolean;
    monthlyLabel: string;
    annualLabel: string;
    annualEconomyText: string;
  };
  plans: PricingPlan[];
  proposalFactors: string[];
  faq: {
    question: string;
    answer: string;
  }[];
  cta: {
    title: string;
    subtitle: string;
    buttonText: string;
  };
}
