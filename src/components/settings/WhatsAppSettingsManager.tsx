import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Link2,
  RefreshCw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { User } from "../../types";
import { api } from "../../lib/api";
import { hasPermission } from "../../lib/permissions";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import {
  WhatsappAutoReplyPanel,
  type WhatsAppFlowToolbar,
} from "../whatsapp/WhatsappAutoReplyPanel";

interface WhatsAppStatus {
  enabled: boolean;
  configured: boolean;
  phoneNumberId: string | null;
  businessAccountId: string | null;
  apiVersion: string;
  hasAccessToken: boolean;
  accessTokenPreview: string | null;
  hasAppSecret: boolean;
  verifyToken: string | null;
  callbackUrl: string | null;
  displayPhoneNumber: string | null;
}

const META_CREDENTIALS_ALLOWED_EMAIL = "kaueajure@gmail.com";

const META_CREDENTIALS = [
  {
    env: "ENABLE_WHATSAPP",
    where: "Você define. Coloque true para ligar o módulo no Portal Meta.",
  },
  {
    env: "WHATSAPP_PHONE_NUMBER_ID",
    where:
      "Meta → App → WhatsApp → Configuração da API → Número de telefone → campo Phone number ID.",
  },
  {
    env: "WHATSAPP_BUSINESS_ACCOUNT_ID",
    where:
      "Meta → App → WhatsApp → Configuração da API → WhatsApp Business Account ID.",
  },
  {
    env: "WHATSAPP_ACCESS_TOKEN",
    where:
      "Meta → App → WhatsApp → Configuração da API → token permanente do usuário do sistema.",
  },
  {
    env: "WHATSAPP_VERIFY_TOKEN",
    where:
      "Use o mesmo valor secreto no servidor e em Meta → Webhook → Verificar token.",
  },
  {
    env: "META_APP_SECRET",
    where: "Meta → App → Configurações → Básico → Segredo do app.",
  },
  {
    env: "WHATSAPP_DISPLAY_PHONE_NUMBER",
    where: "Número exibido com DDI, DDD e número, somente com dígitos.",
  },
  {
    env: "FRONTEND_URL",
    where: "URL pública HTTPS usada para montar a callback do webhook.",
  },
] as const;

type WhatsAppSettingsTab = "flow" | "credentials";

