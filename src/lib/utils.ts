import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(
  date: string | Date | null | undefined,
): string {
  if (!date) return "N/A";

  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "Data inválida";

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffInSeconds < 60) return "agora mesmo";

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return diffInMinutes === 1 ? "há 1min" : `há ${diffInMinutes}min`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return diffInHours === 1 ? "há 1h" : `há ${diffInHours}h`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return diffInDays === 1 ? "há 1d" : `há ${diffInDays}d`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return diffInMonths === 1 ? "há 1 mês" : `há ${diffInMonths} meses`;
  }

  const diffInYears = Math.floor(diffInMonths / 12);
  return diffInYears === 1 ? "há 1 ano" : `há ${diffInYears} anos`;
}

export interface SlaInfo {
  status: "normal" | "vencendo" | "vencido" | "finalizado" | "sem_sla" | "pausado";
  label: string;
  color: string;
  remainingText?: string;
  compactText?: string;
  diffInMinutes?: number;
}

export function getSlaInfo(
  prazo_sla: string | null | undefined,
  ticketStatus: string,
  slaInfoFromTicket?: string
): SlaInfo {
  // If explicitly paused or status operational is paused
  if (ticketStatus === "aguardando_cliente" || slaInfoFromTicket === "pausado") {
    return {
      status: "pausado",
      label: "SLA Pausado",
      compactText: "Paus.",
      color: "text-orange-600 bg-orange-50 border-orange-100",
      remainingText: "Pausado (aguardando cliente)",
    };
  }

  if (ticketStatus === "resolvido" || ticketStatus === "fechado") {
    return {
      status: "finalizado",
      label: "Finalizado",
      compactText: "Final.",
      color: "text-slate-400 bg-slate-50 border-slate-200",
    };
  }

  if (!prazo_sla) {
    return {
      status: "sem_sla",
      label: "Sem SLA",
      compactText: "S/SLA",
      color: "text-slate-400 bg-slate-50 border-slate-200",
    };
  }

  const deadline = new Date(prazo_sla);
  if (isNaN(deadline.getTime())) {
    return {
      status: "sem_sla",
      label: "Sem SLA",
      compactText: "S/SLA",
      color: "text-slate-400 bg-slate-50 border-slate-200",
    };
  }

  const now = new Date();
  const diffInMs = deadline.getTime() - now.getTime();
  const diffInMinutes = Math.floor(diffInMs / 60000);

  if (diffInMinutes < 0) {
    const absDiff = Math.abs(diffInMinutes);
    const hours = Math.floor(absDiff / 60);
    const days = Math.floor(hours / 24);

    let text = "";
    let compact = "";
    if (days > 0) {
      text = `Vencido há ${days}d`;
      compact = `Venc. ${days}d`;
    } else if (hours > 0) {
      text = `Vencido há ${hours}h`;
      compact = `Venc. ${hours}h`;
    } else {
      text = `Vencido há ${absDiff}min`;
      compact = `Venc. ${absDiff}m`;
    }

    return {
      status: "vencido",
      label: "Vencido",
      compactText: compact,
      color: "text-red-600 bg-red-50 border-red-100",
      remainingText: text,
      diffInMinutes,
    };
  }

  if (diffInMinutes <= 60) {
    return {
      status: "vencendo",
      label: "Vencendo",
      compactText: `${diffInMinutes}min`,
      color: "text-amber-600 bg-amber-50 border-amber-100",
      remainingText: `Vence em ${diffInMinutes}min`,
      diffInMinutes,
    };
  }

  const hours = Math.floor(diffInMinutes / 60);
  if (hours < 24) {
    return {
      status: "normal",
      label: "No prazo",
      compactText: `${hours}h`,
      color: "text-emerald-600 bg-emerald-50 border-emerald-100",
      remainingText: `Vence em ${hours}h`,
      diffInMinutes,
    };
  }

  const days = Math.floor(hours / 24);
  return {
    status: "normal",
    label: "No prazo",
    compactText: `${days}d`,
    color: "text-emerald-600 bg-emerald-50 border-emerald-100",
    remainingText: `Vence em ${days}d`,
    diffInMinutes,
  };
}

export function getFirstResponseSlaInfo(ticket: any): SlaInfo {
  if (ticket.primeira_resposta_em) {
    const status = ticket.sla_primeira_resposta_status;
    return {
      status: status === "cumprido" ? "finalizado" : "vencido",
      label: status === "cumprido" ? "PR Cumprida" : "PR Violada",
      compactText: status === "cumprido" ? "PR OK" : "PR Venc",
      color:
        status === "cumprido"
          ? "text-emerald-700 bg-emerald-50 border-emerald-200/60"
          : "text-red-700 bg-red-50 border-red-200/60",
    };
  }

  if (!ticket.prazo_primeira_resposta) {
    return {
      status: "sem_sla",
      label: "S/ SLA PR",
      compactText: "S/ PR",
      color: "text-slate-500 bg-slate-50 border-slate-200/60",
    };
  }

  const deadline = new Date(ticket.prazo_primeira_resposta);
  if (isNaN(deadline.getTime())) {
    return {
      status: "sem_sla",
      label: "S/ SLA PR",
      compactText: "S/ PR",
      color: "text-slate-500 bg-slate-50 border-slate-200/60",
    };
  }

  const now = new Date();
  const diffInMs = deadline.getTime() - now.getTime();
  const diffInMinutes = Math.floor(diffInMs / 60000);

  if (diffInMinutes < 0) {
    return {
      status: "vencido",
      label: "PR Vencida",
      compactText: "PR Venc",
      color: "text-red-700 bg-red-50 border-red-200/60",
      diffInMinutes,
    };
  }

  return {
    status: "normal",
    label: "Aguardando PR",
    compactText: "Aguard PR",
    color: "text-blue-700 bg-blue-50 border-blue-200/60",
    diffInMinutes,
  };
}

export function statusToBadgeVariant(
  status: string,
):
  | "slate"
  | "blue"
  | "emerald"
  | "amber"
  | "red"
  | "indigo"
  | "orange"
  | "purple" {
  switch (status?.toLowerCase()) {
    case "aberto":
      return "blue";
    case "em_andamento":
      return "amber";
    case "resolvido":
      return "emerald";
    case "fechado":
      return "slate";
    case "aguardando_cliente":
      return "orange";
    case "aguardando_terceiros":
      return "purple";
    default:
      return "slate";
  }
}

export function priorityToBadgeVariant(
  priority: string,
):
  | "slate"
  | "blue"
  | "emerald"
  | "amber"
  | "red"
  | "indigo"
  | "orange"
  | "purple" {
  switch (priority?.toLowerCase()) {
    case "baixa":
      return "slate";
    case "media":
      return "blue";
    case "alta":
      return "orange";
    case "urgente":
      return "red";
    default:
      return "slate";
  }
}

export function compactDateFormatter(
  date: string | Date | null | undefined,
): string {
  if (!date) return "--/--";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "--/--";
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
