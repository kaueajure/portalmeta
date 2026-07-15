import React, { useState, useRef, useEffect } from "react";
import {
  Bot,
  Send,
  User as UserIcon,
  Loader2,
  Sparkles,
  MessageSquare,
  Flame,
  HelpCircle,
  Zap,
} from "lucide-react";
import { Card } from "../ui/Card";
import { PageShell } from "../layout/PageShell";
import { Button } from "../ui/Button";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { User } from "../../types";

interface Message {
  role: "user" | "model";
  text: string;
}

interface AITesterPageProps {
  currentUser: User;
}

const SUGGESTIONS = [
  {
    text: "Como posso melhorar a automação de chamados?",
    icon: Zap,
    label: "Automação",
  },
  {
    text: "Como configurar metas de SLA de suporte?",
    icon: Flame,
    label: "SLA",
  },
  {
    text: "Dicas para organizar a fila de chamados",
    icon: MessageSquare,
    label: "Fila",
  },
  {
    text: "Como a IA pode resumir chamados longos?",
    icon: Sparkles,
    label: "Resumos",
  },
];

export const AITesterPage: React.FC<AITesterPageProps> = ({ currentUser }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "model",
      text: `Olá, ${currentUser.nome}! Eu sou o Tique, seu assistente de Inteligência Artificial no Gestifique.

Posso ajudar você a responder clientes, resumir chamados, organizar fluxos de suporte, revisar mensagens ou pensar em automações. Como posso te apoiar hoje?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMessage: Message = { role: "user", text: textToSend.trim() };
    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await api.post<{ response: string }>("/ai/chat", {
        prompt: userMessage.text,
        history: currentMessages.slice(1, -1),
      });

      setMessages([
        ...currentMessages,
        { role: "model", text: response.response },
      ]);
    } catch (error: any) {
      setMessages([
        ...currentMessages,
        {
          role: "model",
          text: `**Erro ao processar:** ${error.message || "Ocorreu um erro ao comunicar com a IA"}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <PageShell
        title="Falar com o Tique"
        subtitle="O seu assistente inteligente integrado do Gestifique"
        actions={
          <div className="hidden sm:flex items-center gap-2 text-slate-400 text-xs px-2 py-1 bg-slate-50 rounded-lg">
            <HelpCircle size={14} />
            <span>Provedor de IA desativado</span>
          </div>
        }
        className="h-full"
        contentClassName="flex h-full min-h-0 flex-col overflow-hidden p-0"
        flush
      >
        {/* Chat Messages Section */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/40">
          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "flex gap-4 max-w-[85%]",
                    msg.role === "user" ? "ml-auto flex-row-reverse" : "",
                  )}
                >
                  <div
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
                      msg.role === "user"
                        ? "bg-slate-800 text-white"
                        : "bg-linear-to-tr from-indigo-600 to-violet-600 text-white",
                    )}
                  >
                    {msg.role === "user" ? (
                      <UserIcon size={16} />
                    ) : (
                      <Bot size={18} />
                    )}
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 px-1">
                      {msg.role === "user" ? "Você" : "Tique"}
                    </span>
                    <div
                      className={cn(
                        "px-4 py-3.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed shadow-xs",
                        msg.role === "user"
                          ? "bg-indigo-600 text-white rounded-tr-sm font-medium"
                          : "bg-white border border-slate-150 text-slate-700 rounded-tl-sm",
                      )}
                    >
                      {msg.text}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-4 max-w-[85%]"
              >
                <div className="w-9 h-9 rounded-xl bg-linear-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Bot size={18} />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 px-1">
                    Tique
                  </span>
                  <div className="px-4 py-3.5 rounded-2xl bg-white border border-slate-150 rounded-tl-sm text-sm flex items-center gap-2.5 text-slate-500 shadow-xs">
                    <Loader2
                      size={15}
                      className="animate-spin text-indigo-600"
                    />
                    <span className="font-medium animate-pulse">
                      Tique está pensando...
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Prompt Suggestions Panel */}
          {messages.length === 1 && (
            <div className="p-4 sm:p-6 bg-slate-100/40 border-t border-slate-100 shrink-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-3 pl-1">
                Ideias de assuntos para começar
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SUGGESTIONS.map((s, idx) => {
                  const IconComponent = s.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(s.text)}
                      className="text-left p-3 rounded-xl bg-white hover:bg-indigo-50/50 border border-slate-150 hover:border-indigo-200 transition-all group flex items-start gap-3"
                    >
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                        <IconComponent size={14} />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-indigo-500 block leading-tight mb-0.5">
                          {s.label}
                        </span>
                        <p className="text-xs text-slate-700 font-medium truncate">
                          {s.text}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Input control tray */}
          <div className="p-4 bg-white border-t border-slate-100 shrink-0">
            <form onSubmit={handleSubmit} className="flex items-center gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Faça uma pergunta ou envie um comando para o Tique..."
                className="flex-1 h-12 bg-slate-50 border border-slate-150 hover:border-slate-200 focus:border-indigo-400 rounded-xl px-4 text-sm outline-none transition-all placeholder-slate-400 focus:bg-white"
                autoFocus
                disabled={loading}
              />
              <Button
                type="submit"
                disabled={!input.trim() || loading}
                className={cn(
                  "h-12 px-5 rounded-xl flex items-center justify-center gap-2",
                  !input.trim() || loading
                    ? "bg-slate-100 text-slate-400 border-none"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white",
                )}
              >
                <span className="hidden sm:inline font-semibold text-xs">
                  Enviar
                </span>
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
              </Button>
            </form>
            <div className="text-center mt-2.5">
              <span className="text-[10px] text-slate-400">
                O Tique é alimentado por inteligência artificial avançada e pode
                cometer erros de interpretação.
              </span>
            </div>
          </div>
        </div>
      </PageShell>
    </div>
  );
};
