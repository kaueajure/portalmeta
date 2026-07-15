export type Perfil = 'desenvolvedor' | 'administrador' | 'gestor' | 'atendente' | 'cliente';

import { User } from '../types';

export function isDeveloperUser(user: User | null | undefined): boolean {
  return !!user && (user.desenvolvedor || user.perfil === 'desenvolvedor');
}

function isGlobalOnlyPermission(permission: string): boolean {
  return (
    permission.startsWith('sistema.') ||
    permission.startsWith('telas.') ||
    ['empresas.criar', 'empresas.excluir', 'empresas.desativar', 'configuracoes.sistema'].includes(permission)
  );
}

export function hasPermission(user: User | null | undefined, permission: string): boolean {
  if (!user) return false;
  if (isDeveloperUser(user)) return true;
  if (user.permissions?.includes('*')) return !isGlobalOnlyPermission(permission);
  return user.permissions?.includes(permission) ?? false;
}

export function hasAnyPermission(user: User | null | undefined, permissions: string[]): boolean {
  if (!user) return false;
  if (isDeveloperUser(user)) return true;
  if (user.permissions?.includes('*')) return permissions.some(permission => !isGlobalOnlyPermission(permission));
  return permissions.some(p => user.permissions?.includes(p));
}

export function hasAllPermissions(user: User | null | undefined, permissions: string[]): boolean {
  if (!user) return false;
  if (isDeveloperUser(user)) return true;
  if (user.permissions?.includes('*')) return permissions.every(permission => !isGlobalOnlyPermission(permission));
  return permissions.every(p => user.permissions?.includes(p));
}

export function canAccessAppScreen(
  user: User | null | undefined,
  screen: string,
  options: { selectedTicketId?: number | null } = {},
): boolean {
  switch (screen) {
    case 'dashboard':
      return hasPermission(user, 'dashboard.visualizar');
    case 'tickets':
      return hasPermission(
        user,
        options.selectedTicketId ? 'tickets.ver_detalhes' : 'tickets.visualizar',
      );
    case 'whatsapp':
      return hasPermission(user, 'integracoes.whatsapp.visualizar');
    case 'users':
      return hasPermission(user, 'usuarios.visualizar');
    case 'companies':
      return isDeveloperUser(user);
    case 'logs':
      return hasPermission(user, 'auditoria.visualizar');
    case 'reports':
      return hasPermission(user, 'relatorios.visualizar');
    case 'knowledge':
      return hasPermission(user, 'base_conhecimento.visualizar');
    case 'ai':
      return hasPermission(user, 'ia.visualizar');
    case 'settings':
      return hasPermission(user, 'configuracoes.visualizar');
    case 'profile':
      return !!user;
    default:
      return false;
  }
}

export function getFirstAccessibleAppScreen(user: User | null | undefined): string {
  return [
    'dashboard',
    'tickets',
    'whatsapp',
    'knowledge',
    'reports',
    'users',
    'companies',
    'settings',
    'logs',
    'profile',
  ].find((screen) => canAccessAppScreen(user, screen)) || 'profile';
}

