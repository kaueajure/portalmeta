import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle, Building2, Check, ChevronDown, CircleCheckBig, Clock3, Download,
  FileDown, FileText, Filter, History, Loader2, MessageSquare, Paperclip,
  Plus, RefreshCw, Search, Send, SlidersHorizontal, Upload, X,
} from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { hasPermission } from '../../lib/permissions';
import { User } from '../../types';
import { Button } from '../ui/Button';
import { ErrorState } from '../ui/ErrorState';
import { LoadingState } from '../ui/LoadingState';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { Checkbox } from '../ui/Checkbox';
import { PageShell } from '../layout/PageShell';

type Status = 'Falta XML' | 'Não iniciado' | 'Pendência Cliente' | 'Trabalhando' | 'Retificar' | 'Enviado' | 'Homologado';
type AuxiliaryStatus = 'Não Solicitado' | 'Solicitado' | 'Recebido' | 'Importado' | 'Críticas' | 'Diferença Folha' | 'Sem críticas';
type ModalTab = 'update' | 'history' | 'collaboration';

interface Municipality {
  id: number;
  name: string;
  state: string;
  serviceConfig: { activeServices?: Record<string, boolean> };
}
interface Task {
  id: number;
  municipalityId: number;
  obligationCode: string;
  competence: string;
  year: number;
  status: Status;
  siopsMembros?: AuxiliaryStatus | null;
  siopeFolha?: AuxiliaryStatus | null;
  updatedAt: string;
  version: number;
  lastEditorName: string | null;
}
interface Comment { id: number; taskId: number; authorName: string; text: string; createdAt: string; }
interface HistoryRecord {
  id: number; taskId: number; fieldChanged: 'status' | 'siopsMembros' | 'siopeFolha';
  oldValue: string | null; newValue: string | null; actorName: string;
  observation: string | null; createdAt: string;
}
interface Attachment {
  id: number; taskId: number; fileName: string; fileType: string;
  fileSize: number; uploadedAt: string;
}
interface WorkspaceResponse {
  municipalities: Municipality[];
  tasks: Task[];
  commentsMap: Record<number, Comment[]>;
  competences: string[];
}
interface DetailsResponse { history: HistoryRecord[]; comments: Comment[]; attachments: Attachment[]; }
interface CommentPreviewState {
  taskId: number;
  municipalityName: string;
  competence: string;
  comments: Comment[];
  top: number;
  left: number;
}

const OBLIGATIONS = [
  { code: 'MSC', name: 'Matriz de Saldos Contábeis', accent: 'bg-blue-600', tone: 'text-blue-700' },
  { code: 'RREO', name: 'Execução Orçamentária', accent: 'bg-cyan-600', tone: 'text-cyan-700' },
  { code: 'RGF', name: 'Gestão Fiscal', accent: 'bg-violet-600', tone: 'text-violet-700' },
  { code: 'DCA', name: 'Contas Anuais', accent: 'bg-amber-600', tone: 'text-amber-700' },
  { code: 'SIOPE', name: 'Educação', accent: 'bg-emerald-600', tone: 'text-emerald-700' },
  { code: 'SIOPS', name: 'Saúde', accent: 'bg-rose-600', tone: 'text-rose-700' },
] as const;
const STATUSES: Status[] = ['Falta XML', 'Não iniciado', 'Pendência Cliente', 'Trabalhando', 'Retificar', 'Enviado', 'Homologado'];
const AUXILIARY_STATUSES: AuxiliaryStatus[] = ['Não Solicitado', 'Solicitado', 'Recebido', 'Importado', 'Críticas', 'Diferença Folha', 'Sem críticas'];
const STATUS_STYLE: Record<Status, string> = {
  'Falta XML': 'border-rose-200 bg-rose-50 text-rose-700',
  'Não iniciado': 'border-slate-200 bg-slate-100 text-slate-600',
  'Pendência Cliente': 'border-amber-200 bg-amber-50 text-amber-800',
  'Trabalhando': 'border-blue-200 bg-blue-50 text-blue-700',
  'Retificar': 'border-orange-200 bg-orange-50 text-orange-700',
  'Enviado': 'border-violet-200 bg-violet-50 text-violet-700',
  'Homologado': 'border-emerald-200 bg-emerald-50 text-emerald-700',
};
const STATUS_CARD_STYLE: Record<Status, string> = {
  'Falta XML': 'border-slate-200/80 bg-rose-50/55 text-rose-700 hover:border-rose-200 hover:bg-rose-50/90',
  'Não iniciado': 'border-slate-200/80 bg-slate-50/80 text-slate-600 hover:border-slate-300 hover:bg-slate-100/70',
  'Pendência Cliente': 'border-slate-200/80 bg-amber-50/60 text-amber-800 hover:border-amber-200 hover:bg-amber-50',
  'Trabalhando': 'border-slate-200/80 bg-blue-50/60 text-blue-700 hover:border-blue-200 hover:bg-blue-50',
  'Retificar': 'border-slate-200/80 bg-orange-50/60 text-orange-700 hover:border-orange-200 hover:bg-orange-50',
  'Enviado': 'border-slate-200/80 bg-violet-50/60 text-violet-700 hover:border-violet-200 hover:bg-violet-50',
  'Homologado': 'border-slate-200/80 bg-emerald-50/60 text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50',
};
const STATUS_DOT: Record<Status, string> = {
  'Falta XML': 'bg-rose-500',
  'Não iniciado': 'bg-slate-400',
  'Pendência Cliente': 'bg-amber-500',
  Trabalhando: 'bg-blue-500',
  Retificar: 'bg-orange-500',
  Enviado: 'bg-violet-500',
  Homologado: 'bg-emerald-500',
};
const MONTH_INDEX: Record<string, number> = {
  Janeiro: 1, Fevereiro: 2, Março: 3, Abril: 4, Maio: 5, Junho: 6,
  Julho: 7, Agosto: 8, Setembro: 9, Outubro: 10, Novembro: 11, Dezembro: 12, Encerramento: 12,
  '1º Bimestre': 2, '2º Bimestre': 4, '3º Bimestre': 6, '4º Bimestre': 8, '5º Bimestre': 10, '6º Bimestre': 12,
  '1º Quadrimestre': 4, '2º Quadrimestre': 8, '3º Quadrimestre': 12, Anual: 12,
};
const OPEN_TASK_KEY = 'portalmeta.obligations.openTask';

