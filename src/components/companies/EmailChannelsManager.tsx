import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, Clock, Copy, History, Info, Mail, Plus, RefreshCw, Send, ShieldCheck, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { cn, formatRelativeTime } from '../../lib/utils';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';

interface EmailChannel {
  id: number;
  empresa_id: number;
  nome?: string;
  email_publico: string;
  inbound_address: string;
  status: 'pendente' | 'verificado' | 'ativo' | 'erro';
  ultimo_erro?: string;
  last_received_at?: string;
  verified_at?: string;
  // Envio por canal (SMTP da empresa). Senha NUNCA é exposta.
  smtp_enabled?: boolean | number;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_secure?: boolean | number;
  smtp_user?: string | null;
  smtp_from_name?: string | null;
  smtp_status?: 'not_configured' | 'configured' | 'verified' | 'error';
  smtp_last_test_at?: string | null;
  smtp_last_error?: string | null;
}

const getSmtpStatusInfo = (status?: string) => {
  switch (status) {
    case 'verified':
      return { label: 'Verificado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'configured':
      return { label: 'Configurado', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'error':
      return { label: 'Erro', cls: 'bg-red-50 text-red-700 border-red-200' };
    default:
      return { label: 'Não configurado', cls: 'bg-slate-100 text-slate-500 border-slate-200' };
  }
};

// Presets de SMTP por provedor (apenas sugestões de UI; não são salvos no backend).
interface SmtpProvider {
  key: string;
  label: string;
  host: string;
  port: number;
  secure: boolean;
  autofill: boolean;
  tutorial: string[];
  note?: string;
}

const SMTP_PROVIDERS: SmtpProvider[] = [
  {
    key: 'gmail',
    label: 'Gmail / Google Workspace',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    autofill: true,
    note: 'Use uma SENHA DE APLICATIVO (não a senha normal da conta). Porta 587 (STARTTLS) ou 465 (SSL/TLS).',
    tutorial: [
      'Acesse sua Conta Google (myaccount.google.com).',
      'Ative a verificação em duas etapas, se ainda não estiver ativa.',
      'Gere uma "Senha de app" em Segurança > Senhas de app.',
      'Use essa senha de app no campo "Senha SMTP" (não a senha normal).',
    ],
  },
  {
    key: 'outlook',
    label: 'Outlook / Microsoft 365',
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    autofill: true,
    note: 'Algumas contas Microsoft exigem Autenticação Moderna/OAuth2. Se o teste falhar mesmo com a senha correta, a conta pode não permitir SMTP por senha — nesse caso será necessária integração OAuth/Microsoft no futuro ou SMTP autorizado pelo administrador.',
    tutorial: [
      'Use seu e-mail completo como usuário.',
      'Host: smtp-mail.outlook.com, Porta: 587 (STARTTLS).',
      'Se a conta exigir Autenticação Moderna, o envio por senha pode ser bloqueado.',
      'Confirme com o administrador do Microsoft 365 se o SMTP autenticado está liberado.',
    ],
  },
  {
    key: 'yahoo',
    label: 'Yahoo',
    host: 'smtp.mail.yahoo.com',
    port: 587,
    secure: false,
    autofill: true,
    note: 'Use uma senha de aplicativo. Porta 587 (STARTTLS) ou 465 (SSL/TLS).',
    tutorial: [
      'Acesse a Segurança da Conta Yahoo.',
      'Gere uma "Senha para app".',
      'Use a senha gerada no campo "Senha SMTP".',
    ],
  },
  {
    key: 'zoho',
    label: 'Zoho Mail',
    host: 'smtp.zoho.com',
    port: 587,
    secure: false,
    autofill: true,
    note: 'Contas com domínio próprio podem usar servidor/região diferente (ex.: smtp.zoho.eu). Confira no painel do Zoho.',
    tutorial: [
      'Acesse o painel do Zoho Mail.',
      'Verifique os dados de SMTP em Configurações > E-mail.',
      'Confirme o host correto para sua região/domínio (ex.: smtp.zoho.com ou smtp.zoho.eu).',
    ],
  },
  {
    key: 'outro',
    label: 'Provedor próprio / Hostinger / Locaweb / Registro.br / outro',
    host: '',
    port: 587,
    secure: false,
    autofill: false,
    note: 'Consulte no painel do seu provedor os dados de SMTP de envio. Normalmente ficam em Configurações > E-mail > SMTP/IMAP.',
    tutorial: [
      'No painel do provedor, procure os dados de SMTP de envio.',
      'Host: algo como smtp.seudominio.com.br.',
      'Porta: 587 (STARTTLS, SSL/TLS desmarcado) ou 465 (SSL/TLS marcado).',
      'Usuário: geralmente o e-mail completo da caixa.',
      'Senha: a senha da caixa ou uma senha de aplicativo, conforme o provedor.',
    ],
  },
];

interface EmailChannelsManagerProps {
  empresaId: number;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canTest?: boolean;
}

interface CreateEmailChannelResponse {
  id: number;
}

export const EmailChannelsManager = ({
  empresaId,
  canCreate = true,
  canEdit = true,
  canDelete = true,
  canTest = true,
}: EmailChannelsManagerProps) => {
  const [channels, setChannels] = useState<EmailChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newNome, setNewNome] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // --- Configuração de SMTP por canal ---
  const [smtpModalChannel, setSmtpModalChannel] = useState<EmailChannel | null>(null);
  const [smtpForm, setSmtpForm] = useState({
    smtp_enabled: false,
    smtp_host: '',
    smtp_port: 587,
    smtp_secure: false,
    smtp_user: '',
    smtp_from_name: '',
  });
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpError, setSmtpError] = useState<string | null>(null);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpTab, setSmtpTab] = useState<'config' | 'tutorial' | 'recebimento'>('config');
  const [smtpProvider, setSmtpProvider] = useState('');

  const applyProvider = (key: string) => {
    setSmtpProvider(key);
    const preset = SMTP_PROVIDERS.find((p) => p.key === key);
    if (!preset || !preset.autofill) return;
    setSmtpForm((f) => ({ ...f, smtp_host: preset.host, smtp_port: preset.port, smtp_secure: preset.secure }));
  };

  const selectedProvider = SMTP_PROVIDERS.find((p) => p.key === smtpProvider) || null;

  const channelHasStoredPassword = (c: EmailChannel | null) =>
    !!c && !!c.smtp_status && c.smtp_status !== 'not_configured';

  const openSmtpModal = (channel: EmailChannel) => {
    if (!canEdit && !canTest) return;
    setSmtpModalChannel(channel);
    setSmtpForm({
      smtp_enabled: !!Number(channel.smtp_enabled),
      smtp_host: channel.smtp_host || '',
      smtp_port: channel.smtp_port || 587,
      smtp_secure: !!Number(channel.smtp_secure),
      smtp_user: channel.smtp_user || '',
      smtp_from_name: channel.smtp_from_name || '',
    });
    setSmtpPassword('');
    setSmtpError(null);
    setSmtpTab('config');
    setSmtpProvider('');
  };

  const closeSmtpModal = () => {
    if (smtpSaving || smtpTesting) return;
    setSmtpModalChannel(null);
    setSmtpPassword('');
    setSmtpError(null);
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smtpModalChannel) return;
    if (!canEdit) {
      setSmtpError('Sem permissão para alterar o envio deste canal.');
      return;
    }

    const hasStored = channelHasStoredPassword(smtpModalChannel);
    if (smtpForm.smtp_enabled) {
      if (!smtpForm.smtp_host.trim()) { setSmtpError('Host SMTP é obrigatório.'); return; }
      const portNum = Number(smtpForm.smtp_port);
      if (!Number.isInteger(portNum) || portNum <= 0 || portNum > 65535) { setSmtpError('Porta SMTP inválida.'); return; }
      if (!smtpForm.smtp_user.trim()) { setSmtpError('Usuário SMTP é obrigatório.'); return; }
      if (!smtpPassword && !hasStored) { setSmtpError('Senha SMTP é obrigatória para ativar o envio.'); return; }
    }

    try {
      setSmtpSaving(true);
      setSmtpError(null);
      const payload: any = {
        smtp_enabled: smtpForm.smtp_enabled,
        smtp_host: smtpForm.smtp_host.trim() || null,
        smtp_port: Number(smtpForm.smtp_port) || null,
        smtp_secure: smtpForm.smtp_secure,
        smtp_user: smtpForm.smtp_user.trim() || null,
        smtp_from_name: smtpForm.smtp_from_name.trim() || null,
      };
      // Só envia a senha se uma NOVA foi digitada (não sobrescreve a existente com vazio).
      if (smtpPassword) payload.password = smtpPassword;

      await api.put(`/companies/${empresaId}/email-channels/${smtpModalChannel.id}/smtp`, payload);
      setSmtpPassword('');
      setFeedback({ type: 'success', message: 'Configuração de envio salva.' });
      await fetchChannels();
      closeSmtpModal();
    } catch (err: any) {
      setSmtpError(err.message || 'Erro ao salvar configuração SMTP.');
    } finally {
      setSmtpSaving(false);
    }
  };

  const handleTestSmtp = async () => {
    if (!smtpModalChannel) return;
    if (!canTest) {
      setSmtpError('Sem permissão para testar o envio deste canal.');
      return;
    }
    try {
      setSmtpTesting(true);
      setSmtpError(null);
      const res = await api.post<{ sentTo?: string }>(
        `/companies/${empresaId}/email-channels/${smtpModalChannel.id}/smtp/test`,
        {}
      );
      setFeedback({ type: 'success', message: `E-mail de teste enviado para ${res?.sentTo || smtpModalChannel.email_publico}.` });
      await fetchChannels();
    } catch (err: any) {
      setSmtpError(err.message || 'Falha no teste de SMTP. Verifique host, porta, usuário e senha.');
    } finally {
      setSmtpTesting(false);
    }
  };

  const fetchChannels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<EmailChannel[]>(`/companies/${empresaId}/email-channels`);
      setChannels(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar canais');
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const openCreateModal = () => {
    if (!canCreate) {
      setFeedback({ type: 'error', message: 'Sem permissão para criar canais de e-mail.' });
      return;
    }
    setNewEmail('');
    setNewNome('');
    setCreateError(null);
    setIsCreating(true);
  };

  const closeCreateModal = () => {
    if (submitting) return;
    setCreateError(null);
    setIsCreating(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) {
      setCreateError('Sem permissão para criar canais de e-mail.');
      return;
    }
    if (!newEmail) return;

    try {
      setSubmitting(true);
      setCreateError(null);

      await api.post<CreateEmailChannelResponse>(`/companies/${empresaId}/email-channels`, {
        email_publico: newEmail.trim(),
        nome: newNome.trim(),
      });

      setNewEmail('');
      setNewNome('');
      setIsCreating(false);
      setFeedback({ type: 'success', message: 'Canal criado com sucesso.' });
      fetchChannels();
    } catch (err: any) {
      setCreateError(err.message || 'Erro ao criar canal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!canDelete) {
      setFeedback({ type: 'error', message: 'Sem permissão para remover canais de e-mail.' });
      return;
    }
    if (!confirm('Remover este canal de e-mail? Nenhum novo chamado será recebido por este endereço técnico.')) return;

    try {
      await api.delete(`/companies/${empresaId}/email-channels/${id}`);
      setFeedback({ type: 'success', message: 'Canal removido com sucesso.' });
      fetchChannels();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao remover canal' });
    }
  };

  const handleRegenerate = async (id: number) => {
    if (!canEdit) {
      setFeedback({ type: 'error', message: 'Sem permissão para regenerar canais de e-mail.' });
      return;
    }
    if (!confirm('Regerar o endereço de encaminhamento? O endereço antigo para de funcionar imediatamente.')) return;

    try {
      await api.post(`/companies/${empresaId}/email-channels/${id}/regenerate`, {});
      setFeedback({ type: 'success', message: 'Endereço de encaminhamento regenerado.' });
      fetchChannels();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao regenerar canal' });
    }
  };

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h4 className="text-sm font-semibold text-slate-800">Canais de E-mail</h4>
          <p className="text-xs text-slate-500 max-w-md">
            Receba chamados por encaminhamento e responda pelo SMTP configurado no sistema.
          </p>
        </div>
        {canCreate && (
          <Button size="sm" onClick={openCreateModal} className="h-8 text-xs shrink-0 bg-blue-600 hover:bg-blue-700">
            <Plus size={14} className="mr-1" /> Adicionar Canal
          </Button>
        )}
      </div>

      {feedback && (
        <Card
          className={cn(
            'p-3 flex items-start gap-2 text-xs',
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
              : 'bg-red-50 border-red-100 text-red-700'
          )}
        >
          {feedback.type === 'success' ? (
            <Check size={14} className="shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
          )}
          <p className="font-medium">{feedback.message}</p>
        </Card>
      )}

      {loading ? (
        <div className="p-8 text-center flex flex-col items-center justify-center">
          <RefreshCw size={20} className="text-blue-500 animate-spin mb-2" />
          <p className="text-xs font-medium text-slate-500">Carregando canais...</p>
        </div>
      ) : error ? (
        <Card className="p-4 bg-red-50 border-red-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle size={16} />
            <p className="text-xs font-medium">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchChannels} className="text-xs h-7 text-red-600 border-red-200">
            Refazer
          </Button>
        </Card>
      ) : channels.length === 0 ? (
        <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-md text-center space-y-3">
          <div className="w-10 h-10 bg-white rounded-full shadow-sm border border-slate-100 flex items-center justify-center mx-auto">
            <Send size={20} className="text-slate-400" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-700">Nenhum canal configurado</p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">Transforme e-mails encaminhados em chamados no Gestifique.</p>
          </div>
          {canCreate && (
            <Button size="sm" onClick={openCreateModal} variant="outline" className="h-8 text-xs">
              Configurar
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {channels.map((channel) => (
            <Card key={channel.id} className="p-0 overflow-hidden border-slate-200 shadow-sm">
              <div className="p-4 border-b border-slate-100 bg-white">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                      <Mail size={16} className="text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-800 break-all">{channel.email_publico}</span>
                        <Badge
                          variant={channel.status === 'ativo' || channel.status === 'verificado' ? 'emerald' : channel.status === 'erro' ? 'red' : 'amber'}
                          className="text-[10px] h-5"
                        >
                          Recebimento: {channel.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {channel.nome && <span className="text-xs font-medium text-slate-500">{channel.nome}</span>}
                        {channel.last_received_at && (
                          <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                            <Clock size={12} className="text-slate-300" /> Recebido {formatRelativeTime(channel.last_received_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {(canEdit || canDelete) && (
                    <div className="flex gap-2 shrink-0">
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRegenerate(channel.id)}
                          title="Regerar endereco inbound"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                        >
                          <RefreshCw size={14} />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(channel.id)}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-slate-50/50 space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                      <ShieldCheck size={12} className="text-blue-500" /> Endereço de encaminhamento
                    </span>
                    <span className="text-[11px] font-medium text-amber-600">Confidencial</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-md border border-slate-200 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-slate-600 truncate select-all">{channel.inbound_address}</p>
                    </div>
                    <Button
                      size="sm"
                      className={cn(
                        'shrink-0 h-7 text-[11px] transition-all',
                        copiedId === channel.id ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
                      )}
                      onClick={() => handleCopy(channel.id, channel.inbound_address)}
                    >
                      {copiedId === channel.id ? <Check size={12} className="mr-1" /> : <Copy size={12} className="mr-1" />}
                      {copiedId === channel.id ? 'Copiado' : 'Copiar'}
                    </Button>
                  </div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-md space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                        <Send size={14} className="text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800">Envio de respostas</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          O cliente recebe as respostas como <strong className="break-all">{channel.email_publico}</strong>.
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold border',
                        getSmtpStatusInfo(channel.smtp_status).cls
                      )}
                    >
                      Envio: {getSmtpStatusInfo(channel.smtp_status).label}
                    </span>
                  </div>

                  {channel.smtp_status === 'error' && channel.smtp_last_error && (
                    <p className="text-[11px] text-red-700 bg-red-50 border border-red-100 rounded p-1.5 flex items-start gap-1.5">
                      <AlertCircle size={12} className="shrink-0 mt-0.5" />
                      <span className="break-words">{channel.smtp_last_error}</span>
                    </p>
                  )}

                  {(canEdit || canTest) && (
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() => openSmtpModal(channel)}
                      >
                        Configurar envio
                      </Button>
                    </div>
                  )}
                </div>

                {channel.ultimo_erro ? (
                  <div className="p-2.5 bg-red-50 border border-red-100 rounded-md text-[11px] text-red-700 flex items-start gap-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-0.5">Erro no recebimento:</p>
                      <p className="font-medium bg-white/70 p-1 rounded border border-red-200">{channel.ultimo_erro}</p>
                    </div>
                  </div>
                ) : channel.status === 'pendente' ? (
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-md space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded bg-white border border-amber-200 flex items-center justify-center shrink-0">
                        <History size={14} className="text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-amber-700">Aguardando primeiro e-mail</p>
                        <p className="text-[11px] text-amber-600/80 mt-0.5">Configure o encaminhamento no seu provedor:</p>
                      </div>
                    </div>
                    <ul className="text-[11px] text-amber-700 space-y-1.5 ml-8 list-decimal">
                      <li>Crie uma regra de encaminhamento automatico para <strong>{channel.email_publico}</strong>.</li>
                      <li>Aponte o destino para o endereco de encaminhamento acima.</li>
                      <li>Envie um e-mail de teste para ativar o recebimento.</li>
                    </ul>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-md text-xs font-medium text-emerald-700">
                    <Check size={14} className="shrink-0" />
                    Recebimento em operação.
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={isCreating} onClose={closeCreateModal} title="Adicionar Canal de E-mail" size="md">
        <form onSubmit={handleCreate} className="space-y-4 p-1">
          {createError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-md flex gap-2 items-start text-red-700">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p className="text-xs font-medium">{createError}</p>
            </div>
          )}

          <div className="p-3 bg-blue-50 border border-blue-100 rounded-md flex gap-2 items-start">
            <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-blue-700">Como funciona?</p>
              <p className="text-[11px] text-blue-600 leading-relaxed">
                Cadastre o e-mail de suporte da empresa e configure uma regra de encaminhamento para o endereco tecnico gerado.
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">E-mail de Suporte *</label>
            <Input
              type="email"
              placeholder="suporte@sua-empresa.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="h-8 text-sm"
              disabled={submitting}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Nome (Opcional)</label>
            <Input
              placeholder="Ex: Suporte Nivel 1"
              value={newNome}
              onChange={(e) => setNewNome(e.target.value)}
              className="h-8 text-sm"
              disabled={submitting}
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button size="sm" type="button" variant="ghost" onClick={closeCreateModal} disabled={submitting}>
              Cancelar
            </Button>
            <Button size="sm" type="submit" loading={submitting}>
              Criar canal
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!smtpModalChannel}
        onClose={closeSmtpModal}
        title="Configurar envio (SMTP do canal)"
        size="md"
      >
        <form onSubmit={handleSaveSmtp} className="space-y-4 p-1">
          {smtpError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-md space-y-1.5 text-red-700">
              <div className="flex gap-2 items-start">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <p className="text-xs font-medium">{smtpError}</p>
              </div>
              <ul className="text-[11px] text-red-600/90 list-disc ml-6 space-y-0.5">
                <li>Confira se o usuário (e-mail) e a senha estão corretos.</li>
                <li>Em Gmail/Yahoo, use uma senha de aplicativo (não a senha normal da conta).</li>
                <li>Porta 587: deixe “SSL/TLS” desmarcado (STARTTLS). Porta 465: marque “SSL/TLS”.</li>
                <li>Verifique se o provedor permite SMTP externo.</li>
                <li>No Microsoft/Outlook, pode ser necessário OAuth/Autenticação Moderna.</li>
              </ul>
            </div>
          )}

          <div className="p-3 bg-blue-50 border border-blue-100 rounded-md flex gap-2 items-start">
            <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-700 leading-relaxed">
              Essa configuração permite que o cliente receba as respostas do chamado como vindas de{' '}
              <strong className="break-all">{smtpModalChannel?.email_publico}</strong>.
            </p>
          </div>

          <div className="flex gap-1 border-b border-slate-200">
            {([
              { key: 'config', label: 'Configuração' },
              { key: 'tutorial', label: 'Tutorial' },
              { key: 'recebimento', label: 'Recebimento' },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSmtpTab(tab.key)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors',
                  smtpTab === tab.key
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {smtpTab === 'config' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Qual provedor de e-mail você usa?</label>
                <select
                  value={smtpProvider}
                  onChange={(e) => applyProvider(e.target.value)}
                  disabled={smtpSaving || !canEdit}
                  className="w-full h-8 text-sm rounded-md border border-slate-200 bg-white px-2 text-slate-700"
                >
                  <option value="">Selecione (preenche host/porta automaticamente)…</option>
                  {SMTP_PROVIDERS.map((p) => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                  ))}
                </select>
                {selectedProvider?.note && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded p-1.5 mt-1">
                    {selectedProvider.note}
                  </p>
                )}
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={smtpForm.smtp_enabled}
                  onChange={(e) => setSmtpForm((f) => ({ ...f, smtp_enabled: e.target.checked }))}
                  disabled={smtpSaving || !canEdit}
                />
                Habilitar envio por este canal
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-slate-700">Host SMTP</label>
                  <Input
                    placeholder="smtp.empresa.com"
                    value={smtpForm.smtp_host}
                    onChange={(e) => setSmtpForm((f) => ({ ...f, smtp_host: e.target.value }))}
                    className="h-8 text-sm"
                    disabled={smtpSaving || !canEdit}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Porta</label>
                  <Input
                    type="number"
                    placeholder="587"
                    value={String(smtpForm.smtp_port ?? '')}
                    onChange={(e) => setSmtpForm((f) => ({ ...f, smtp_port: Number(e.target.value) }))}
                    className="h-8 text-sm"
                    disabled={smtpSaving || !canEdit}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={smtpForm.smtp_secure}
                  onChange={(e) => setSmtpForm((f) => ({ ...f, smtp_secure: e.target.checked }))}
                  disabled={smtpSaving || !canEdit}
                />
                Conexão segura SSL/TLS (porta 465). Deixe desmarcado para STARTTLS (porta 587).
              </label>

              <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded p-2">
                <strong>Porta 587:</strong> usa STARTTLS — deixe “SSL/TLS” desmarcado.{' '}
                <strong>Porta 465:</strong> usa SSL/TLS direto — marque “SSL/TLS”. Se não souber, tente 587 primeiro.
              </p>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Usuário SMTP</label>
                <Input
                  placeholder="suporte@empresa.com"
                  value={smtpForm.smtp_user}
                  onChange={(e) => setSmtpForm((f) => ({ ...f, smtp_user: e.target.value }))}
                  className="h-8 text-sm"
                  disabled={smtpSaving || !canEdit}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Senha SMTP</label>
                <Input
                  type="password"
                  placeholder={channelHasStoredPassword(smtpModalChannel) ? 'Senha já configurada (deixe em branco para manter)' : 'Senha / senha de aplicativo'}
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  className="h-8 text-sm"
                  disabled={smtpSaving || !canEdit}
                  autoComplete="new-password"
                />
                <p className="text-[10px] text-slate-400">A senha é armazenada de forma cifrada e nunca é exibida novamente.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Nome do remetente (opcional)</label>
                <Input
                  placeholder="Ex: Suporte Empresa"
                  value={smtpForm.smtp_from_name}
                  onChange={(e) => setSmtpForm((f) => ({ ...f, smtp_from_name: e.target.value }))}
                  className="h-8 text-sm"
                  disabled={smtpSaving || !canEdit}
                />
              </div>
            </div>
          )}

          {smtpTab === 'tutorial' && (
            <div className="space-y-3">
              <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-md text-[11px] text-amber-700">
                <strong>Senha de aplicativo:</strong> alguns provedores (Gmail, Yahoo) não aceitam a senha normal da
                conta. Gere uma “senha de aplicativo” nas configurações de segurança do provedor e use-a no campo Senha SMTP.
              </div>

              {selectedProvider ? (
                <div className="p-3 bg-white border border-slate-200 rounded-md space-y-2">
                  <p className="text-xs font-semibold text-slate-800">{selectedProvider.label}</p>
                  {selectedProvider.autofill && (
                    <p className="text-[11px] text-slate-500">
                      Sugestão: Host <strong>{selectedProvider.host}</strong> · Porta <strong>{selectedProvider.port}</strong> ·{' '}
                      SSL/TLS <strong>{selectedProvider.secure ? 'marcado' : 'desmarcado'}</strong>.
                    </p>
                  )}
                  <ol className="text-[11px] text-slate-600 space-y-1 ml-4 list-decimal">
                    {selectedProvider.tutorial.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                  {selectedProvider.note && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded p-1.5">
                      {selectedProvider.note}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded p-2">
                  Selecione um provedor na aba <strong>Configuração</strong> para ver o passo a passo específico.
                </p>
              )}

              <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded p-2">
                <strong>Porta 587</strong> usa STARTTLS (SSL/TLS desmarcado). <strong>Porta 465</strong> usa SSL/TLS direto
                (marque SSL/TLS). Na dúvida, comece com 587.
              </p>
            </div>
          )}

          {smtpTab === 'recebimento' && smtpModalChannel && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Para <strong>receber</strong> chamados por e-mail, crie no seu provedor um encaminhamento automático de{' '}
                <strong className="break-all">{smtpModalChannel.email_publico}</strong> para o endereço de entrada abaixo.
                Assim, quando o cliente enviar um e-mail, o Gestifique cria ou atualiza o chamado.
              </p>

              <div className="space-y-1">
                <span className="text-[11px] font-medium text-slate-500">E-mail público</span>
                <div className="bg-white p-2 rounded-md border border-slate-200 text-xs font-mono text-slate-600 break-all select-all">
                  {smtpModalChannel.email_publico}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-medium text-slate-500">Endereço de entrada Gestifique</span>
                <div className="bg-white p-2 rounded-md border border-slate-200 flex items-center justify-between gap-3">
                  <p className="text-xs font-mono text-slate-600 truncate select-all">{smtpModalChannel.inbound_address}</p>
                  <Button
                    type="button"
                    size="sm"
                    className={cn(
                      'shrink-0 h-7 text-[11px] transition-all',
                      copiedId === smtpModalChannel.id ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
                    )}
                    onClick={() => handleCopy(smtpModalChannel.id, smtpModalChannel.inbound_address)}
                  >
                    {copiedId === smtpModalChannel.id ? <Check size={12} className="mr-1" /> : <Copy size={12} className="mr-1" />}
                    {copiedId === smtpModalChannel.id ? 'Copiado' : 'Copiar endereço de entrada'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-between gap-2 border-t border-slate-100">
            {canTest ? (
              <Button
                size="sm"
                type="button"
                variant="outline"
                onClick={handleTestSmtp}
                loading={smtpTesting}
                disabled={smtpSaving || !channelHasStoredPassword(smtpModalChannel)}
                title={!channelHasStoredPassword(smtpModalChannel) ? 'Salve a configuração antes de testar.' : 'Envia um e-mail de teste usando a configuração salva.'}
              >
                <Send size={14} className="mr-1" /> Testar envio
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button size="sm" type="button" variant="ghost" onClick={closeSmtpModal} disabled={smtpSaving || smtpTesting}>
                Cancelar
              </Button>
              {canEdit && (
                <Button size="sm" type="submit" loading={smtpSaving}>
                  Salvar configuração
                </Button>
              )}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
