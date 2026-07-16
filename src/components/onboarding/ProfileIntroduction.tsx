import React, { useState } from "react";
import { BarChart3, Headphones, Settings, ShieldCheck, Sparkles, Users } from "lucide-react";
import { User } from "../../types";
import { canAccessAppScreen } from "../../lib/permissions";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";

interface ProfileIntroductionProps {
  currentUser: User;
  onNavigate: (tab: string) => void;
}

const INTRODUCTION_VERSION = "v1";

const profileContent = {
  desenvolvedor: {
    eyebrow: "Ambiente técnico",
    title: "Seu ponto de partida no Portal Meta",
    description: "Acompanhe a operação e mantenha configurações e auditoria ao alcance.",
    actions: [
      { tab: "settings", label: "Revisar configurações", description: "Integrações, fluxos e regras do sistema.", icon: Settings },
      { tab: "logs", label: "Consultar auditoria", description: "Eventos e rastreabilidade da instância.", icon: ShieldCheck },
      { tab: "tickets", label: "Ver operação", description: "Filas e chamados em andamento.", icon: Headphones },
    ],
  },
  administrador: {
    eyebrow: "Administração",
    title: "Prepare a equipe para trabalhar",
    description: "Comece pelos acessos e fluxos; depois acompanhe a operação pelas filas.",
    actions: [
      { tab: "users", label: "Organizar equipe", description: "Usuários, perfis e permissões.", icon: Users },
      { tab: "settings", label: "Configurar fluxos", description: "Status, SLA, canais e automações.", icon: Settings },
      { tab: "tickets", label: "Acompanhar chamados", description: "Prioridades, filas e distribuição.", icon: Headphones },
    ],
  },
  gestor: {
    eyebrow: "Gestão",
    title: "Acompanhe o que exige decisão",
    description: "Indicadores, relatórios e filas críticas ficam nos atalhos abaixo.",
    actions: [
      { tab: "dashboard", label: "Abrir indicadores", description: "Visão geral da operação.", icon: BarChart3 },
      { tab: "reports", label: "Analisar relatórios", description: "Recortes e desempenho do atendimento.", icon: Sparkles },
      { tab: "tickets", label: "Revisar filas", description: "Urgêntes, SLA vencido e sem responsável.", icon: Headphones },
    ],
  },
  atendente: {
    eyebrow: "Atendimento",
    title: "Comece pela sua fila",
    description: "Use as filas para priorizar, assuma o atendimento e responda com Ctrl+Enter.",
    actions: [
      { tab: "tickets", label: "Abrir minha fila", description: "Chamados atribuídos e que precisam de resposta.", icon: Headphones },
      { tab: "tickets", label: "Assumir atendimentos", description: "Abra um chamado sem responsável e use Assumir.", icon: Users },
      { tab: "profile", label: "Conhecer preferências", description: "Tema, dados pessoais e atalhos de trabalho.", icon: Settings },
    ],
  },
  cliente: {
    eyebrow: "Portal do cliente",
    title: "Acompanhe suas solicitações",
    description: "Abra chamados com contexto completo e acompanhe cada atualização pelo portal.",
    actions: [
      { tab: "new-ticket", label: "Abrir um chamado", description: "Descreva a solicitação e envie anexos.", icon: Headphones },
      { tab: "tickets", label: "Ver meus chamados", description: "Consulte respostas, status e histórico.", icon: BarChart3 },
      { tab: "home", label: "Conhecer o portal", description: "Resumo e acessos mais frequentes.", icon: Sparkles },
    ],
  },
};

export function ProfileIntroduction({ currentUser, onNavigate }: ProfileIntroductionProps) {
  const storageKey = `portalmeta.introduction.${INTRODUCTION_VERSION}.${currentUser.id}`;
  const [isOpen, setIsOpen] = useState(() => window.localStorage.getItem(storageKey) !== "done");
  const profile = currentUser.desenvolvedor
    ? "desenvolvedor"
    : currentUser.administrador || currentUser.perfil === "administrador"
      ? "administrador"
      : currentUser.perfil === "cliente"
        ? "cliente"
        : currentUser.perfil === "gestor"
        ? "gestor"
        : "atendente";
  const content = profileContent[profile];
  const actions = content.actions.filter((action) => profile === "cliente" || canAccessAppScreen(currentUser, action.tab));

  const dismiss = () => {
    window.localStorage.setItem(storageKey, "done");
    setIsOpen(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={dismiss}
      title={content.title}
      size="md"
      footer={<Button variant="ghost" onClick={dismiss}>Explorar por conta própria</Button>}
    >
      <div className="space-y-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700">{content.eyebrow}</span>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">Olá, {currentUser.nome.split(" ")[0]}. {content.description}</p>
          {currentUser.access_profile_nome && <p className="mt-1 text-xs text-slate-500">Perfil de acesso: {currentUser.access_profile_nome}</p>}
        </div>
        <div className="grid gap-2">
          {actions.map(({ tab, label, description, icon: Icon }, index) => (
            <button
              key={`${tab}-${index}`}
              type="button"
              onClick={() => { dismiss(); onNavigate(tab); }}
              className="group flex min-h-16 w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 group-hover:bg-blue-100"><Icon size={18} /></span>
              <span className="min-w-0"><strong className="block text-sm text-slate-900">{label}</strong><span className="mt-0.5 block text-xs text-slate-600">{description}</span></span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
