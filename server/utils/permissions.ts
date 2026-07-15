export type Perfil = 'desenvolvedor' | 'administrador' | 'gestor' | 'atendente' | 'cliente';

import { PERMISSIONS_CATALOG } from '../constants/permissions.js';

const ADMIN_GLOBAL_DENYLIST = new Set([
  'empresas.criar',
  'empresas.excluir',
  'empresas.desativar',
  'configuracoes.sistema',
]);

export const RolePermissions = {
  desenvolvedor: ['*'],
  administrador: PERMISSIONS_CATALOG
    .map(item => item.key)
    .filter(key => !key.startsWith('sistema.') && !key.startsWith('telas.') && !ADMIN_GLOBAL_DENYLIST.has(key)),
  gestor: [
    'tickets.visualizar', 'tickets.criar', 'tickets.editar', 'tickets.finalizar', 'tickets.arquivar', 'tickets.atribuir', 'tickets.comentar_interno', 'tickets.ver_todos',
    'relatorios.visualizar',
    'configuracoes.gerenciar', 'automacoes.gerenciar', 'base_conhecimento.gerenciar', 'base_conhecimento.visualizar',
    'auditoria.visualizar'
  ],
  atendente: [
    'tickets.visualizar', 'tickets.criar', 'tickets.editar', 'tickets.finalizar', 'tickets.comentar_interno', 'tickets.ver_todos',
    'base_conhecimento.gerenciar', 'base_conhecimento.visualizar'
  ],
  cliente: [
    'tickets.visualizar', 'tickets.criar', 'base_conhecimento.visualizar'
  ]
};

export function hasPermission(user: any, permission: string): boolean {
  if (!user) return false;
  if (user.desenvolvedor) return true;
  
  const perfil = (user.perfil || 'atendente') as Perfil; // default fallback if null
  
  const perms = RolePermissions[perfil] || RolePermissions['atendente'];
  if (perms.includes('*')) return true;
  return perms.includes(permission);
}
