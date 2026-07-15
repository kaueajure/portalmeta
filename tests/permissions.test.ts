import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessAppScreen, hasAllPermissions, hasAnyPermission, hasPermission } from '../src/lib/permissions.ts';
import {
  filterGlobalPermissionsForUser,
  isGlobalOnlyPermission,
  resolveEffectivePermissionKeys
} from '../server/services/permissions.service.ts';
import type { User } from '../src/types.ts';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    empresa_id: 10,
    nome: 'Test User',
    email: 'user@example.com',
    cargo: null,
    perfil: 'atendente',
    administrador: false,
    desenvolvedor: false,
    ativo: true,
    telefone: null,
    foto: null,
    ultimo_login: null,
    created_at: new Date(0).toISOString(),
    permissions: [],
    ...overrides,
  };
}

test('master wildcard grants system permissions but not obsolete permissions', () => {
  const user = makeUser({
    administrador: true,
    perfil: 'administrador',
    permissions: ['*'],
  });

  assert.equal(hasPermission(user, 'tickets.visualizar'), true);
  assert.equal(hasPermission(user, 'ticket_mensagens.responder'), true);
  assert.equal(hasPermission(user, 'sistema.health'), true);
  assert.equal(hasPermission(user, 'telas.visualizar'), true);
  assert.equal(hasPermission(user, 'sistema.developer'), false);
  assert.equal(hasPermission(user, 'empresas.criar'), false);
  assert.equal(hasPermission(user, 'empresas.excluir'), false);
});

test('explicit permissions remain precise without wildcard', () => {
  const user = makeUser({
    permissions: ['tickets.visualizar', 'ticket_mensagens.responder'],
  });

  assert.equal(hasPermission(user, 'tickets.visualizar'), true);
  assert.equal(hasPermission(user, 'ticket_mensagens.responder'), true);
  assert.equal(hasPermission(user, 'tickets.excluir'), false);
});

test('companies screen is unavailable after single-company refactor', () => {
  const regularWithCompanyPermission = makeUser({
    permissions: ['empresas.visualizar'],
  });
  assert.equal(hasPermission(regularWithCompanyPermission, 'empresas.visualizar'), true);
  assert.equal(canAccessAppScreen(regularWithCompanyPermission, 'companies'), false);
});

test('hasAnyPermission and hasAllPermissions respect global-only wildcard exclusions', () => {
  const user = makeUser({ permissions: ['*'] });

  assert.equal(hasAnyPermission(user, ['sistema.health', 'tickets.visualizar']), true);
  assert.equal(hasAllPermissions(user, ['tickets.visualizar', 'ticket_mensagens.responder']), true);
  assert.equal(hasAllPermissions(user, ['tickets.visualizar', 'sistema.health']), true);
  assert.equal(hasAllPermissions(user, ['tickets.visualizar', 'sistema.developer']), false);
});

test('backend classifies only obsolete global permissions centrally', () => {
  assert.equal(isGlobalOnlyPermission('*'), true);
  assert.equal(isGlobalOnlyPermission('empresas.criar'), true);
  assert.equal(isGlobalOnlyPermission('sistema.developer'), true);
  assert.equal(isGlobalOnlyPermission('sistema.health'), false);
  assert.equal(isGlobalOnlyPermission('telas.precos.editar'), false);
  assert.equal(isGlobalOnlyPermission('tickets.visualizar'), false);
});

test('backend allows instance system permissions and filters obsolete ones', () => {
  const user = makeUser({ perfil: 'atendente', desenvolvedor: false });
  const effective = resolveEffectivePermissionKeys(
    user,
    ['tickets.visualizar'],
    [
      { permission_key: 'empresas.criar', effect: 'allow' },
      { permission_key: 'sistema.health', effect: 'allow' },
      { permission_key: 'tickets.editar', effect: 'allow' },
    ]
  );

  assert.deepEqual(effective.sort(), ['sistema.health', 'tickets.editar', 'tickets.visualizar'].sort());
  assert.equal(filterGlobalPermissionsForUser(user, ['sistema.health', 'tickets.visualizar']).includes('sistema.health'), true);
});

test('backend filters obsolete company permissions from regular profiles', () => {
  const regular = makeUser({ perfil: 'atendente', desenvolvedor: false });

  assert.deepEqual(
    filterGlobalPermissionsForUser(regular, ['empresas.criar', 'tickets.visualizar']),
    ['tickets.visualizar']
  );
});
