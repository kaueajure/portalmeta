import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Save, MessageSquareText, Smartphone } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";

export type WhatsAppBotButton = { id: string; title: string };

export type WhatsAppBotSettings = {
  autoReplyEnabled: boolean;
  autoReplyTrigger: string;
  welcomeHeader: string;
  welcomeBody: string;
  buttons: WhatsAppBotButton[];
  updatedAt: string | null;
};

type Props = {
  canManage: boolean;
  onError: (message: string | null) => void;
  onSuccess: (message: string | null) => void;
};

const emptyButton = (): WhatsAppBotButton => ({ id: "", title: "" });

function slugFromTitle(title: string) {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
}

export function WhatsappAutoReplyPanel({ canManage, onError, onSuccess }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<WhatsAppBotSettings>({
    autoReplyEnabled: false,
    autoReplyTrigger: "teste",
    welcomeHeader: "",
    welcomeBody: "",
    buttons: [emptyButton()],
    updatedAt: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.get<WhatsAppBotSettings>("/whatsapp/settings");
        if (cancelled) return;
        setForm({
          ...data,
          buttons: data.buttons?.length ? data.buttons : [emptyButton()],
        });
      } catch (err: any) {
        if (!cancelled) onError(err?.message || "Não foi possível carregar as mensagens automáticas.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Carrega uma vez ao montar o painel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previewButtons = useMemo(
    () => form.buttons.filter((b) => b.title.trim()).slice(0, 3),
    [form.buttons],
  );

  const updateButton = (index: number, patch: Partial<WhatsAppBotButton>) => {
    setForm((prev) => {
      const buttons = prev.buttons.map((b, i) => {
        if (i !== index) return b;
        const next = { ...b, ...patch };
        if (patch.title !== undefined && !b.id.trim()) {
          next.id = slugFromTitle(patch.title) || next.id;
        }
        return next;
      });
      return { ...prev, buttons };
    });
  };

  const addButton = () => {
    setForm((prev) => {
      if (prev.buttons.length >= 3) return prev;
      return { ...prev, buttons: [...prev.buttons, emptyButton()] };
    });
  };

  const removeButton = (index: number) => {
    setForm((prev) => {
      const buttons = prev.buttons.filter((_, i) => i !== index);
      return { ...prev, buttons: buttons.length ? buttons : [emptyButton()] };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    onError(null);
    onSuccess(null);
    try {
      const payload = {
        autoReplyEnabled: form.autoReplyEnabled,
        autoReplyTrigger: form.autoReplyTrigger.trim(),
        welcomeHeader: form.welcomeHeader.trim(),
        welcomeBody: form.welcomeBody.trim(),
        buttons: form.buttons
          .map((b) => ({
            id: (b.id.trim() || slugFromTitle(b.title)).slice(0, 256),
            title: b.title.trim().slice(0, 20),
          }))
          .filter((b) => b.id && b.title)
          .slice(0, 3),
      };
      const saved = await api.put<WhatsAppBotSettings>("/whatsapp/settings", payload);
      setForm({
        ...saved,
        buttons: saved.buttons?.length ? saved.buttons : [emptyButton()],
      });
      onSuccess("Mensagens automáticas salvas.");
    } catch (err: any) {
      onError(err?.message || "Falha ao salvar mensagens automáticas.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
        Carregando mensagens automáticas…
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquareText size={16} className="text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-900">Menu de boas-vindas</h3>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Quando o cliente enviar exatamente a palavra-gatilho, o Gestifique responde com este menu
              interativo (até 3 botões — limite da API da Meta).
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-emerald-600"
              checked={form.autoReplyEnabled}
              disabled={!canManage}
              onChange={(e) => setForm((p) => ({ ...p, autoReplyEnabled: e.target.checked }))}
            />
            Auto-reply {form.autoReplyEnabled ? "ligado" : "desligado"}
          </label>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Palavra-gatilho</label>
            <Input
              value={form.autoReplyTrigger}
              disabled={!canManage}
              onChange={(e) => setForm((p) => ({ ...p, autoReplyTrigger: e.target.value }))}
              placeholder="ex.: teste"
              maxLength={80}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Comparação sem maiúsculas/minúsculas. Só dispara em mensagem de texto pura.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Cabeçalho <span className="font-normal text-slate-400">(máx. 60)</span>
            </label>
            <Input
              value={form.welcomeHeader}
              disabled={!canManage}
              onChange={(e) => setForm((p) => ({ ...p, welcomeHeader: e.target.value.slice(0, 60) }))}
              maxLength={60}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Corpo da mensagem</label>
            <textarea
              value={form.welcomeBody}
              disabled={!canManage}
              onChange={(e) => setForm((p) => ({ ...p, welcomeBody: e.target.value }))}
              rows={4}
              className="w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-emerald-500/30 focus:ring-2 disabled:bg-slate-50"
              placeholder="Texto que o cliente vê acima dos botões"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-700">
                Botões de resposta <span className="font-normal text-slate-400">(1–3)</span>
              </label>
              {canManage && (
                <Button type="button" variant="outline" size="sm" onClick={addButton} disabled={form.buttons.length >= 3}>
                  <Plus size={14} />
                  Botão
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {form.buttons.map((button, index) => (
                <div
                  key={index}
                  className="grid gap-2 rounded-md border border-slate-100 bg-slate-50/70 p-3 sm:grid-cols-[1fr_1.4fr_auto]"
                >
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-500">ID interno</label>
                    <Input
                      value={button.id}
                      disabled={!canManage}
                      onChange={(e) => updateButton(index, { id: e.target.value })}
                      placeholder="ex.: pgp"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-500">
                      Título no WhatsApp <span className="text-slate-400">({button.title.length}/20)</span>
                    </label>
                    <Input
                      value={button.title}
                      disabled={!canManage}
                      onChange={(e) => updateButton(index, { title: e.target.value.slice(0, 20) })}
                      placeholder="ex.: Gestão Pública"
                      maxLength={20}
                    />
                  </div>
                  {canManage && (
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeButton(index)}
                        disabled={form.buttons.length <= 1}
                        className="text-red-600"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {canManage && (
            <div className="flex justify-end pt-1">
              <Button type="submit" size="sm" disabled={saving}>
                <Save size={14} />
                {saving ? "Salvando…" : "Salvar mensagens"}
              </Button>
            </div>
          )}
        </div>
      </section>

      <WhatsAppMessagePreview
        trigger={form.autoReplyTrigger.trim() || "teste"}
        header={form.welcomeHeader.trim()}
        body={form.welcomeBody.trim()}
        buttons={previewButtons}
        enabled={form.autoReplyEnabled}
      />
    </form>
  );
}

function WhatsAppMessagePreview({
  trigger,
  header,
  body,
  buttons,
  enabled,
}: {
  trigger: string;
  header: string;
  body: string;
  buttons: WhatsAppBotButton[];
  enabled: boolean;
}) {
  const now = useMemo(
    () =>
      new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  );

  return (
    <aside className="overflow-hidden rounded-xl border border-slate-800/20 bg-[#0b141a] shadow-lg shadow-slate-900/10">
      <div className="flex items-center gap-2 border-b border-white/5 bg-[#1f2c34] px-3 py-2.5">
        <Smartphone size={14} className="text-[#25d366]" />
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-white">Prévia real · WhatsApp</p>
          <p className="truncate text-[10px] text-slate-400">
            {enabled ? "Auto-reply ativo" : "Auto-reply desligado (preview ainda atualiza)"}
          </p>
        </div>
      </div>

      <div
        className="relative min-h-[420px] space-y-3 px-3 py-4"
        style={{
          backgroundColor: "#0b141a",
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(37,211,102,0.06) 0, transparent 40%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.03) 0, transparent 35%)",
        }}
      >
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-lg rounded-tr-sm bg-[#005c4b] px-2.5 py-1.5 shadow-sm">
            <p className="whitespace-pre-wrap text-[13px] leading-snug text-[#e9edef]">{trigger}</p>
            <p className="mt-0.5 text-right text-[10px] text-[#aebac1]">{now}</p>
          </div>
        </div>

        <div className="flex justify-start">
          <div className="w-full max-w-[92%] overflow-hidden rounded-lg rounded-tl-sm bg-[#202c33] shadow-sm">
            {(header || body) && (
              <div className="px-3 py-2.5">
                {header ? (
                  <p className="mb-1 text-[13px] font-semibold leading-snug text-[#e9edef]">{header}</p>
                ) : null}
                {body ? (
                  <p className="whitespace-pre-wrap text-[13px] leading-snug text-[#e9edef]">{body}</p>
                ) : (
                  <p className="text-[12px] italic text-slate-500">Corpo da mensagem…</p>
                )}
                <p className="mt-1 text-right text-[10px] text-[#8696a0]">{now}</p>
              </div>
            )}

            <div className={cn("border-t border-white/5", buttons.length === 0 && "hidden")}>
              {buttons.map((button, i) => (
                <button
                  key={`${button.id}-${i}`}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-center px-3 py-2.5 text-[13px] font-medium text-[#53bdeb]",
                    i > 0 && "border-t border-white/5",
                  )}
                >
                  {button.title}
                </button>
              ))}
            </div>
            {buttons.length === 0 && (
              <div className="border-t border-white/5 px-3 py-3 text-center text-[11px] text-slate-500">
                Adicione botões para ver as respostas rápidas
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