function readRequestedTask(): { taskId: number; year: number; obligationCode: string } | null {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(OPEN_TASK_KEY) || 'null');
    if (!parsed || !Number.isInteger(parsed.taskId) || !Number.isInteger(parsed.year) || !OBLIGATIONS.some((item) => item.code === parsed.obligationCode)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getDueDate(task: Task) {
  const endMonth = MONTH_INDEX[task.competence] || 12;
  const dueMonth = endMonth === 12 ? 1 : endMonth + 1;
  const dueYear = endMonth === 12 ? task.year + 1 : task.year;
  return new Date(dueYear, dueMonth, 0, 23, 59, 59);
}

function isOverdue(task: Task) {
  return task.status !== 'Homologado' && task.status !== 'Enviado' && Date.now() > getDueDate(task).getTime();
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function escapeCsv(value: unknown) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!);
}

function saveBlob(content: BlobPart, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  URL.revokeObjectURL(url);
}

function EmptyCell() {
  return <div className="flex h-11 items-center justify-center"><span className="h-1 w-1 rounded-full bg-slate-200" /></div>;
}

function CommentPreviewPopover({ preview }: { preview: CommentPreviewState }) {
  const recentComments = preview.comments.slice(-3).reverse();

  return createPortal(
    <div
      role="tooltip"
      aria-label={`Comentários de ${preview.municipalityName}, ${preview.competence}`}
      className="pointer-events-none fixed z-[100] w-[min(320px,calc(100vw-24px))] rounded-xl border border-slate-200 bg-white/95 p-3 shadow-[0_16px_40px_rgba(15,23,42,0.18)] backdrop-blur-sm"
      style={{ top: preview.top, left: preview.left }}
    >
      <div className="mb-2.5 flex items-start justify-between gap-3 border-b border-slate-100 pb-2.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-slate-950">{preview.municipalityName}</p>
          <p className="mt-0.5 text-[10px] font-medium text-slate-500">{preview.competence}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
          <MessageSquare size={11} />{preview.comments.length}
        </span>
      </div>
      <div className="space-y-2">
        {recentComments.map((comment) => (
          <div key={comment.id} className="rounded-lg bg-slate-50 px-2.5 py-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-[10px] font-bold text-slate-800">{comment.authorName}</span>
              <span className="shrink-0 text-[9px] text-slate-400">{formatDate(comment.createdAt)}</span>
            </div>
            <p className="line-clamp-3 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-slate-600">{comment.text}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 border-t border-slate-100 pt-2 text-[9px] font-medium text-slate-400">
        {preview.comments.length > recentComments.length
          ? `Mostrando os ${recentComments.length} mais recentes · clique no contador para ver todos`
          : 'Clique no contador para abrir os comentários'}
      </p>
    </div>,
    document.body,
  );
}

interface TaskModalProps {
  task: Task | null;
  municipality?: Municipality;
  currentUser: User;
  initialTab: ModalTab;
  onClose: () => void;
  onUpdated: (task: Task) => void;
  onCommentAdded: (comment: Comment) => void;
}

function TaskModal({ task, municipality, currentUser, initialTab, onClose, onUpdated, onCommentAdded }: TaskModalProps) {
  const [tab, setTab] = useState<ModalTab>(initialTab);
  const [details, setDetails] = useState<DetailsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<Status>('Falta XML');
  const [siopsMembros, setSiopsMembros] = useState<AuxiliaryStatus>('Não Solicitado');
  const [siopeFolha, setSiopeFolha] = useState<AuxiliaryStatus>('Não Solicitado');
  const [observation, setObservation] = useState('');
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editingHistory, setEditingHistory] = useState<HistoryRecord | null>(null);
  const [historyOldValue, setHistoryOldValue] = useState('');
  const [historyNewValue, setHistoryNewValue] = useState('');
  const [historyObservation, setHistoryObservation] = useState('');

  const canEdit = hasPermission(currentUser, 'obrigacoes.planilha.editar');
  const canComment = hasPermission(currentUser, 'obrigacoes.planilha.comentar');
  const canAttach = hasPermission(currentUser, 'obrigacoes.planilha.anexar');
  const canEditHistory = hasPermission(currentUser, 'obrigacoes.planilha.editar_historico');

  useEffect(() => { setTab(initialTab); }, [initialTab, task?.id]);
  useEffect(() => {
    if (!task) return;
    setStatus(task.status);
    setSiopsMembros(task.siopsMembros || 'Não Solicitado');
    setSiopeFolha(task.siopeFolha || 'Não Solicitado');
    setObservation(''); setError(''); setDetails(null);
    setLoading(true);
    api.get<DetailsResponse>(`/obligations/tasks/${task.id}/details`)
      .then(setDetails).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [task?.id]);

  if (!task) return null;

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const updated = await api.put<Task>(`/obligations/tasks/${task.id}`, {
        status,
        siopsMembros: task.obligationCode === 'SIOPS' ? siopsMembros : undefined,
        siopeFolha: task.obligationCode === 'SIOPE' ? siopeFolha : undefined,
        observation,
        version: task.version,
      });
      onUpdated(updated); onClose();
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  };

  const handleComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!comment.trim()) return;
    setSaving(true); setError('');
    try {
      const created = await api.post<Comment>(`/obligations/tasks/${task.id}/comments`, { text: comment });
      setDetails((current) => current ? { ...current, comments: [...current.comments, created] } : current);
      setComment(''); onCommentAdded(created);
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true); setError('');
    try {
      const body = new FormData(); body.append('file', file);
      const created = await api.post<Attachment>(`/obligations/tasks/${task.id}/attachments`, body);
      setDetails((current) => current ? { ...current, attachments: [created, ...current.attachments] } : current);
    } catch (err: any) { setError(err.message); } finally { setUploading(false); }
  };

  const handleDownload = async (attachment: Attachment) => {
    setError('');
    try {
      const response = await fetch(`/api/obligations/attachments/${attachment.id}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Não foi possível baixar o arquivo.');
      saveBlob(await response.blob(), attachment.fileType, attachment.fileName);
    } catch (err: any) { setError(err.message); }
  };

  const beginHistoryEdit = (record: HistoryRecord) => {
    setEditingHistory(record); setHistoryOldValue(record.oldValue || '');
    setHistoryNewValue(record.newValue || ''); setHistoryObservation(record.observation || '');
  };

  const saveHistory = async () => {
    if (!editingHistory) return;
    setSaving(true); setError('');
    try {
      const result = await api.put<{ id: number; task: Task }>(`/obligations/history/${editingHistory.id}`, {
        oldValue: historyOldValue || null, newValue: historyNewValue || null,
        observation: historyObservation || null,
        taskVersion: task.version,
      });
      setDetails((current) => current ? {
        ...current,
        history: current.history.map((record) => record.id === editingHistory.id ? {
          ...record, oldValue: historyOldValue || null, newValue: historyNewValue || null,
          observation: historyObservation || null, actorName: currentUser.nome,
        } : record),
      } : current);
      setEditingHistory(null);
      onUpdated(result.task);
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  };

  const tabs: Array<{ id: ModalTab; label: string; icon: typeof Check }> = [
    { id: 'update', label: 'Atualizar', icon: Check },
    { id: 'history', label: 'Histórico', icon: History },
    { id: 'collaboration', label: 'Comentários e arquivos', icon: MessageSquare },
  ];

  return (
    <Modal isOpen onClose={onClose} size="xl" title={`${municipality?.name || 'Município'} · ${task.competence}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="font-bold text-slate-900">{task.obligationCode}</span><span>•</span><span>{task.year}</span>
          <span>•</span><span>Vence em {getDueDate(task).toLocaleDateString('pt-BR')}</span>
          {task.lastEditorName ? <><span>•</span><span>Última alteração por {task.lastEditorName}</span></> : null}
        </div>
        <span className={cn('rounded-md border px-2 py-1 text-[11px] font-bold', STATUS_STYLE[task.status])}>{task.status}</span>
      </div>

      <div className="mb-5 flex gap-1 border-b border-slate-200">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} className={cn(
            'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors',
            tab === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-900',
          )}><Icon size={14} />{label}</button>
        ))}
      </div>

      {error ? <div className="mb-4 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700"><AlertCircle size={15} />{error}</div> : null}

      {tab === 'update' ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold text-slate-700">
              Status principal
              <Select disabled={!canEdit} value={status} onChange={(value) => setStatus(value as Status)} options={STATUSES.filter((item) => task.obligationCode === 'SIOPE' || task.obligationCode === 'SIOPS' || item !== 'Pendência Cliente').map((item) => ({ value: item, label: item }))} />
            </label>
            {task.obligationCode === 'SIOPS' ? (
              <label className="space-y-1.5 text-xs font-semibold text-slate-700">Controle de membros
                <Select disabled={!canEdit} value={siopsMembros} onChange={(value) => setSiopsMembros(value as AuxiliaryStatus)} options={AUXILIARY_STATUSES.map((item) => ({ value: item, label: item }))} />
              </label>
            ) : null}
            {task.obligationCode === 'SIOPE' ? (
              <label className="space-y-1.5 text-xs font-semibold text-slate-700">Controle da folha
                <Select disabled={!canEdit} value={siopeFolha} onChange={(value) => setSiopeFolha(value as AuxiliaryStatus)} options={AUXILIARY_STATUSES.map((item) => ({ value: item, label: item }))} />
              </label>
            ) : null}
          </div>
          <label className="block space-y-1.5 text-xs font-semibold text-slate-700">Observação da alteração
            <textarea disabled={!canEdit} value={observation} onChange={(e) => setObservation(e.target.value)} rows={4} maxLength={5000} placeholder="Contexto opcional para o histórico..." className="w-full resize-none rounded-md border border-slate-200 bg-white p-3 text-[13px] font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50" />
          </label>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            {canEdit ? <Button loading={saving} onClick={handleSave}>Salvar alteração</Button> : null}
          </div>
        </div>
      ) : null}

      {tab === 'history' ? loading ? <LoadingState compact message="Carregando histórico..." /> : (
        <div className="space-y-2">
          {!details?.history.length ? <div className="rounded-lg border border-dashed border-slate-200 py-12 text-center text-xs text-slate-500">Nenhuma alteração registrada.</div> : details.history.map((record) => (
            <div key={record.id} className="rounded-lg border border-slate-200 bg-white p-3">
              {editingHistory?.id === record.id ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-[11px] font-semibold text-slate-600">Valor anterior<input value={historyOldValue} onChange={(e) => setHistoryOldValue(e.target.value)} className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-xs" /></label>
                    <label className="text-[11px] font-semibold text-slate-600">Valor corrigido<input value={historyNewValue} onChange={(e) => setHistoryNewValue(e.target.value)} className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-xs" /></label>
                  </div>
                  <label className="text-[11px] font-semibold text-slate-600">Observação<textarea value={historyObservation} onChange={(e) => setHistoryObservation(e.target.value)} rows={2} className="mt-1 w-full rounded-md border border-slate-200 p-2 text-xs" /></label>
                  <div className="flex justify-end gap-2"><Button size="xs" variant="ghost" onClick={() => setEditingHistory(null)}>Cancelar</Button><Button size="xs" loading={saving} onClick={saveHistory}>Salvar correção</Button></div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-md border border-slate-200 bg-slate-50 p-1.5 text-slate-500"><History size={14} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold text-slate-900">{record.fieldChanged === 'status' ? 'Status principal' : record.fieldChanged === 'siopsMembros' ? 'Membros SIOPS' : 'Folha SIOPE'}</p><span className="text-[10px] font-medium text-slate-400">{formatDate(record.createdAt)}</span></div>
                    <p className="mt-1 text-xs text-slate-600"><span className="line-through opacity-60">{record.oldValue || 'Vazio'}</span><span className="mx-2 text-slate-300">→</span><span className="font-bold text-slate-900">{record.newValue || 'Vazio'}</span></p>
                    <p className="mt-1 text-[11px] text-slate-500">Por {record.actorName}{record.observation ? ` · ${record.observation}` : ''}</p>
                  </div>
                  {canEditHistory ? <Button size="xs" variant="ghost" onClick={() => beginHistoryEdit(record)}>Corrigir</Button> : null}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'collaboration' ? loading ? <LoadingState compact message="Carregando colaboração..." /> : (
        <div className="grid gap-5 md:grid-cols-2">
          <section className="flex min-h-[360px] flex-col">
            <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><MessageSquare size={14} />Comentários</h4>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              {!details?.comments.length ? <p className="py-12 text-center text-xs text-slate-400">Nenhum comentário nesta competência.</p> : details.comments.map((item) => (
                <div key={item.id} className="rounded-md border border-slate-200 bg-white p-3 shadow-sm shadow-slate-900/5"><div className="mb-1 flex items-center justify-between gap-2"><span className="text-[11px] font-bold text-slate-900">{item.authorName}</span><span className="text-[10px] text-slate-400">{formatDate(item.createdAt)}</span></div><p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{item.text}</p></div>
              ))}
            </div>
            {canComment ? <form onSubmit={handleComment} className="mt-2 flex gap-2"><input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={5000} placeholder="Escreva um comentário..." className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 px-3 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /><Button type="submit" size="icon" loading={saving} disabled={!comment.trim()} aria-label="Enviar comentário"><Send size={14} /></Button></form> : null}
          </section>
          <section className="flex min-h-[360px] flex-col">
            <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><Paperclip size={14} />Arquivos</h4>
            {canAttach ? <label className="mb-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-blue-200 bg-blue-50/50 px-4 py-4 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50"><input type="file" className="hidden" disabled={uploading} onChange={handleUpload} accept=".xml,.pdf,.xlsx,.xls,.doc,.docx,.zip,image/*" />{uploading ? <Loader2 className="animate-spin" size={15} /> : <Upload size={15} />}{uploading ? 'Enviando arquivo...' : 'Adicionar arquivo (máx. 10 MB)'}</label> : null}
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              {!details?.attachments.length ? <p className="py-12 text-center text-xs text-slate-400">Nenhum arquivo anexado.</p> : details.attachments.map((attachment) => (
                <button key={attachment.id} onClick={() => handleDownload(attachment)} className="flex w-full items-center gap-3 rounded-md border border-slate-200 bg-white p-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/30"><span className="rounded-md bg-slate-100 p-2 text-slate-500"><FileText size={15} /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-slate-800">{attachment.fileName}</span><span className="text-[10px] text-slate-400">{Math.max(1, Math.round(attachment.fileSize / 1024))} KB · {formatDate(attachment.uploadedAt)}</span></span><Download size={14} className="text-slate-400" /></button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </Modal>
  );
}

export function ObligationsSpreadsheetPage({ currentUser, onNavigate }: {
  currentUser: User;
  onNavigate: (tab: 'obligations-municipalities') => void;
}) {
  const currentYear = new Date().getFullYear();
  const requestedTask = useMemo(readRequestedTask, []);
  const [obligation, setObligation] = useState(requestedTask?.obligationCode || 'MSC');
  const [year, setYear] = useState(requestedTask?.year || currentYear);
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase('pt-BR'));
  const [statusFilters, setStatusFilters] = useState<Set<Status>>(new Set());
  const [municipalityFilters, setMunicipalityFilters] = useState<Set<number>>(new Set());
  const [competenceFilters, setCompetenceFilters] = useState<Set<string>>(new Set());
  const [auxiliaryFilters, setAuxiliaryFilters] = useState<Set<AuxiliaryStatus>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalTab, setModalTab] = useState<ModalTab>('update');
  const [commentPreview, setCommentPreview] = useState<CommentPreviewState | null>(null);
  const canManageMunicipalities = hasPermission(currentUser, 'obrigacoes.municipios.visualizar');

  const loadWorkspace = useCallback(async () => {
    setLoading(true); setError('');
    try {
      setWorkspace(await api.get<WorkspaceResponse>(`/obligations/workspace?year=${year}&obligationCode=${obligation}`));
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  }, [year, obligation]);
  useEffect(() => { void loadWorkspace(); }, [loadWorkspace]);
  useEffect(() => {
    if (!workspace || !requestedTask) return;
    const task = workspace.tasks.find((item) => item.id === requestedTask.taskId);
    if (task) {
      setSelectedTask(task);
      setModalTab('update');
    }
    sessionStorage.removeItem(OPEN_TASK_KEY);
  }, [workspace, requestedTask]);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const taskMap = useMemo(() => new Map((workspace?.tasks || []).map((task) => [`${task.municipalityId}|${task.competence}`, task])), [workspace?.tasks]);
  const visibleMunicipalities = useMemo(() => (workspace?.municipalities || []).filter((municipality) => {
    if (municipalityFilters.size && !municipalityFilters.has(municipality.id)) return false;
    if (!deferredSearch) return true;
    return municipality.name.toLocaleLowerCase('pt-BR').includes(deferredSearch);
  }), [workspace?.municipalities, municipalityFilters, deferredSearch]);
  const visibleCompetences = useMemo(() => (workspace?.competences || []).filter((item) => !competenceFilters.size || competenceFilters.has(item)), [workspace?.competences, competenceFilters]);
  const filteredTasks = useMemo(() => visibleMunicipalities.flatMap((municipality) => visibleCompetences.map((competence) => taskMap.get(`${municipality.id}|${competence}`)).filter((task): task is Task => {
    if (!task) return false;
    if (statusFilters.size && !statusFilters.has(task.status)) return false;
    const auxiliary = obligation === 'SIOPS' ? task.siopsMembros : obligation === 'SIOPE' ? task.siopeFolha : null;
    return !auxiliaryFilters.size || (!!auxiliary && auxiliaryFilters.has(auxiliary));
  })), [visibleMunicipalities, visibleCompetences, taskMap, statusFilters, auxiliaryFilters, obligation]);
  const filteredTaskIds = useMemo(() => new Set(filteredTasks.map((task) => task.id)), [filteredTasks]);
  const activeFilterCount = statusFilters.size + municipalityFilters.size + competenceFilters.size + auxiliaryFilters.size;
  const stats = useMemo(() => {
    let completed = 0;
    let homologated = 0;
    let working = 0;
    let overdue = 0;
    for (const task of filteredTasks) {
      if (task.status === 'Homologado' || task.status === 'Enviado') completed += 1;
      if (task.status === 'Homologado') homologated += 1;
      if (task.status === 'Trabalhando') working += 1;
      if (isOverdue(task)) overdue += 1;
    }
    return {
      cells: filteredTasks.length, completed, homologated, working, overdue,
      completionRate: filteredTasks.length ? Math.round((completed / filteredTasks.length) * 100) : 0,
    };
  }, [filteredTasks]);
  const toggleSet = <T,>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, value: T) => setter((current) => {
    const next = new Set(current); next.has(value) ? next.delete(value) : next.add(value); return next;
  });
  const clearFilters = () => { setStatusFilters(new Set()); setMunicipalityFilters(new Set()); setCompetenceFilters(new Set()); setAuxiliaryFilters(new Set()); setSearch(''); };
  const openTask = (task: Task, tab: ModalTab = 'update') => {
    setCommentPreview(null); setSelectedTask(task); setModalTab(tab);
  };
  const showCommentPreview = (element: HTMLElement, task: Task, municipalityName: string, comments: Comment[]) => {
    if (!comments.length) return;
    const rect = element.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    const height = Math.min(310, 74 + Math.min(comments.length, 3) * 72);
    const fitsOnRight = rect.right + 10 + width <= window.innerWidth - 12;
    const left = fitsOnRight ? rect.right + 10 : Math.max(12, rect.left - width - 10);
    const top = Math.min(
      Math.max(12, rect.top + rect.height / 2 - height / 2),
      Math.max(12, window.innerHeight - height - 12),
    );
    setCommentPreview({ taskId: task.id, municipalityName, competence: task.competence, comments, top, left });
  };
  const updateTask = (updated: Task) => {
    setWorkspace((current) => current ? { ...current, tasks: current.tasks.map((task) => task.id === updated.id ? updated : task) } : current);
    setSelectedTask((current) => current?.id === updated.id ? updated : current);
  };
  const addComment = (created: Comment) => setWorkspace((current) => current ? {
    ...current, commentsMap: { ...current.commentsMap, [created.taskId]: [...(current.commentsMap[created.taskId] || []), created] },
  } : current);

  const exportRows = () => visibleMunicipalities.map((municipality) => [
    municipality.name,
    ...visibleCompetences.map((competence) => {
      const task = taskMap.get(`${municipality.id}|${competence}`);
      if (!task || !filteredTaskIds.has(task.id)) return '';
      const auxiliary = obligation === 'SIOPS' ? task.siopsMembros : obligation === 'SIOPE' ? task.siopeFolha : null;
      return auxiliary ? `${task.status} (${auxiliary})` : task.status;
    }),
  ]);
  const exportCsv = () => {
    const rows = [['Município', ...visibleCompetences], ...exportRows()];
    saveBlob(`\uFEFF${rows.map((row) => row.map(escapeCsv).join(';')).join('\n')}`, 'text/csv;charset=utf-8', `Obrigacoes_${obligation}_${year}.csv`);
  };
  const exportExcel = () => {
    const headers = ['Município', ...visibleCompetences];
    const html = `<html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${headers.map((item) => `<th>${escapeHtml(item)}</th>`).join('')}</tr></thead><tbody>${exportRows().map((row) => `<tr>${row.map((item) => `<td>${escapeHtml(item)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
    saveBlob(html, 'application/vnd.ms-excel;charset=utf-8', `Obrigacoes_${obligation}_${year}.xls`);
  };

  if (loading && !workspace) return <LoadingState className="h-full w-full" message="Preparando a Planilha Principal..." />;
  if (error && !workspace) return <ErrorState className="h-full w-full" message={error} onRetry={loadWorkspace} />;

  return (
    <>
      <PageShell
      actions={<>{canManageMunicipalities ? <Button size="sm" onClick={() => onNavigate('obligations-municipalities')}><Plus size={13} />Adicionar município</Button> : null}<div className="flex h-9 items-center gap-1 rounded-md border border-slate-200 bg-white pl-2.5 text-xs font-semibold text-slate-500"><span>Exercício</span><Select value={year} onChange={(value) => setYear(Number(value))} options={[currentYear - 1, currentYear, currentYear + 1].map((item) => ({ value: String(item), label: String(item) }))} size="sm" className="w-20" buttonClassName="border-0 bg-transparent px-2 shadow-none" /></div><Button size="sm" variant="outline" disabled={loading} onClick={loadWorkspace}><RefreshCw size={13} className={cn(loading && 'animate-spin')} />Atualizar</Button></>}
      tabs={<div className="flex gap-1 overflow-x-auto py-3">{OBLIGATIONS.map((item) => { const selected = item.code === obligation; return <button key={item.code} onClick={() => { setObligation(item.code); clearFilters(); }} className={cn('flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-medium transition-all', selected ? 'border border-slate-200/60 bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')}><span className={cn('h-1.5 w-1.5 rounded-full', item.accent)} />{item.code}</button>; })}</div>}
      flush
      contentClassName="flex min-h-0 flex-col bg-white print:block"
    >
      <div className="relative shrink-0 overflow-visible border-b border-slate-200/70 bg-white print:hidden">
        <div className="flex flex-col gap-3 px-3 py-3 sm:px-4">

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <div className="relative min-w-[240px] flex-1 sm:max-w-sm"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar município" className="h-8 w-full rounded-md border border-slate-200 bg-slate-50/70 pl-9 pr-8 text-xs font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" />{search ? <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X size={13} /></button> : null}</div>
              <div className="relative" ref={filterRef}>
                <Button size="sm" variant={activeFilterCount ? 'secondary' : 'outline'} onClick={() => setFilterOpen((value) => !value)}><SlidersHorizontal size={13} />Filtros{activeFilterCount ? <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[9px] text-white">{activeFilterCount}</span> : null}<ChevronDown size={12} /></Button>
                {filterOpen ? <div className="absolute left-0 top-full z-40 mt-2 w-[min(92vw,640px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3"><div><p className="text-xs font-bold text-slate-950">Refinar visualização</p><p className="text-[10px] font-medium text-slate-400">Combine os filtros para reduzir a matriz.</p></div><button onClick={clearFilters} className="text-[11px] font-semibold text-blue-600 hover:text-blue-800">Limpar tudo</button></div>
                  <div className="grid gap-5 p-4 sm:grid-cols-2">
                    <fieldset><legend className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Status</legend><div className="flex flex-wrap gap-1.5">{STATUSES.map((item) => <button key={item} onClick={() => toggleSet(setStatusFilters, item)} className={cn('flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] font-semibold transition', statusFilters.has(item) ? STATUS_STYLE[item] : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}><span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[item])} />{item}</button>)}</div></fieldset>
                    <fieldset><legend className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Competências</legend><div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">{workspace?.competences.map((item) => <button key={item} onClick={() => toggleSet(setCompetenceFilters, item)} className={cn('rounded-md border px-2 py-1.5 text-[10px] font-semibold transition', competenceFilters.has(item) ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}>{item}</button>)}</div></fieldset>
                    <fieldset><legend className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Municípios</legend><div className="max-h-36 space-y-0.5 overflow-y-auto pr-2">{workspace?.municipalities.map((item) => <Checkbox key={item.id} checked={municipalityFilters.has(item.id)} onChange={() => toggleSet(setMunicipalityFilters, item.id)} label={item.name} />)}</div></fieldset>
                    {obligation === 'SIOPE' || obligation === 'SIOPS' ? <fieldset><legend className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">{obligation === 'SIOPE' ? 'Folha SIOPE' : 'Membros SIOPS'}</legend><div className="space-y-0.5">{AUXILIARY_STATUSES.map((item) => <Checkbox key={item} checked={auxiliaryFilters.has(item)} onChange={() => toggleSet(setAuxiliaryFilters, item)} label={item} />)}</div></fieldset> : null}
                  </div>
                </div> : null}
              </div>
              {activeFilterCount || search ? <button onClick={clearFilters} className="flex h-8 items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900"><X size={12} />Limpar</button> : null}
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" onClick={exportExcel}><FileDown size={13} />Excel</Button>
              <Button size="sm" variant="ghost" onClick={exportCsv}><Download size={13} />CSV</Button>
              <Button size="sm" variant="ghost" onClick={() => window.print()}><FileText size={13} />Imprimir</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50/70 px-2.5 py-1.5"><span className="rounded border border-slate-200 bg-white p-1 text-slate-500"><Building2 size={12} /></span><div><strong className="block text-sm font-semibold leading-none text-slate-950">{visibleMunicipalities.length}</strong><span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Municípios</span></div></div>
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50/70 px-2.5 py-1.5"><span className="rounded border border-blue-200 bg-blue-50 p-1 text-blue-600"><CircleCheckBig size={12} /></span><div><strong className="block text-sm font-semibold leading-none text-slate-950">{stats.completionRate}%</strong><span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Conclusão</span></div></div>
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50/70 px-2.5 py-1.5"><span className="rounded border border-emerald-200 bg-emerald-50 p-1 text-emerald-600"><Check size={12} /></span><div><strong className="block text-sm font-semibold leading-none text-slate-950">{stats.homologated}</strong><span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Homologadas</span></div></div>
            <div className={cn('flex items-center gap-2 rounded-md border px-2.5 py-1.5', stats.overdue ? 'border-rose-200 bg-rose-50/70' : 'border-slate-200 bg-slate-50/70')}><span className={cn('rounded border bg-white p-1', stats.overdue ? 'border-rose-200 text-rose-600' : 'border-slate-200 text-slate-500')}><Clock3 size={12} /></span><div><strong className={cn('block text-sm font-semibold leading-none', stats.overdue ? 'text-rose-700' : 'text-slate-950')}>{stats.overdue}</strong><span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Em atraso</span></div></div>
          </div>
        </div>
      </div>

      {error ? <div className="flex shrink-0 items-center justify-between rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"><span className="flex items-center gap-2"><AlertCircle size={14} />{error}</span><button onClick={() => setError('')}><X size={14} /></button></div> : null}

      <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white print:overflow-visible">
        <div className="shrink-0 overflow-x-auto border-b border-slate-100 bg-white px-4 py-2 print:hidden">
          <div className="flex min-w-max items-center justify-between gap-6">
            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500"><span className="font-semibold text-slate-900">{stats.cells} competências visíveis</span><span className="text-slate-300">·</span><span>{stats.completed} concluídas</span><span className="text-slate-300">·</span><span>{stats.working} trabalhando</span></div>
            <div className="flex items-center gap-3">{STATUSES.map((status) => <span key={status} className="flex items-center gap-1.5 whitespace-nowrap text-[9px] font-semibold text-slate-500"><span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} />{status}</span>)}</div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto print:overflow-visible" onScroll={() => setCommentPreview(null)}>
          <table className="w-max min-w-full border-separate border-spacing-0 text-left print:w-full">
          <thead><tr>
            <th className="sticky left-0 top-0 z-30 w-[140px] min-w-[140px] max-w-[140px] border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">Município</th>
            {visibleCompetences.map((competence, index) => <th key={competence} className="sticky top-0 z-10 min-w-[116px] border-b border-r border-slate-200 bg-slate-50/95 px-1 py-1.5 text-center last:border-r-0"><span className="block text-[7px] font-semibold uppercase tracking-widest text-slate-400">{String(index + 1).padStart(2, '0')}</span><span className="block truncate text-[9px] font-bold text-slate-700" title={competence}>{competence}</span></th>)}
          </tr></thead>
          <tbody>{visibleMunicipalities.map((municipality) => {
            return <tr key={municipality.id} className="group/row even:bg-slate-50/25 hover:bg-blue-50/20">
              <th className="sticky left-0 z-10 w-[140px] min-w-[140px] max-w-[140px] border-b border-r border-slate-200 bg-white px-2 py-1.5 group-even/row:bg-[#fbfcfd] group-hover/row:bg-blue-50"><span title={municipality.name} className="block truncate text-[11px] font-semibold text-slate-950">{municipality.name}</span></th>
              {visibleCompetences.map((competence) => {
                const task = taskMap.get(`${municipality.id}|${competence}`);
                if (!task || !filteredTaskIds.has(task.id)) return <td key={competence} className="border-b border-r border-slate-100 last:border-r-0"><EmptyCell /></td>;
                const overdue = isOverdue(task); const comments = workspace?.commentsMap[task.id] || [];
                const auxiliary = obligation === 'SIOPS' ? task.siopsMembros : obligation === 'SIOPE' ? task.siopeFolha : null;
                return <td key={competence} className="border-b border-r border-slate-100 p-1 last:border-r-0">
                  <button
                    type="button"
                    onClick={() => openTask(task)}
                    onMouseEnter={(event) => showCommentPreview(event.currentTarget, task, municipality.name, comments)}
                    onMouseLeave={() => setCommentPreview(null)}
                    onFocus={(event) => showCommentPreview(event.currentTarget, task, municipality.name, comments)}
                    onBlur={() => setCommentPreview(null)}
                    className={cn(
                      'group/cell relative flex w-full min-w-[110px] flex-col items-start justify-center overflow-hidden rounded-md border px-2.5 text-left transition-all hover:-translate-y-px hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300',
                      auxiliary ? 'h-10' : 'h-9',
                      STATUS_CARD_STYLE[task.status],
                      overdue && 'ring-1 ring-inset ring-rose-200',
                    )}
                  >
                    <span className="w-full truncate text-[10px] font-bold leading-tight" title={task.status}>{task.status}</span>
                    {auxiliary ? <span title={auxiliary} className={cn('mt-1 block w-full truncate text-[9px] font-medium leading-none text-slate-500', comments.length && 'pr-7')}>{auxiliary}</span> : null}
                    {overdue ? <Clock3 size={9} className="absolute right-1 top-1 text-rose-500" /> : null}
                    {comments.length ? <span onClick={(event) => { event.stopPropagation(); openTask(task, 'collaboration'); }} className="absolute bottom-1 right-1.5 flex items-center gap-0.5 rounded bg-white/70 px-1 py-0.5 text-[8px] font-bold text-slate-400 transition group-hover/cell:text-blue-600"><MessageSquare size={8} />{comments.length}</span> : null}
                  </button>
                </td>;
              })}
            </tr>;
          })}</tbody>
          </table>
          {!visibleMunicipalities.length ? <div className="flex min-h-[260px] flex-col items-center justify-center text-center"><Filter size={24} className="mb-2 text-slate-300" /><p className="text-sm font-semibold text-slate-700">Nenhum município encontrado</p><button onClick={clearFilters} className="mt-1 text-xs font-semibold text-blue-600">Limpar filtros</button></div> : null}
        </div>
      </section>

      <TaskModal task={selectedTask} municipality={workspace?.municipalities.find((item) => item.id === selectedTask?.municipalityId)} currentUser={currentUser} initialTab={modalTab} onClose={() => setSelectedTask(null)} onUpdated={updateTask} onCommentAdded={addComment} />
      </PageShell>
      {commentPreview ? <CommentPreviewPopover preview={commentPreview} /> : null}
    </>
  );
}
