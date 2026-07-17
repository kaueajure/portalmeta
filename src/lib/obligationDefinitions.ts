export type ObligationFrequency = 'monthly' | 'bimonthly' | 'quarterly' | 'quadrimonthly' | 'semiannual' | 'annual';

export interface ObligationDefinition {
  code: string;
  name: string;
  frequency: ObligationFrequency;
  color: string;
  competences: string[];
  system: boolean;
}

export const DEFAULT_OBLIGATION_DEFINITIONS: ObligationDefinition[] = [
  { code: 'MSC', name: 'Matriz de Saldos Contábeis', frequency: 'monthly', color: 'blue', competences: [], system: true },
  { code: 'RREO', name: 'Execução Orçamentária', frequency: 'bimonthly', color: 'cyan', competences: [], system: true },
  { code: 'RGF', name: 'Gestão Fiscal', frequency: 'quadrimonthly', color: 'violet', competences: [], system: true },
  { code: 'DCA', name: 'Contas Anuais', frequency: 'annual', color: 'amber', competences: [], system: true },
  { code: 'SIOPE', name: 'Educação', frequency: 'bimonthly', color: 'rose', competences: [], system: true },
  { code: 'SIOPS', name: 'Saúde', frequency: 'bimonthly', color: 'emerald', competences: [], system: true },
];

export const FREQUENCY_OPTIONS: Array<{ value: ObligationFrequency; label: string; hint: string }> = [
  { value: 'monthly', label: 'Mensal', hint: '12 competências por exercício' },
  { value: 'bimonthly', label: 'Bimestral', hint: '6 competências por exercício' },
  { value: 'quarterly', label: 'Trimestral', hint: '4 competências por exercício' },
  { value: 'quadrimonthly', label: 'Quadrimestral', hint: '3 competências por exercício' },
  { value: 'semiannual', label: 'Semestral', hint: '2 competências por exercício' },
  { value: 'annual', label: 'Anual', hint: '1 competência por exercício' },
];

export const OBLIGATION_COLOR_STYLES: Record<string, { dot: string; tone: string; chip: string }> = {
  blue: { dot: 'bg-blue-600', tone: 'text-blue-700', chip: 'border-blue-200 bg-blue-50 text-blue-700' },
  cyan: { dot: 'bg-cyan-600', tone: 'text-cyan-700', chip: 'border-cyan-200 bg-cyan-50 text-cyan-700' },
  violet: { dot: 'bg-violet-600', tone: 'text-violet-700', chip: 'border-violet-200 bg-violet-50 text-violet-700' },
  amber: { dot: 'bg-amber-600', tone: 'text-amber-700', chip: 'border-amber-200 bg-amber-50 text-amber-700' },
  rose: { dot: 'bg-rose-600', tone: 'text-rose-700', chip: 'border-rose-200 bg-rose-50 text-rose-700' },
  emerald: { dot: 'bg-emerald-600', tone: 'text-emerald-700', chip: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  orange: { dot: 'bg-orange-600', tone: 'text-orange-700', chip: 'border-orange-200 bg-orange-50 text-orange-700' },
  slate: { dot: 'bg-slate-600', tone: 'text-slate-700', chip: 'border-slate-200 bg-slate-50 text-slate-700' },
};

export function obligationColor(color: string) {
  return OBLIGATION_COLOR_STYLES[color] || OBLIGATION_COLOR_STYLES.blue;
}

