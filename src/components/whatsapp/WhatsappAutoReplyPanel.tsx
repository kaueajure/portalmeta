import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Smartphone, List, LayoutGrid } from "lucide-react";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";
import { Select } from "../ui/Select";
import { useTicketOptions } from "../../hooks/useTicketOptions";

export type WhatsAppMenuType = "buttons" | "list";

export type WhatsAppBotButton = { id: string; title: string; description?: string };

export type WhatsAppBotSettings = {
  autoReplyEnabled: boolean;
  menuType: WhatsAppMenuType;
  welcomeHeader: string;
  welcomeBody: string;
  buttons: WhatsAppBotButton[];
  listButtonText: string;
  listSectionTitle: string;
  inactivityMinutes: number;
  closingMessage: string;
  updatedAt: string | null;
};

type Props = {
  canManage: boolean;
  companyId?: number | null;
  onError: (message: string | null) => void;
  onSuccess: (message: string | null) => void;
  onToolbarChange?: (toolbar: WhatsAppFlowToolbar | null) => void;
};

export type WhatsAppFlowToolbar = {
  enabled: boolean;
  saving: boolean;
  setEnabled: (enabled: boolean) => void;
  submit: () => void;
};

const emptyOption = (): WhatsAppBotButton => ({ id: "", title: "", description: "" });

const DEFAULT_CLOSING =
  "Como não recebemos uma resposta nos últimos 60 minutos, este atendimento será encerrado automaticamente. Quando precisar, envie uma nova mensagem para iniciar um novo atendimento.";

const fieldClass =
  "w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 disabled:bg-slate-50";

function normalizeSigla(value: string) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .slice(0, 6);
}

