import React, { useEffect, useMemo, useState } from 'react';
import { Ticket, TicketKanbanColumn, TicketKanbanResponse, TicketStatus, TicketStatusSpecial, User } from '../../types';
import {
  AlertCircle,
  ChevronDown,
  Clock,
  Loader2,
  Mail,
  ShieldAlert,
  UserRound
} from 'lucide-react';
import { cn, getSlaInfo } from '../../lib/utils';
import { api } from '../../lib/api';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { getSocket } from '../../lib/socket';
import { hasAnyPermission, hasPermission } from '../../lib/permissions';

const DraggableComp = Draggable as any;
const DroppableComp = Droppable as any;
const DragDropContextComp = DragDropContext as any;

interface TicketKanbanProps {
  kanbanData: TicketKanbanResponse;
  onSelectTicket: (id: number) => void;
  currentUser: User;
  onStatusChange: () => void;
  devCompanyId?: string;
  statusOptions?: { value: TicketStatus; label: string; special?: TicketStatusSpecial | string | null }[];
  onTicketContextMenu?: (event: React.MouseEvent, ticket: Ticket) => void;
}

interface TeamMember {
  id: number;
  nome: string;
  email?: string;
  cargo?: string | null;
  ticket_count?: number;
}

type RowUser = TeamMember & {
  rowKey: string;
  isUnassigned?: boolean;
};

const priorityColors: Record<string, string> = {
  urgente: 'bg-red-500',
  alta: 'bg-orange-500',
  media: 'bg-yellow-400',
  baixa: 'bg-blue-500',
};

const getStatusDot = (status: string) =>
  cn(
    'h-1.5 w-1.5 rounded-full',
    status === 'aberto' && 'bg-blue-500',
    status === 'em_andamento' && 'bg-indigo-500',
    status === 'aguardando_cliente' && 'bg-amber-500',
    status === 'resolvido' && 'bg-emerald-500',
    status === 'fechado' && 'bg-slate-500',
    !['aberto', 'em_andamento', 'aguardando_cliente', 'resolvido', 'fechado'].includes(status) && 'bg-cyan-500'
  );

const getAllTickets = (columns: TicketKanbanColumn[]) =>
  columns.flatMap(column => column.tickets);

const getColumnTicketCount = (columns: TicketKanbanColumn[], status: string) => {
  const col = columns.find(column => column.id === status);
  if (!col) return 0;
  // Usa o total REAL do servidor (não o número de cards carregados).
  return typeof col.count === 'number' ? col.count : col.tickets.length;
};

const getTicketsForCell = (columns: TicketKanbanColumn[], status: string, row: RowUser) => {
  const tickets = columns.find(column => column.id === status)?.tickets || [];

  if (row.isUnassigned) {
    return tickets.filter(ticket => !ticket.responsavel_id);
  }

  return tickets.filter(ticket => Number(ticket.responsavel_id) === Number(row.id));
};

const rowColumnWidth = 220;
const statusColumnWidth = 210;
const boardGap = 8;
const boardPadding = 16;

