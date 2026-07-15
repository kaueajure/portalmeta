import { TicketKanbanResponse, TicketStatus, TicketStatusSpecial } from "../types";

export interface TicketWorkflowStatus {
  id: TicketStatus;
  label: string;
  visible: boolean;
  active: boolean;
  color: string;
  special: TicketStatusSpecial;
}

export const DEFAULT_TICKET_WORKFLOW: TicketWorkflowStatus[] = [
  { id: "aberto", label: "Aberto", visible: true, active: true, color: "#2563eb", special: "inicial" },
  { id: "em_andamento", label: "Em Atendimento", visible: true, active: true, color: "#4f46e5", special: "normal" },
  { id: "resolvido", label: "Finalizado", visible: true, active: true, color: "#059669", special: "finalizado" },
];

export const TICKET_STATUS_SPECIAL_OPTIONS: { value: TicketStatusSpecial; label: string; description: string }[] = [
  { value: "normal", label: "Normal", description: "Etapa de atendimento sem automação especial de entrada, pausa ou fechamento." },
  { value: "inicial", label: "Inicial", description: "Ponto de entrada dos tickets novos e dos chamados reabertos." },
  { value: "aguardando_cliente", label: "Aguardando cliente", description: "Indica que a próxima resposta depende do cliente e pausa o SLA operacional." },
  { value: "finalizado", label: "Finalizado", description: "Registra a resolução do chamado e mantém possibilidade de reabertura." },
  { value: "encerrado", label: "Encerrado", description: "Fechamento administrativo do ticket, protegido por permissão específica." },
];

const STORAGE_KEY_PREFIX = "gestifique.ticketWorkflow";

const getWorkflowKey = (companyId?: number | string | null) =>
  `${STORAGE_KEY_PREFIX}.${companyId || "default"}`;

export const loadTicketWorkflow = (
  companyId?: number | string | null,
): TicketWorkflowStatus[] => {
  if (typeof window === "undefined") return DEFAULT_TICKET_WORKFLOW;

  try {
    const stored = window.localStorage.getItem(getWorkflowKey(companyId));
    if (!stored) return DEFAULT_TICKET_WORKFLOW;

    const parsed = JSON.parse(stored) as TicketWorkflowStatus[];
    if (!Array.isArray(parsed)) return DEFAULT_TICKET_WORKFLOW;

    const sanitized = parsed.filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        /^[a-z0-9_]{2,80}$/.test(item.id) &&
        typeof item.label === "string" &&
        item.label.trim().length > 0,
    ).map((item) => normalizeWorkflowStatus(item));
    const missing = DEFAULT_TICKET_WORKFLOW.filter(
      (item) => !sanitized.some((storedItem) => storedItem.id === item.id),
    );

    return [...sanitized, ...missing];
  } catch {
    return DEFAULT_TICKET_WORKFLOW;
  }
};

export const saveTicketWorkflow = (
  companyId: number | string | null | undefined,
  workflow: TicketWorkflowStatus[],
) => {
  window.localStorage.setItem(getWorkflowKey(companyId), JSON.stringify(workflow));
};

export const slugifyTicketStatus = (label: string) =>
  label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

export const labelFromTicketStatus = (status: string) =>
  status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const normalizeWorkflowStatus = (item: Partial<TicketWorkflowStatus> & { id: TicketStatus; label: string }): TicketWorkflowStatus => ({
  id: item.id,
  label: item.label,
  visible: item.visible !== false,
  active: item.active !== false,
  color: /^#[0-9a-fA-F]{6}$/.test(item.color || "") ? item.color as string : "#0891b2",
  special: TICKET_STATUS_SPECIAL_OPTIONS.some(option => option.value === item.special)
    ? item.special as TicketStatusSpecial
    : "normal",
});

export const applyTicketWorkflowToKanban = (
  kanbanData: TicketKanbanResponse,
  workflow: TicketWorkflowStatus[],
): TicketKanbanResponse => {
  const sourceColumns = kanbanData.columns || [];

  const columns = workflow
    .filter((item) => item.active && item.visible)
    .map((item) => {
      const sourceColumn = sourceColumns.find((column) => column.id === item.id);
      return {
        id: item.id,
        title: item.label,
        count: sourceColumn?.count || 0,
        tickets: sourceColumn?.tickets || [],
      };
    });

  return { ...kanbanData, columns };
};