export function WhatsappAutoReplyPanel({
  canManage,
  companyId,
  onError,
  onSuccess,
  onToolbarChange,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<WhatsAppBotSettings>({
    autoReplyEnabled: true,
    menuType: "buttons",
    welcomeHeader: "",
    welcomeBody: "",
    buttons: [emptyOption()],
    listButtonText: "Ver opções",
    listSectionTitle: "Atendimento",
    inactivityMinutes: 60,
    closingMessage: DEFAULT_CLOSING,
    updatedAt: null,
  });

  const { activeCategories, loading: loadingServices } = useTicketOptions(companyId || undefined, {
    scope: companyId ? "company" : "current-user",
  });

  const availableServices = useMemo(
    () =>
      activeCategories.filter((item) => {
        const sigla = normalizeSigla(String(item.sigla || ""));
        return Boolean(sigla);
      }),
    [activeCategories],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.get<WhatsAppBotSettings>("/whatsapp/settings");
        if (cancelled) return;
        setForm({
          ...data,
          menuType: data.menuType === "list" ? "list" : "buttons",
          listButtonText: data.listButtonText || "Ver opções",
          listSectionTitle: data.listSectionTitle || "Atendimento",
          inactivityMinutes: data.inactivityMinutes || 60,
          closingMessage: data.closingMessage || DEFAULT_CLOSING,
          buttons: data.buttons?.length
            ? data.buttons.map((b) => ({
                ...b,
                id: normalizeSigla(b.id),
                description: b.description || "",
              }))
            : [emptyOption()],
        });
      } catch (err: any) {
        if (!cancelled) onError(err?.message || "Não foi possível carregar o fluxo de atendimento.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!onToolbarChange || loading) return;
    onToolbarChange({
      enabled: form.autoReplyEnabled,
      saving,
      setEnabled: (enabled) => setForm((p) => ({ ...p, autoReplyEnabled: enabled })),
      submit: () => formRef.current?.requestSubmit(),
    });
  }, [form.autoReplyEnabled, saving, loading, onToolbarChange]);

  useEffect(() => {
    return () => onToolbarChange?.(null);
  }, [onToolbarChange]);

  const maxOptions = form.menuType === "list" ? 10 : 3;
  const titleMax = form.menuType === "list" ? 24 : 20;

  const previewOptions = useMemo(
    () => form.buttons.filter((b) => b.title.trim()).slice(0, maxOptions),
    [form.buttons, maxOptions],
  );

  const setMenuType = (menuType: WhatsAppMenuType) => {
    setForm((prev) => ({
      ...prev,
      menuType,
      buttons: prev.buttons.slice(0, menuType === "list" ? 10 : 3),
    }));
  };

  const updateOption = (index: number, patch: Partial<WhatsAppBotButton>) => {
    setForm((prev) => {
      const buttons = prev.buttons.map((b, i) => (i === index ? { ...b, ...patch } : b));
      return { ...prev, buttons };
    });
  };

  const selectService = (index: number, sigla: string) => {
    const normalized = normalizeSigla(sigla);
    const service = availableServices.find(
      (item) => normalizeSigla(String(item.sigla || "")) === normalized,
    );
    if (!service) {
      updateOption(index, { id: "", title: "" });
      return;
    }
    updateOption(index, {
      id: normalized,
      title: String(service.nome || "").trim().slice(0, titleMax),
    });
  };

  const addOption = () => {
    setForm((prev) => {
      if (prev.buttons.length >= maxOptions) return prev;
      return { ...prev, buttons: [...prev.buttons, emptyOption()] };
    });
  };

  const removeOption = (index: number) => {
    setForm((prev) => {
      const buttons = prev.buttons.filter((_, i) => i !== index);
      return { ...prev, buttons: buttons.length ? buttons : [emptyOption()] };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    onError(null);
    onSuccess(null);
    try {
      const selected = form.buttons
        .map((b) => ({
          id: normalizeSigla(b.id),
          title: b.title.trim().slice(0, titleMax),
          description: (b.description || "").trim().slice(0, 72),
        }))
        .filter((b) => b.id && b.title)
        .slice(0, maxOptions);

      if (selected.length === 0) {
        throw new Error("Selecione ao menos um serviço com sigla.");
      }

      const invalid = selected.find(
        (b) => !availableServices.some((s) => normalizeSigla(String(s.sigla || "")) === b.id),
      );
      if (invalid && availableServices.length > 0) {
        throw new Error(`Serviço inválido ou sem sigla: ${invalid.id}`);
      }

      const payload = {
        autoReplyEnabled: form.autoReplyEnabled,
        menuType: form.menuType,
        welcomeHeader: form.welcomeHeader.trim(),
        welcomeBody: form.welcomeBody.trim(),
        inactivityMinutes: Number(form.inactivityMinutes) || 60,
        closingMessage: form.closingMessage.trim(),
        listButtonText: form.listButtonText.trim(),
        listSectionTitle: form.listSectionTitle.trim(),
        buttons: selected,
      };
      const saved = await api.put<WhatsAppBotSettings>("/whatsapp/settings", payload);
      setForm({
        ...saved,
        buttons: saved.buttons?.length
          ? saved.buttons.map((b) => ({
              ...b,
              id: normalizeSigla(b.id),
              description: b.description || "",
            }))
          : [emptyOption()],
      });
      onSuccess("Fluxo de atendimento salvo.");
    } catch (err: any) {
      onError(err?.message || "Falha ao salvar o fluxo de atendimento.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Carregando fluxo…
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSave}
      className="grid h-full min-h-0 items-start gap-3 overflow-hidden lg:grid-cols-[minmax(0,1.15fr)_320px]"
    >
      <section className="min-h-0 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div>
          <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">Tipo do menu</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!canManage}
              onClick={() => setMenuType("buttons")}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12px] transition",
                form.menuType === "buttons"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
              )}
            >
              <LayoutGrid size={15} className="shrink-0" />
              <span>
                <span className="block font-semibold">Botões</span>
                <span className="text-[10px] text-slate-500">Até 3 opções na bolha</span>
              </span>
            </button>
            <button
              type="button"
              disabled={!canManage}
              onClick={() => setMenuType("list")}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12px] transition",
                form.menuType === "list"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
              )}
            >
              <List size={15} className="shrink-0" />
              <span>
                <span className="block font-semibold">Lista</span>
                <span className="text-[10px] text-slate-500">Até 10 opções no menu</span>
              </span>
            </button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_100px]">
          <Labeled label="Cabeçalho">
            <input
              className={fieldClass}
              value={form.welcomeHeader}
              disabled={!canManage}
              onChange={(e) => setForm((p) => ({ ...p, welcomeHeader: e.target.value.slice(0, 60) }))}
              maxLength={60}
            />
          </Labeled>
          <Labeled label="Inativ. (min)">
            <input
              type="number"
              min={1}
              max={1440}
              className={fieldClass}
              value={form.inactivityMinutes}
              disabled={!canManage}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  inactivityMinutes: Math.max(1, Math.min(1440, Number(e.target.value) || 1)),
                }))
              }
            />
          </Labeled>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Labeled label="Mensagem inicial">
            <textarea
              rows={2}
              value={form.welcomeBody}
              disabled={!canManage}
              onChange={(e) => setForm((p) => ({ ...p, welcomeBody: e.target.value }))}
              className={cn(fieldClass, "resize-none leading-snug")}
            />
          </Labeled>
          <Labeled label="Mensagem de encerramento">
            <textarea
              rows={2}
              value={form.closingMessage}
              disabled={!canManage}
              onChange={(e) => setForm((p) => ({ ...p, closingMessage: e.target.value }))}
              className={cn(fieldClass, "resize-none leading-snug")}
            />
          </Labeled>
        </div>

        {form.menuType === "list" && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Labeled label="Texto do botão da lista (máx. 20)">
              <input
                className={fieldClass}
                value={form.listButtonText}
                disabled={!canManage}
                onChange={(e) => setForm((p) => ({ ...p, listButtonText: e.target.value.slice(0, 20) }))}
                maxLength={20}
                placeholder="Ver opções"
              />
            </Labeled>
            <Labeled label="Título da seção (máx. 24)">
              <input
                className={fieldClass}
                value={form.listSectionTitle}
                disabled={!canManage}
                onChange={(e) => setForm((p) => ({ ...p, listSectionTitle: e.target.value.slice(0, 24) }))}
                maxLength={24}
                placeholder="Atendimento"
              />
            </Labeled>
          </div>
        )}

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600">
              {form.menuType === "list" ? `Itens da lista (1–${maxOptions})` : `Botões (1–${maxOptions})`}
            </span>
            {canManage && (
              <button
                type="button"
                onClick={addOption}
                disabled={form.buttons.length >= maxOptions || availableServices.length === 0}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 disabled:opacity-40"
              >
                <Plus size={13} />
                Opção
              </button>
            )}
          </div>

          {!loadingServices && availableServices.length === 0 ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              Nenhuma categoria com sigla ativa. Cadastre siglas em Configurações → Categorias de chamado.
            </p>
          ) : null}

          <div className="space-y-1.5">
            {form.buttons.map((option, index) => {
              const selectedSigla = normalizeSigla(option.id);
              const usedSiglas = new Set(
                form.buttons
                  .map((b, i) => (i === index ? "" : normalizeSigla(b.id)))
                  .filter(Boolean),
              );
              const selectOptions = availableServices
                .map((service) => {
                  const sigla = normalizeSigla(String(service.sigla || ""));
                  return {
                    value: sigla,
                    label: `${sigla} — ${service.nome}`,
                    disabled: usedSiglas.has(sigla) && sigla !== selectedSigla,
                  };
                })
                .filter((item) => item.value);

              return (
                <div key={index} className="space-y-1 rounded-md bg-slate-50 px-1.5 py-1.5">
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_32px] items-center gap-1.5">
                    <Select
                      size="sm"
                      value={selectedSigla || ""}
                      disabled={!canManage || loadingServices}
                      placeholder="Selecionar serviço"
                      onChange={(value) => selectService(index, value)}
                      options={selectOptions}
                    />
                    <input
                      className={fieldClass}
                      value={option.title}
                      disabled={!canManage || !selectedSigla}
                      onChange={(e) => updateOption(index, { title: e.target.value.slice(0, titleMax) })}
                      placeholder={`Título no WhatsApp (máx. ${titleMax})`}
                      maxLength={titleMax}
                    />
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        disabled={form.buttons.length <= 1}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 hover:bg-red-50 disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                  {form.menuType === "list" && (
                    <input
                      className={fieldClass}
                      value={option.description || ""}
                      disabled={!canManage || !selectedSigla}
                      onChange={(e) => updateOption(index, { description: e.target.value.slice(0, 72) })}
                      placeholder="Descrição opcional (máx. 72)"
                      maxLength={72}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <WhatsAppFlowPreview
        menuType={form.menuType}
        header={form.welcomeHeader.trim()}
        body={form.welcomeBody.trim()}
        options={previewOptions}
        listButtonText={form.listButtonText.trim() || "Ver opções"}
        listSectionTitle={form.listSectionTitle.trim() || "Atendimento"}
        closingMessage={form.closingMessage.trim() || DEFAULT_CLOSING}
        inactivityMinutes={form.inactivityMinutes}
        enabled={form.autoReplyEnabled}
      />
    </form>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function WhatsAppFlowPreview({
  menuType,
  header,
  body,
  options,
  listButtonText,
  listSectionTitle,
  closingMessage,
  inactivityMinutes,
  enabled,
}: {
  menuType: WhatsAppMenuType;
  header: string;
  body: string;
  options: WhatsAppBotButton[];
  listButtonText: string;
  listSectionTitle: string;
  closingMessage: string;
  inactivityMinutes: number;
  enabled: boolean;
}) {
  return (
    <aside className="overflow-hidden rounded-xl border border-[#1a2a32] bg-[#0b141a] shadow-sm">
      <div className="flex items-center gap-2 border-b border-white/5 bg-[#1f2c34] px-3 py-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#25d366]/15">
          <Smartphone size={12} className="text-[#25d366]" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white">Prévia do fluxo</p>
          <p className="text-[10px] text-slate-400">
            {enabled
              ? `${menuType === "list" ? "Lista" : "Botões"} · ${inactivityMinutes} min`
              : "Fluxo desligado"}
          </p>
        </div>
      </div>

      <div className="space-y-2 px-2.5 py-2.5">
        <CompactStep label="Cliente inicia">
          <Bubble mine>Olá, preciso de ajuda</Bubble>
        </CompactStep>

        <CompactStep label="Menu automático">
          <Bubble>
            {header ? <p className="mb-0.5 text-[11px] font-semibold leading-tight">{header}</p> : null}
            <p className="text-[11px] leading-snug text-[#e9edef]">
              {body || "Mensagem inicial..."}
            </p>
            {menuType === "buttons" ? (
              options.length > 0 && (
                <div className="-mx-2 mt-1.5 border-t border-white/10">
                  {options.map((option, i) => (
                    <div
                      key={`${option.id}-${i}`}
                      className={cn(
                        "px-2 py-1.5 text-center text-[11px] font-medium text-[#53bdeb]",
                        i > 0 && "border-t border-white/10",
                      )}
                    >
                      {option.title}
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="-mx-2 mt-1.5 border-t border-white/10 px-2 py-1.5">
                <div className="rounded-md border border-[#53bdeb]/40 px-2 py-1.5 text-center text-[11px] font-medium text-[#53bdeb]">
                  {listButtonText}
                </div>
                <p className="mt-1 text-center text-[9px] text-slate-500">
                  Abre: {listSectionTitle} ({options.length} itens)
                </p>
              </div>
            )}
          </Bubble>
        </CompactStep>

        <CompactStep label="Escolhe opção">
          <Bubble mine>{options[0]?.title || "Opção"}</Bubble>
        </CompactStep>

        <CompactStep label="Empresa responde">
          <Bubble>Certo! Em que posso ajudar?</Bubble>
        </CompactStep>

        <CompactStep label={`Encerra (${inactivityMinutes} min)`}>
          <Bubble>
            <p className="line-clamp-2 text-[11px] leading-snug">{closingMessage}</p>
          </Bubble>
        </CompactStep>
      </div>
    </aside>
  );
}

function CompactStep({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-center text-[9px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      {children}
    </div>
  );
}

function Bubble({
  children,
  mine,
}: {
  children: React.ReactNode;
  mine?: boolean;
}) {
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[95%] rounded-lg px-2 py-1.5 text-[#e9edef] shadow-sm",
          mine ? "rounded-tr-sm bg-[#005c4b]" : "rounded-tl-sm bg-[#202c33]",
        )}
      >
        {children}
      </div>
    </div>
  );
}