export const TicketKanban = ({
  kanbanData,
  onSelectTicket,
  currentUser,
  onStatusChange,
  devCompanyId,
  statusOptions = [],
  onTicketContextMenu
}: TicketKanbanProps) => {
  const canEditStatus = hasPermission(currentUser, 'tickets.editar_status');
  const canReopen = hasPermission(currentUser, 'tickets.reabrir');
  const canMoveResponsavel = hasAnyPermission(currentUser, [
    'tickets.assumir',
    'tickets.atribuir',
    'tickets.transferir',
    'tickets.remover_responsavel'
  ]);
  const canDragCards = canEditStatus || canMoveResponsavel;

  const [localData, setLocalData] = useState<TicketKanbanResponse>(kanbanData);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const statusSpecialMap = useMemo(
    () => new Map(statusOptions.map((status) => [status.value, status.special || 'normal'])),
    [statusOptions]
  );
  const isFinalStatus = (status: string) => {
    const special = statusSpecialMap.get(status as TicketStatus);
    return special === 'finalizado' || special === 'encerrado' || status === 'resolvido' || status === 'fechado';
  };
  const boardColumns = localData.columns.length || 1;
  const boardGridStyle = {
    gridTemplateColumns: `${rowColumnWidth}px repeat(${boardColumns}, ${statusColumnWidth}px)`,
  };
  const boardMinWidth =
    rowColumnWidth +
    boardColumns * statusColumnWidth +
    boardColumns * boardGap +
    boardPadding;

  useEffect(() => {
    setLocalData(kanbanData);
  }, [kanbanData]);

  useEffect(() => {
    const fetchTeam = async () => {
      if (currentUser.desenvolvedor && !devCompanyId) {
        setTeam([]);
        setLoadingTeam(false);
        return;
      }

      try {
        setLoadingTeam(true);
        const endpoint = currentUser.desenvolvedor && devCompanyId
          ? `/users/team?empresa_id=${devCompanyId}`
          : '/users/team';
        const data = await api.get<TeamMember[]>(endpoint);
        setTeam(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar atendentes.';
        setErrorMsg(message);
      } finally {
        setLoadingTeam(false);
      }
    };

    fetchTeam();
  }, [currentUser.desenvolvedor, devCompanyId]);

  useEffect(() => {
    const socketEmpresaId = currentUser.desenvolvedor
      ? Number(devCompanyId)
      : Number(currentUser.empresa_id);

    if (!Number.isInteger(socketEmpresaId) || socketEmpresaId <= 0) return;

    const socket = getSocket(socketEmpresaId);

    const handleTicketUpdated = (updatedTicket: Ticket) => {
      setLocalData(currentData => {
        // Descobre a coluna de origem (onde o ticket está carregado hoje).
        let originStatus: string | null = null;
        currentData.columns.forEach(column => {
          if (column.tickets.some(ticket => ticket.id === updatedTicket.id)) {
            originStatus = column.id;
          }
        });
        const destStatus = updatedTicket.status;

        const newColumns = currentData.columns.map(column => {
          let tickets = column.tickets.filter(ticket => ticket.id !== updatedTicket.id);
          let count = column.count;

          // Origem perde 1 só se houve mudança real de status de um card carregado.
          if (originStatus && originStatus !== destStatus && column.id === originStatus) {
            count = Math.max(0, count - 1);
          }

          if (column.id === destStatus) {
            tickets = [updatedTicket, ...tickets];
            if (originStatus && originStatus !== destStatus) {
              count = count + 1;
            }
          }

          return { ...column, tickets, count };
        });

        return { ...currentData, columns: newColumns };
      });
    };

    const handleTicketCreated = (newTicket: Ticket) => {
      setLocalData(currentData => {
        if (currentData.columns.some(column => column.tickets.some(ticket => ticket.id === newTicket.id))) {
          return currentData;
        }

        const newColumns = currentData.columns.map(column => {
          if (column.id === newTicket.status) {
            // Ticket novo: incrementa o total real da coluna de destino.
            return { ...column, tickets: [newTicket, ...column.tickets], count: column.count + 1 };
          }
          return column;
        });

        return { ...currentData, columns: newColumns };
      });
    };

    socket.on('ticketUpdated', handleTicketUpdated);
    socket.on('ticketCreated', handleTicketCreated);

    return () => {
      socket.off('ticketUpdated', handleTicketUpdated);
      socket.off('ticketCreated', handleTicketCreated);
    };
  }, [currentUser.desenvolvedor, currentUser.empresa_id, devCompanyId]);

  const rows: RowUser[] = useMemo(() => {
    const allTickets = getAllTickets(localData.columns);
    const hasUnassigned = allTickets.some(ticket => !ticket.responsavel_id);

    const users = team
      .map(member => ({ ...member, rowKey: String(member.id) }))
      .sort((a, b) => a.nome.localeCompare(b.nome));

    if (!hasUnassigned) return users;

    return [
      { id: 0, nome: 'Sem responsável', rowKey: 'unassigned', isUnassigned: true, ticket_count: allTickets.filter(ticket => !ticket.responsavel_id).length },
      ...users,
    ];
  }, [team, localData.columns]);

  useEffect(() => {
    if (!currentUser?.id || loadingTeam) return;

    const currentUserRow = rows.find(
      row => !row.isUnassigned && Number(row.id) === Number(currentUser.id),
    );

    setExpandedRows(prev => {
      if (Object.keys(prev).length > 0) return prev;

      if (rows.length > 0 && rows.length <= 4) {
        return rows.reduce<Record<string, boolean>>((acc, row) => {
          acc[row.rowKey] = true;
          return acc;
        }, {});
      }

      if (!currentUserRow) return prev;
      return { ...prev, [currentUserRow.rowKey]: true };
    });
  }, [currentUser?.id, loadingTeam, rows]);

  const getRowTicketCount = (row: RowUser) =>
    localData.columns.reduce((total, column) => total + getTicketsForCell(localData.columns, column.id, row).length, 0);

  const toggleRow = (rowKey: string) => {
    setExpandedRows(prev => ({ ...prev, [rowKey]: !prev[rowKey] }));
  };

  const updateTicketLocally = (ticketId: number, status: string, row: RowUser) => {
    setLocalData(currentData => {
      let movedTicket: Ticket | null = null;
      let originStatus: string | null = null;

      const withoutTicket = currentData.columns.map(column => {
        const nextTickets = column.tickets.filter(ticket => {
          if (ticket.id === ticketId) {
            movedTicket = ticket;
            originStatus = column.id;
            return false;
          }
          return true;
        });

        return { ...column, tickets: nextTickets };
      });

      if (!movedTicket) return currentData;

      const updatedTicket: Ticket = {
        ...movedTicket,
        status: status as Ticket['status'],
        responsavel_id: row.isUnassigned ? null : row.id,
        responsavel_nome: row.isUnassigned ? 'Não Atribuído' : row.nome,
      };

      const finalColumns = withoutTicket.map(column => {
        let tickets = column.tickets;
        let count = column.count;

        // Ajuste de contagem por delta apenas quando o status muda.
        if (originStatus && originStatus !== status && column.id === originStatus) {
          count = Math.max(0, count - 1);
        }

        if (column.id === status) {
          tickets = [updatedTicket, ...tickets];
          if (originStatus && originStatus !== status) {
            count = count + 1;
          }
        }

        return { ...column, tickets, count };
      });

      return { ...currentData, columns: finalColumns };
    });
  };

  const persistTicketMove = async (ticketId: number, status: string, row: RowUser, currentTicket: Ticket) => {
    const responsavelId = row.isUnassigned ? null : row.id;
    const statusChanged = currentTicket.status !== status;
    const responsavelChanged = Number(currentTicket.responsavel_id || 0) !== Number(responsavelId || 0);

    if (responsavelChanged) {
      await api.patch(`/tickets/${ticketId}`, { responsavel_id: responsavelId });
    }
    if (statusChanged) {
      await api.patch(`/tickets/${ticketId}/status`, { status });
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, draggableId } = result;
    if (!destination) return;

    if (!canDragCards) {
      setErrorMsg('Sem permissão para mover chamados.');
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    const [targetRowKey, targetStatus] = destination.droppableId.split('::');
    const targetRow = rows.find(row => row.rowKey === targetRowKey);
    const ticketId = Number(draggableId);

    if (!targetRow || !targetStatus || !ticketId) return;

    const currentTicket = getAllTickets(localData.columns).find(ticket => Number(ticket.id) === ticketId);
    if (!currentTicket) return;

    const targetResponsavelId = targetRow.isUnassigned ? null : targetRow.id;
    const statusChanged = currentTicket.status !== targetStatus;
    const responsavelChanged = Number(currentTicket.responsavel_id || 0) !== Number(targetResponsavelId || 0);

    if (statusChanged) {
      if (!canEditStatus) {
        setErrorMsg('Sem permissão para alterar status.');
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }

      if (isFinalStatus(targetStatus) && !isFinalStatus(currentTicket.status)) {
        setErrorMsg('Finalize o chamado pela tela de detalhe para registrar o motivo.');
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }

      if (isFinalStatus(currentTicket.status) && !isFinalStatus(targetStatus) && !canReopen) {
        setErrorMsg('Sem permissão para reabrir chamados.');
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }
    }

    if (responsavelChanged) {
      const requiredPermission = targetResponsavelId === null
        ? 'tickets.remover_responsavel'
        : Number(targetResponsavelId) === Number(currentUser.id)
          ? 'tickets.assumir'
          : currentTicket.responsavel_id
            ? 'tickets.transferir'
            : 'tickets.atribuir';

      if (!hasPermission(currentUser, requiredPermission)) {
        setErrorMsg('Sem permissão para alterar responsável.');
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }
    }

    try {
      setUpdatingId(ticketId);
      updateTicketLocally(ticketId, targetStatus, targetRow);
      await persistTicketMove(ticketId, targetStatus, targetRow, currentTicket);
      onStatusChange();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao mover ticket.';
      setErrorMsg(message);
      onStatusChange();
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {errorMsg && (
        <div className="mx-2 mt-2 flex items-center gap-2 rounded-md border border-red-100 bg-red-50 p-2 text-[10px] font-semibold text-red-600">
          <AlertCircle size={12} /> {errorMsg}
        </div>
      )}

      <DragDropContextComp onDragEnd={onDragEnd}>
        <div className="h-full overflow-auto bg-slate-50/80 p-3 custom-scrollbar">
          <div className="space-y-2" style={{ width: `${boardMinWidth}px`, minWidth: `${boardMinWidth}px` }}>
            <div className="sticky top-0 z-20 grid gap-2 rounded-lg border border-slate-200 bg-white/95 p-2 shadow-[0_2px_10px_rgba(15,23,42,0.06)] backdrop-blur" style={boardGridStyle}>
              <div className="flex h-11 items-center px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Atendente
              </div>
              {localData.columns.map(column => (
                <div key={column.id} className="flex h-11 items-center justify-between rounded-md border border-slate-200 bg-slate-50/80 px-3">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <div className={getStatusDot(column.id)} />
                    <span className="truncate text-xs font-semibold text-slate-700">{column.title}</span>
                  </div>
                  <span
                    className="ml-2 flex h-5 min-w-5 shrink-0 items-center justify-center rounded bg-white px-1.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200/80"
                    title={column.hasMore ? `Mostrando ${column.loadedCount ?? column.tickets.length} de ${getColumnTicketCount(localData.columns, column.id)}` : undefined}
                  >
                    {column.hasMore && (
                      <span className="mr-0.5 text-[9px] font-medium text-amber-500">
                        {column.loadedCount ?? column.tickets.length}/
                      </span>
                    )}
                    {getColumnTicketCount(localData.columns, column.id)}
                  </span>
                </div>
              ))}
            </div>

            {loadingTeam ? (
              <div className="flex h-40 items-center justify-center rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  Carregando atendentes...
                </div>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white text-xs font-medium text-slate-400">
                Nenhum atendente encontrado.
              </div>
            ) : (
              <div className="space-y-2">
                {rows.map(row => {
                  const isExpanded = !!expandedRows[row.rowKey];
                  const rowCount = getRowTicketCount(row);

                  return (
                    <section key={row.rowKey} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                      <button
                        type="button"
                        onClick={() => toggleRow(row.rowKey)}
                        className="grid w-full gap-2 bg-white p-2 text-left transition-colors hover:bg-slate-50/80"
                        style={boardGridStyle}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <div className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                            row.isUnassigned ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'
                          )}>
                            {row.isUnassigned ? <ShieldAlert size={14} /> : row.nome.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-xs font-semibold text-slate-800">{row.nome}</p>
                              <span className="text-xs font-semibold text-slate-500">{rowCount}</span>
                              <ChevronDown size={14} className={cn('text-slate-400 transition-transform', isExpanded && 'rotate-180')} />
                            </div>
                            <p className="truncate text-[10px] font-medium text-slate-400">
                              {row.isUnassigned ? 'Fila sem atribuição' : row.cargo || row.email || 'Atendente'}
                            </p>
                          </div>
                        </div>

                        {localData.columns.map(column => {
                          const count = getTicketsForCell(localData.columns, column.id, row).length;

                          return (
                            <div key={column.id} className="flex h-10 items-center rounded-lg border border-slate-100 bg-slate-50/80 px-3">
                              <span className="text-[11px] font-semibold text-slate-600">
                                {count}
                              </span>
                            </div>
                          );
                        })}
                      </button>

                      {isExpanded && (
                        <div className="grid gap-2 border-t border-slate-100 bg-slate-50/70 p-2" style={boardGridStyle}>
                          <div className="px-2 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Chamados
                          </div>

                          {localData.columns.map(column => {
                            const tickets = getTicketsForCell(localData.columns, column.id, row);
                            const droppableId = `${row.rowKey}::${column.id}`;

                            return (
                              <DroppableComp key={droppableId} droppableId={droppableId}>
                                {(provided: any, snapshot: any) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={cn(
                                      'min-h-[112px] rounded-md border border-dashed border-slate-200 bg-white/90 p-2 transition-colors',
                                      tickets.length > 0 && 'space-y-2',
                                      snapshot.isDraggingOver && 'border-blue-300 bg-blue-50/70 shadow-inner'
                                    )}
                                  >
                                    {tickets.map((ticket, index) => {
                                      const sla = getSlaInfo(ticket.prazo_sla, ticket.status, ticket.sla_status_operacional);
                                      const priorityColor = priorityColors[ticket.prioridade] || 'bg-slate-300';

                                      return (
                                        <DraggableComp
                                          key={ticket.id.toString()}
                                          draggableId={ticket.id.toString()}
                                          index={index}
                                          isDragDisabled={!canDragCards}
                                        >
                                          {(dragProvided: any, dragSnapshot: any) => (
                                            <div
                                              ref={dragProvided.innerRef}
                                              {...dragProvided.draggableProps}
                                              {...dragProvided.dragHandleProps}
                                              onClick={() => onSelectTicket(ticket.id)}
                                              onContextMenu={(event: React.MouseEvent) => onTicketContextMenu?.(event, ticket)}
                                              className={cn(
                                                'group relative flex h-[112px] cursor-pointer flex-col overflow-hidden rounded-md border border-slate-200 bg-white p-2.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:border-slate-300 hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)]',
                                                dragSnapshot.isDragging && 'z-50 border-blue-300 shadow-lg',
                                                updatingId === ticket.id && 'pointer-events-none opacity-50'
                                              )}
                                            >
                                              <div className={cn('absolute bottom-0 left-0 top-0 w-[3px]', priorityColor)} />

                                              <div className="flex min-h-0 items-start justify-between gap-2 pl-1.5">
                                                <div className="min-w-0">
                                                  <div className="mb-1 flex items-center gap-1.5">
                                                    <span className="text-[10px] font-semibold text-slate-500">#{ticket.id}</span>
                                                    {ticket.origem === 'email' && <Mail size={11} className="text-slate-400" />}
                                                    {ticket.nao_lido && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                                                  </div>
                                                  <h4 className="line-clamp-2 text-[12px] font-semibold leading-snug text-slate-900 group-hover:text-slate-950">
                                                    {ticket.titulo || 'Sem título'}
                                                  </h4>
                                                </div>

                                                <div className={cn('flex shrink-0 items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold', sla.color)}>
                                                  <Clock size={10} />
                                                  {sla.compactText || sla.label}
                                                </div>
                                              </div>

                                              <div className="mt-auto flex items-center gap-1.5 pl-1.5 text-[10px] text-slate-500">
                                                <UserRound size={10} className="shrink-0 text-slate-400" />
                                                <span className="truncate">{ticket.cliente_nome || 'Cliente'}</span>
                                              </div>
                                            </div>
                                          )}
                                        </DraggableComp>
                                      );
                                    })}
                                    {provided.placeholder}
                                    {tickets.length === 0 && !snapshot.isDraggingOver && (
                                      <div className="flex h-[112px] items-center justify-center rounded-md bg-slate-50/70 text-[10px] font-medium text-slate-400">
                                        Vazio
                                      </div>
                                    )}
                                  </div>
                                )}
                              </DroppableComp>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DragDropContextComp>
    </div>
  );
};
