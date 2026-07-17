import { Pool, PoolConnection } from 'mysql2/promise';
import pool from '../db/connection.js';

export type ObligationFrequency = 'monthly' | 'bimonthly' | 'quarterly' | 'quadrimonthly' | 'semiannual' | 'annual';

export type ObligationDefinition = {
  code: string;
  name: string;
  frequency: ObligationFrequency;
  color: string;
  competences: string[];
  system: boolean;
};

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export const FREQUENCY_COMPETENCES: Record<ObligationFrequency, string[]> = {
  monthly: MONTHS,
  bimonthly: ['1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre', '5º Bimestre', '6º Bimestre'],
  quarterly: ['1º Trimestre', '2º Trimestre', '3º Trimestre', '4º Trimestre'],
  quadrimonthly: ['1º Quadrimestre', '2º Quadrimestre', '3º Quadrimestre'],
  semiannual: ['1º Semestre', '2º Semestre'],
  annual: ['Anual'],
};

export const DEFAULT_OBLIGATION_DEFINITIONS: ObligationDefinition[] = [
  { code: 'MSC', name: 'Matriz de Saldos Contábeis', frequency: 'monthly', color: 'blue', competences: [...MONTHS, 'Encerramento'], system: true },
  { code: 'RREO', name: 'Relatório Resumido de Execução Orçamentária', frequency: 'bimonthly', color: 'cyan', competences: FREQUENCY_COMPETENCES.bimonthly, system: true },
  { code: 'RGF', name: 'Relatório de Gestão Fiscal', frequency: 'quadrimonthly', color: 'violet', competences: FREQUENCY_COMPETENCES.quadrimonthly, system: true },
  { code: 'DCA', name: 'Declaração de Contas Anuais', frequency: 'annual', color: 'amber', competences: FREQUENCY_COMPETENCES.annual, system: true },
  { code: 'SIOPE', name: 'Educação', frequency: 'bimonthly', color: 'rose', competences: FREQUENCY_COMPETENCES.bimonthly, system: true },
  { code: 'SIOPS', name: 'Saúde', frequency: 'bimonthly', color: 'emerald', competences: FREQUENCY_COMPETENCES.bimonthly, system: true },
];

type Queryable = Pick<Pool | PoolConnection, 'query'>;

function parseCompetences(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function getObligationDefinitions(queryable: Queryable = pool): Promise<ObligationDefinition[]> {
  try {
    const [rows]: any = await queryable.query(
      `SELECT code, name, frequency, color, competences_json, system
       FROM obligation_definitions WHERE active = 1 ORDER BY sort_order, id`,
    );
    if (!rows.length) return DEFAULT_OBLIGATION_DEFINITIONS.map((item) => ({ ...item, competences: [...item.competences] }));
    return rows.map((row: any) => ({
      code: String(row.code),
      name: String(row.name),
      frequency: String(row.frequency) as ObligationFrequency,
      color: String(row.color || 'blue'),
      competences: parseCompetences(row.competences_json),
      system: Boolean(row.system),
    }));
  } catch (error: any) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return DEFAULT_OBLIGATION_DEFINITIONS.map((item) => ({ ...item, competences: [...item.competences] }));
    }
    throw error;
  }
}

export function definitionsMap(definitions: ObligationDefinition[]): Record<string, string[]> {
  return Object.fromEntries(definitions.map((item) => [item.code, item.competences]));
}

