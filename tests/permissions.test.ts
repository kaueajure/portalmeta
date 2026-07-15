import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessAppScreen, hasAllPermissions, hasAnyPermission, hasPermission } from '../src/lib/permissions.ts';
import {
  filterGlobalPermissionsForUser,
  isGlobalOnlyPermission,
  resolveEffectivePermissionKeys
} from '../server/services/permissions.service.ts';
import { isDeveloperUser } from '../server/utils/user-scope.ts';
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

test('desenvolvedor is the only global user scope', () => {
  assert.equal(isDeveloperUser(makeUser({ desenvolvedor: true })), true);
  assert.equal(isDeveloperUser(makeUser({ perfil: 'desenvolvedor' })), true);
  assert.equal(isDeveloperUser(makeUser({ administrador: true, perfil: 'administrador' })), false);
});

test('desenvolvedor can access global permissions', () => {
  const user = makeUser({ desenvolvedor: true, permissions: [] });

  assert.equal(hasPermission(user, 'sistema.health'), true);
  assert.equal(hasPermission(user, 'empresas.criar'), true);
  assert.equal(hasPermission(user, 'tickets.visualizar'), true);
});

test('tenant wildcard does not grant global-only permissions', () => {
  const user = makeUser({
    administrador: true,
    perfil: 'administrador',
    permissions: ['*'],
  });

  assert.equal(hasPermission(user, 'tickets.visualizar'), true);
  assert.equal(hasPermission(user, 'ticket_mensagens.responder'), true);
  assert.equal(hasPermission(user, 'sistema.health'), false);
  assert.equal(hasPermission(user, 'telas.visualizar'), false);
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

test('companies screen is visible only to developer users', () => {
  const regularWithCompanyPermission = makeUser({
    permissions: ['empresas.visualizar'],
  });
  const developer = makeUser({
    perfil: 'desenvolvedor',
    desenvolvedor: true,
    permissions: [],
  });

  assert.equal(hasPermission(regularWithCompanyPermission, 'empresas.visualizar'), true);
  assert.equal(canAccessAppScreen(regularWithCompanyPermission, 'companies'), false);
  assert.equal(canAccessAppScreen(developer, 'companies'), true);
});

test('hasAnyPermission and hasAllPermissions respect global-only wildcard exclusions', () => {
  const user = makeUser({ permissions: ['*'] });

  assert.equal(hasAnyPermission(user, ['sistema.health', 'tickets.visualizar']), true);
  assert.equal(hasAllPermissions(user, ['tickets.visualizar', 'ticket_mensagens.responder']), true);
  assert.equal(hasAllPermissions(user, ['tickets.visualizar', 'sistema.health']), false);
});

test('backend classifies SaaS-global permissions centrally', () => {
  assert.equal(isGlobalOnlyPermission('*'), true);
  assert.equal(isGlobalOnlyPermission('empresas.criar'), true);
  assert.equal(isGlobalOnlyPermission('sistema.health'), true);
  assert.equal(isGlobalOnlyPermission('telas.precos.editar'), true);
  assert.equal(isGlobalOnlyPermission('tickets.visualizar'), false);
});

test('backend filters explicit global overrides for non-developers', () => {
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

  assert.deepEqual(effective.sort(), ['tickets.editar', 'tickets.visualizar'].sort());
  assert.equal(filterGlobalPermissionsForUser(user, ['sistema.health', 'tickets.visualizar']).includes('sistema.health'), false);
});

test('backend keeps global permissions available only for developers', () => {
  const developer = makeUser({ perfil: 'desenvolvedor', desenvolvedor: true });
  const regular = makeUser({ perfil: 'atendente', desenvolvedor: false });

  assert.deepEqual(resolveEffectivePermissionKeys(developer, [], []), ['*']);
  assert.deepEqual(
    filterGlobalPermissionsForUser(regular, ['empresas.criar', 'tickets.visualizar']),
    ['tickets.visualizar']
  );
});
