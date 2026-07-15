import React, { useEffect, useState } from "react";
import {
  Shield,
  Edit2,
  Trash2,
  Users,
  Loader2,
  Lock,
} from "lucide-react";
import { api } from "../../lib/api";
import { AccessProfile, User } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { Badge } from "../ui/Badge";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { hasPermission } from "../../lib/permissions";
import { AccessProfilePermissionsModal } from "./AccessProfilePermissionsModal";

interface AccessProfilesManagerProps {
  currentUser: User;
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
}

export const AccessProfilesManager = ({
  currentUser,
  createOpen = false,
  onCreateOpenChange,
}: AccessProfilesManagerProps) => {
  const [profiles, setProfiles] = useState<AccessProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<AccessProfile | null>(
    null,
  );
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);
  const [permissionsProfileId, setPermissionsProfileId] = useState<
    number | null
  >(null);
  const [deleteProfile, setDeleteProfile] = useState<AccessProfile | null>(
    null,
  );

  const canManage = hasPermission(currentUser, "usuarios.gerenciar_permissoes");
  const canView = hasPermission(currentUser, "usuarios.ver_permissoes");

  const fetchProfiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<AccessProfile[]>("/access-profiles");
      setProfiles(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar perfis.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) fetchProfiles();
  }, [canView]);

  useEffect(() => {
    if (createOpen) {
      setEditingProfile(null);
      setNome("");
      setDescricao("");
      setIsFormOpen(true);
    }
  }, [createOpen]);

  const closeForm = () => {
    setIsFormOpen(false);
    onCreateOpenChange?.(false);
  };

  const openEdit = (profile: AccessProfile) => {
    setEditingProfile(profile);
    setNome(profile.nome);
    setDescricao(profile.descricao || "");
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingProfile) {
        await api.patch(`/access-profiles/${editingProfile.id}`, {
          nome: nome.trim(),
          descricao: descricao.trim() || null,
        });
        setSuccess("Perfil atualizado com sucesso.");
      } else {
        await api.post("/access-profiles", {
          nome: nome.trim(),
          descricao: descricao.trim() || null,
        });
        setSuccess("Perfil criado com sucesso.");
      }
      closeForm();
      fetchProfiles();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteProfile) return;
    try {
      await api.delete(`/access-profiles/${deleteProfile.id}`);
      setSuccess("Perfil removido com sucesso.");
      setDeleteProfile(null);
      fetchProfiles();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover perfil.");
      setDeleteProfile(null);
    }
  };

  if (!canView) {
    return (
      <div className="p-10 text-center">
        <Lock className="mx-auto mb-2 h-8 w-8 text-slate-300" />
        <p className="text-xs text-slate-500">
          Você não tem permissão para visualizar perfis de acesso.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col">
        {success && (
          <div className="mx-4 mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-700">
            {success}
          </div>
        )}
        {error && (
          <div className="mx-4 mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500">
            Nenhum perfil de acesso cadastrado.
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                    Perfil
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                    Uso
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profiles.map((profile) => (
                  <tr
                    key={profile.id}
                    className="group transition-colors hover:bg-slate-50/50"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-medium text-slate-900">
                          {profile.nome}
                        </span>
                        {profile.sistema && (
                          <Badge
                            variant="slate"
                            className="border-none text-[9px] uppercase"
                          >
                            Padrão
                          </Badge>
                        )}
                      </div>
                      {profile.descricao && (
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {profile.descricao}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Users size={12} /> {profile.usuarios_count || 0}{" "}
                          usuário(s)
                        </span>
                        <span className="flex items-center gap-1">
                          <Shield size={12} /> {profile.permissions_count || 0}{" "}
                          permissão(ões)
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {canManage ? (
                        <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setPermissionsProfileId(profile.id)}
                            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-600"
                            title="Permissões"
                          >
                            <Shield size={13} /> Permissões
                          </button>
                          <button
                            onClick={() => openEdit(profile)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600"
                            title="Editar"
                          >
                            <Edit2 size={14} />
                          </button>
                          {!profile.sistema && (
                            <button
                              onClick={() => setDeleteProfile(profile)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-red-50 hover:text-red-500"
                              title="Excluir"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingProfile ? "Editar Perfil" : "Novo Perfil de Acesso"}
        size="sm"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Nome</label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              placeholder="Ex: Atendente N1"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              Descrição
            </label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Opcional"
              className="h-8 text-xs"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={closeForm}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" loading={saving}>
              {editingProfile ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </Modal>

      {permissionsProfileId && (
        <AccessProfilePermissionsModal
          profileId={permissionsProfileId}
          isOpen={!!permissionsProfileId}
          onClose={() => setPermissionsProfileId(null)}
          onSaved={fetchProfiles}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteProfile}
        onClose={() => setDeleteProfile(null)}
        onConfirm={handleDelete}
        title="Excluir perfil de acesso?"
        description={`O perfil "${deleteProfile?.nome}" será arquivado. Só é possível excluir perfis sem usuários vinculados.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </>
  );
};
