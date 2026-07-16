import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Loader2,
  Menu,
  Search,
  Ticket as TicketIcon,
  UserRound,
} from "lucide-react";
import { api } from "../../lib/api";
import { Ticket, TicketListResponse, User } from "../../types";
import { cn } from "../../lib/utils";

interface TopbarProps {
  title: string;
  onMenuClick: () => void;
  isMenuOpen?: boolean;
  showSearch?: boolean;
  onNavigate?: (target: { tab: string; ticketId?: number }) => void;
}

type SearchResult =
  | {
      type: "ticket";
      id: number;
      title: string;
      subtitle: string;
      meta: string;
    }
  | {
      type: "user";
      id: number;
      title: string;
      subtitle: string;
      meta: string;
    };

const extractTickets = (response: TicketListResponse | Ticket[]): Ticket[] => {
  if (Array.isArray(response)) return response;
  return response?.data || [];
};

export const Topbar = ({
  title,
  onMenuClick,
  isMenuOpen = false,
  showSearch = true,
  onNavigate,
}: TopbarProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchRunRef = useRef(0);

  const trimmedQuery = query.trim();
  const canSearch = showSearch && trimmedQuery.length >= 2;

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!canSearch) {
      searchRunRef.current += 1;
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const runId = searchRunRef.current + 1;
    searchRunRef.current = runId;

    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      setIsOpen(true);

      const params = new URLSearchParams({
        search: trimmedQuery,
        limit: "5",
        page: "1",
      });

      const [ticketsResult, usersResult] = await Promise.allSettled([
        api.get<TicketListResponse | Ticket[]>(`/tickets?${params.toString()}`),
        api.get<User[]>(`/users?search=${encodeURIComponent(trimmedQuery)}&status=ativo`),
      ]);

      const nextResults: SearchResult[] = [];

      if (searchRunRef.current !== runId) return;

      if (ticketsResult.status === "fulfilled") {
        extractTickets(ticketsResult.value)
          .slice(0, 5)
          .forEach((ticket) => {
            nextResults.push({
              type: "ticket",
              id: ticket.id,
              title: ticket.titulo || `Chamado #${ticket.id}`,
              subtitle: ticket.cliente_nome || "Solicitante não informado",
              meta: `#${ticket.id} - ${ticket.status?.replace(/_/g, " ") || "sem status"}`,
            });
          });
      }

      if (usersResult.status === "fulfilled") {
        usersResult.value.slice(0, 5).forEach((user) => {
          nextResults.push({
            type: "user",
            id: user.id,
            title: user.nome,
            subtitle: user.email,
            meta: user.cargo || "Usuário",
          });
        });
      }

      if (
        ticketsResult.status === "rejected" &&
        usersResult.status === "rejected"
      ) {
        setError("Não foi possível buscar agora.");
      }

      setResults(nextResults);
      setLoading(false);
    }, 280);

    return () => window.clearTimeout(timeout);
  }, [canSearch, trimmedQuery]);

  const groupedResults = useMemo(
    () => ({
      tickets: results.filter((result) => result.type === "ticket"),
      users: results.filter((result) => result.type === "user"),
    }),
    [results],
  );

  const handleSelect = (result: SearchResult) => {
    setIsOpen(false);
    setQuery("");

    if (result.type === "ticket") {
      onNavigate?.({ tab: "tickets", ticketId: result.id });
      return;
    }

    onNavigate?.({ tab: "users" });
  };

  const renderResult = (result: SearchResult) => {
    const Icon = result.type === "ticket" ? TicketIcon : UserRound;
    return (
      <button
        key={`${result.type}-${result.id}`}
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => handleSelect(result)}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
      >
        <div
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
            result.type === "ticket"
              ? "border-blue-100 bg-blue-50 text-blue-700"
              : "border-emerald-100 bg-emerald-50 text-emerald-700",
          )}
        >
          <Icon size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-slate-900">
            {result.title}
          </div>
          <div className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
            {result.subtitle}
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {result.meta}
          </div>
        </div>
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/95 px-3 backdrop-blur sm:gap-5 sm:px-5">
      <div className="relative z-10 flex min-w-0 max-w-[calc(100%-48px)] shrink items-center gap-2 overflow-hidden bg-white/95 pr-1 sm:max-w-none sm:shrink-0 sm:gap-4 sm:pr-3">
        <button
          onClick={onMenuClick}
          onMouseEnter={onMenuClick}
          aria-label="Abrir menu principal"
          aria-controls="menu-principal"
          aria-expanded={isMenuOpen}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white p-0 text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
        >
          <Menu size={16} />
        </button>
        <h1 className="relative z-10 truncate text-sm font-semibold tracking-tight text-slate-950">
          {title}
        </h1>
      </div>

      <div className="relative z-20 ml-auto flex min-w-0 flex-1 justify-end">
        {showSearch && (
          <div ref={searchRef} className="relative w-9 transition-[width] focus-within:w-full sm:w-full sm:max-w-md">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors focus-within:text-blue-500"
              size={13}
            />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setIsOpen(true);
              }}
              onFocus={() => trimmedQuery.length >= 2 && setIsOpen(true)}
              placeholder="Buscar chamados, clientes ou usuários..."
              aria-label="Pesquisa global"
              className="h-8 w-full rounded-md border border-slate-200 bg-slate-50/80 pl-8 pr-8 text-xs text-slate-700 shadow-[0_1px_1px_rgba(15,23,42,0.02)] outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
            />
            {loading && (
              <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-blue-600" />
            )}

            {isOpen && trimmedQuery.length > 0 && (
              <div className="fixed left-3 right-3 top-14 z-50 mt-2 min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.16)] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:w-full sm:min-w-[360px]">
                {trimmedQuery.length < 2 ? (
                  <div className="px-3 py-3 text-xs font-medium text-slate-500">
                    Digite pelo menos 2 caracteres.
                  </div>
                ) : loading ? (
                  <div className="flex items-center gap-2 px-3 py-3 text-xs font-semibold text-slate-500">
                    <Loader2 size={14} className="animate-spin text-blue-600" />
                    Buscando...
                  </div>
                ) : error ? (
                  <div className="flex items-center gap-2 px-3 py-3 text-xs font-semibold text-rose-600">
                    <AlertCircle size={14} />
                    {error}
                  </div>
                ) : results.length === 0 ? (
                  <div className="px-3 py-4 text-center">
                    <div className="text-xs font-semibold text-slate-800">Nenhum resultado</div>
                    <div className="mt-1 text-[11px] font-medium text-slate-500">
                      Tente buscar por número, título, cliente ou usuário.
                    </div>
                  </div>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto py-1">
                    {groupedResults.tickets.length > 0 && (
                      <div>
                        <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Chamados
                        </div>
                        {groupedResults.tickets.map(renderResult)}
                      </div>
                    )}
                    {groupedResults.users.length > 0 && (
                      <div>
                        <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Usuários
                        </div>
                        {groupedResults.users.map(renderResult)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
