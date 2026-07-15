import React, { useEffect, useMemo, useState } from "react";
import {
  X,
  Loader2,
  Search,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../../lib/api";
import { AccessProfile } from "../../types";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";

interface PermissionCatalogItem {
  key: string;
  modulo: string;
  grupo: string;
  nome: string;
  descricao: string | null;
  nivel_risk: "baixo" | "medio" | "alto" | "critico";
}

interface ProfileMatrix {
  profile: AccessProfile;
  permissions: string[];
  catalog: PermissionCatalogItem[];
}

interface AccessProfilePermissionsModalProps {
  profileId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const AccessProfilePermissionsModal = ({
  profileId,
  isOpen,
  onClose,
  onSaved,
}: AccessProfilePermissionsModalProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [matrix, setMatrix] = useState<ProfileMatrix | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initialSelected, setInitialSelected] = useState<Set<string>>(
    new Set(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [activeModule, setActiveModule] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchMatrix = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<ProfileMatrix>(
        `/access-profiles/${profileId}/matrix`,
      );
      setMatrix(data);
      const next = new Set(data.permissions);
      setSelected(next);
      setInitialSelected(new Set(next));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar permissões.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && profileId) {
      setSearchQuery("");
      setActiveModule("all");
      setSuccess(null);
      fetchMatrix();
    }
  }, [isOpen, profileId]);

  const modules = useMemo(() => {
    if (!matrix) return [];
    return Array.from(new Set(matrix.catalog.map((item) => item.modulo))).sort();
  }, [matrix]);

  const moduleCounts = useMemo(() => {
    const counts: Record<string, { total: number; selected: number }> = {};
    if (!matrix) return counts;
    for (const item of matrix.catalog) {
      if (!counts[item.modulo]) counts[item.modulo] = { total: 0, selected: 0 };
      counts[item.modulo].total += 1;
      if (selected.has(item.key)) counts[item.modulo].selected += 1;
    }
    return counts;
  }, [matrix, selected]);

  const filteredCatalog = useMemo(() => {
    if (!matrix) return [];
    return matrix.catalog.filter((item) => {
      if (activeModule !== "all" && item.modulo !== activeModule) return false;
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        item.nome.toLowerCase().includes(query) ||
        item.key.toLowerCase().includes(query) ||
        (item.descricao || "").toLowerCase().includes(query) ||
        item.grupo.toLowerCase().includes(query)
      );
    });
  }, [matrix, activeModule, searchQuery]);

  const grouped = useMemo(() => {
    const groups: Record<string, Record<string, PermissionCatalogItem[]>> = {};
    filteredCatalog.forEach((item) => {
      if (!groups[item.modulo]) groups[item.modulo] = {};
      if (!groups[item.modulo][item.grupo]) {
        groups[item.modulo][item.grupo] = [];
      }
      groups[item.modulo][item.grupo].push(item);
    });
    return groups;
  }, [filteredCatalog]);

  const isDirty = useMemo(() => {
    if (selected.size !== initialSelected.size) return true;
    for (const key of selected) {
      if (!initialSelected.has(key)) return true;
    }
    return false;
  }, [selected, initialSelected]);

  const togglePermission = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSuccess(null);
  };

  const toggleGroup = (keys: string[], enable: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      keys.forEach((key) => {
        if (enable) next.add(key);
        else next.delete(key);
      });
      return next;
    });
    setSuccess(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.patch(`/access-profiles/${profileId}`, {
        permissions: Array.from(selected),
      });
      setInitialSelected(new Set(selected));
      setSuccess("Permissões salvas. Todos os usuários deste perfil foram atualizados.");
      onSaved?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao salvar permissões.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            className="relative flex h-[min(88vh,820px)] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
          >
            <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-[15px] font-semibold text-slate-950">
                    Permissões
                    {matrix?.profile.nome ? ` · ${matrix.profile.nome}` : ""}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Marque o que este perfil pode fazer. A mudança vale para
                    todos os usuários vinculados.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              </div>
            ) : (
              <>
                <div className="shrink-0 space-y-3 border-b border-slate-100 px-4 py-3 sm:px-5">
                  <div className="relative">
                    <Search
                      size={14}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar permissão..."
                      className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-medium text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar">
                    <button
                      type="button"
                      onClick={() => setActiveModule("all")}
                      className={cn(
                        "h-7 shrink-0 rounded-md px-2.5 text-[11px] font-medium transition-colors",
                        activeModule === "all"
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900",
                      )}
                    >
                      Todos ({selected.size})
                    </button>
                    {modules.map((mod) => {
                      const count = moduleCounts[mod];
                      return (
                        <button
                          key={mod}
                          type="button"
                          onClick={() => setActiveModule(mod)}
                          className={cn(
                            "h-7 shrink-0 rounded-md px-2.5 text-[11px] font-medium transition-colors",
                            activeModule === mod
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900",
                          )}
                        >
                          {mod}
                          {count ? (
                            <span className="ml-1 opacity-70">
                              {count.selected}/{count.total}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5 custom-scrollbar">
                  {error && (
                    <div className="mb-3 flex items-start gap-2 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="mb-3 flex items-start gap-2 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                      {success}
                    </div>
                  )}

                  {Object.keys(grouped).length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-500">
                      Nenhuma permissão encontrada.
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {Object.entries(grouped).map(([modulo, grupos]) => (
                        <section key={modulo}>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <h4 className="text-xs font-semibold text-slate-900">
                              {modulo}
                            </h4>
                            <button
                              type="button"
                              onClick={() => {
                                const keys = Object.values(grupos)
                                  .flat()
                                  .map((i) => i.key);
                                const allOn = keys.every((k) =>
                                  selected.has(k),
                                );
                                toggleGroup(keys, !allOn);
                              }}
                              className="text-[11px] font-medium text-blue-600 hover:text-blue-700"
                            >
                              {Object.values(grupos)
                                .flat()
                                .every((i) => selected.has(i.key))
                                ? "Desmarcar módulo"
                                : "Marcar módulo"}
                            </button>
                          </div>

                          <div className="overflow-hidden rounded-md border border-slate-200">
                            {Object.entries(grupos).map(
                              ([grupo, items], groupIndex) => (
                                <div key={grupo}>
                                  <div
                                    className={cn(
                                      "flex items-center justify-between gap-2 bg-slate-50 px-3 py-1.5",
                                      groupIndex > 0 &&
                                        "border-t border-slate-200",
                                    )}
                                  >
                                    <span className="text-[11px] font-medium text-slate-500">
                                      {grupo}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const keys = items.map((i) => i.key);
                                        const allOn = keys.every((k) =>
                                          selected.has(k),
                                        );
                                        toggleGroup(keys, !allOn);
                                      }}
                                      className="text-[10px] font-medium text-slate-500 hover:text-slate-800"
                                    >
                                      {items.every((i) => selected.has(i.key))
                                        ? "Desmarcar"
                                        : "Marcar grupo"}
                                    </button>
                                  </div>

                                  <ul className="divide-y divide-slate-100">
                                    {items.map((item) => {
                                      const isAllowed = selected.has(item.key);
                                      return (
                                        <li key={item.key}>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              togglePermission(item.key)
                                            }
                                            className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                                          >
                                            <span
                                              className={cn(
                                                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                                isAllowed
                                                  ? "border-blue-600 bg-blue-600 text-white"
                                                  : "border-slate-300 bg-white",
                                              )}
                                              aria-hidden
                                            >
                                              {isAllowed && (
                                                <svg
                                                  viewBox="0 0 12 12"
                                                  className="h-2.5 w-2.5"
                                                  fill="none"
                                                  stroke="currentColor"
                                                  strokeWidth="2"
                                                >
                                                  <path d="M2.5 6.5 L5 9 L9.5 3.5" />
                                                </svg>
                                              )}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                              <span className="block text-[13px] font-medium text-slate-800">
                                                {item.nome}
                                              </span>
                                              {item.descricao ? (
                                                <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                                                  {item.descricao}
                                                </span>
                                              ) : null}
                                            </span>
                                          </button>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              ),
                            )}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="flex shrink-0 flex-col-reverse items-stretch justify-between gap-2 border-t border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
              <span className="text-xs text-slate-500">
                {selected.size} ativas
                {isDirty ? " · alterações não salvas" : ""}
              </span>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  loading={saving}
                  onClick={handleSave}
                  disabled={!isDirty}
                >
                  Salvar
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
