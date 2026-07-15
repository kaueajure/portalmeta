import { permissionsService } from '../services/permissions.service.js';
import { isDeveloperUser } from './user-scope.js';

export interface TicketScope {
  canViewAll: boolean;
  canViewOwn: boolean;
  canViewUnassigned: boolean;
}

export async function getTicketScope(user: any): Promise<TicketScope> {
  if (!user) return { canViewAll: false, canViewOwn: false, canViewUnassigned: false };

  if (isDeveloperUser(user)) {
    return {
      canViewAll: true,
      canViewOwn: true,
      canViewUnassigned: true
    };
  }

  const [canViewAll, canViewOwn, canViewUnassigned] = await Promise.all([
    permissionsService.hasPermission(user, 'tickets.ver_todos'),
    permissionsService.hasPermission(user, 'tickets.ver_proprios'),
    permissionsService.hasPermission(user, 'tickets.ver_sem_responsavel')
  ]);

  return {
    canViewAll,
    canViewOwn,
    canViewUnassigned
  };
}

export function canAccessTicketByScope(ticket: any, user: any, scope: TicketScope): boolean {
  if (!ticket || !user) return false;

  if (isDeveloperUser(user)) return true;

  if (Number(ticket.empresa_id) !== Number(user.empresa_id)) {
    return false;
  }

  // Clients can strictly only view their own tickets
  if (user.perfil === 'cliente') {
    return Number(ticket.usuario_id) === Number(user.id);
  }

  // Check defined permissions
  if (scope.canViewAll) return true;

  const userId = Number(user.id);

  if (scope.canViewOwn) {
    if (Number(ticket.responsavel_id) === userId || Number(ticket.usuario_id) === userId) {
      return true;
    }
  }

  if (scope.canViewUnassigned) {
    if (ticket.responsavel_id === null || ticket.responsavel_id === undefined) {
      return true;
    }
  }

  return false;
}