export function WhatsAppSettingsManager({ currentUser }: { currentUser: User }) {
  const canManage = hasPermission(currentUser, "integracoes.whatsapp.gerenciar");
  const canViewMetaCredentials =
    String(currentUser.email || "").trim().toLowerCase() ===
    META_CREDENTIALS_ALLOWED_EMAIL;
  const [activeTab, setActiveTab] = useState<WhatsAppSettingsTab>("flow");
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [flowToolbar, setFlowToolbar] = useState<WhatsAppFlowToolbar | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await api.get<WhatsAppStatus>("/whatsapp/status"));
    } catch (err: any) {
      setError(err?.message || "Não foi possível carregar a integração WhatsApp.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (activeTab !== "flow") setFlowToolbar(null);
  }, [activeTab]);

  const copyValue = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), 1600);
    } catch {
      setError("Não foi possível copiar para a área de transferência.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Configuração do WhatsApp</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Fluxo automático, status da integração, webhook e credenciais Meta.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === "flow" && flowToolbar && canManage ? (
            <>
              <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-1.5 text-xs font-medium text-slate-700">
                <Checkbox
                  checked={flowToolbar.enabled}
                  onChange={(event) => flowToolbar.setEnabled(event.target.checked)}
                  label={flowToolbar.enabled ? "Ligado" : "Desligado"}
                />
              </div>
              <Button
                size="sm"
                disabled={flowToolbar.saving}
                onClick={() => flowToolbar.submit()}
              >
                <Save size={14} />
                {flowToolbar.saving ? "Salvando…" : "Salvar fluxo"}
              </Button>
            </>
          ) : null}
          <Button variant="outline" size="sm" onClick={loadStatus} disabled={loading}>
            <RefreshCw size={14} className={cn(loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      {(error || success) && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-800",
          )}
        >
          {error ? <AlertTriangle size={14} className="mt-0.5 shrink-0" /> : <Check size={14} />}
          <span>{error || success}</span>
        </div>
      )}

      <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
        <button
          type="button"
          onClick={() => setActiveTab("flow")}
          className={cn(
            "rounded px-3 py-1.5 text-xs font-semibold transition-colors",
            activeTab === "flow"
              ? "bg-emerald-600 text-white"
              : "text-slate-600 hover:bg-slate-50",
          )}
        >
          Fluxo de atendimento
        </button>
        {canViewMetaCredentials && (
          <button
            type="button"
            onClick={() => setActiveTab("credentials")}
            className={cn(
              "rounded px-3 py-1.5 text-xs font-semibold transition-colors",
              activeTab === "credentials"
                ? "bg-emerald-600 text-white"
                : "text-slate-600 hover:bg-slate-50",
            )}
          >
            Credenciais Meta
          </button>
        )}
      </div>

      {activeTab === "flow" ? (
        <div className="h-[min(640px,calc(100vh-265px))] min-h-[520px] overflow-hidden">
          <WhatsappAutoReplyPanel
            canManage={canManage}
            onError={setError}
            onSuccess={setSuccess}
            onToolbarChange={setFlowToolbar}
          />
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck size={15} className="text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-900">Status da integração</h3>
            </div>
            <dl className="space-y-2 text-xs">
              <StatusRow label="Habilitado" value={status?.enabled ? "Sim" : "Não"} ok={!!status?.enabled} />
              <StatusRow label="Configurado" value={status?.configured ? "Pronto" : "Incompleto"} ok={!!status?.configured} />
              <StatusRow label="Phone Number ID" value={status?.phoneNumberId || "—"} />
              <StatusRow label="WABA ID" value={status?.businessAccountId || "—"} />
              <StatusRow label="Token" value={status?.accessTokenPreview || "Ausente"} ok={!!status?.hasAccessToken} />
              <StatusRow label="App Secret" value={status?.hasAppSecret ? "Configurado" : "Não definido"} ok={!!status?.hasAppSecret} />
            </dl>

            <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
              <div className="flex items-center gap-2">
                <Link2 size={14} className="text-blue-600" />
                <h4 className="text-xs font-semibold text-slate-900">Webhook</h4>
              </div>
              <CopyField
                label="URL de callback"
                value={status?.callbackUrl || "https://portalmeta.com.br/api/whatsapp/webhook"}
                fieldKey="callback"
                copiedField={copiedField}
                onCopy={copyValue}
              />
              <CopyField
                label="Token de verificação"
                value={status?.verifyToken || "—"}
                fieldKey="verify"
                copiedField={copiedField}
                onCopy={copyValue}
              />
              <a
                href="https://developers.facebook.com/apps/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline"
              >
                Meta for Developers <ExternalLink size={11} />
              </a>
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Variáveis protegidas</h3>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Configure os valores no ambiente do servidor e reinicie a aplicação.
              </p>
            </div>
            <ul className="divide-y divide-slate-100">
              {META_CREDENTIALS.map((item) => (
                <li key={item.env} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[210px_1fr] sm:gap-3">
                  <code className="text-[10px] font-semibold text-emerald-700">{item.env}</code>
                  <p className="text-[11px] leading-snug text-slate-600">{item.where}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd
        className={cn(
          "truncate text-right font-medium",
          ok === true && "text-emerald-700",
          ok === false && "text-amber-700",
          ok === undefined && "text-slate-900",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function CopyField({
  label,
  value,
  fieldKey,
  copiedField,
  onCopy,
}: {
  label: string;
  value: string;
  fieldKey: string;
  copiedField: string | null;
  onCopy: (field: string, value: string) => void;
}) {
  const copied = copiedField === fieldKey;
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold text-slate-700">{label}</label>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] text-slate-800">
          {value}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2"
          onClick={() => onCopy(fieldKey, value)}
          disabled={!value || value === "—"}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </Button>
      </div>
    </div>
  );
}
