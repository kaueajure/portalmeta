import { TicketOption } from "../types";

export const getCategoryShortLabel = (category: TicketOption) =>
  category.sigla?.trim() || category.nome;

export const getCategoryFullLabel = (category: TicketOption) =>
  category.sigla?.trim()
    ? `${category.sigla.trim()} - ${category.nome}`
    : category.nome;
