import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const runtimeFiles = [
  'server/routes/obligations.routes.ts',
  'src/components/pages/ObligationsDashboardPage.tsx',
  'src/components/pages/ObligationsMunicipalitiesPage.tsx',
  'src/components/pages/ObligationsSpreadsheetPage.tsx',
];

test('obligations runtime does not depend on a fixed responsible user', async () => {
  for (const path of runtimeFiles) {
    const source = await readFile(path, 'utf8');
    assert.doesNotMatch(source, /respons(?:ible|avel|ável)/i, `${path} still contains responsibility logic`);
  }
});

test('obligations writes are permission-gated and use optimistic versions', async () => {
  const source = await readFile('server/routes/obligations.routes.ts', 'utf8');
  assert.match(source, /requirePermission\('obrigacoes\.municipios\.criar'\)/);
  assert.match(source, /requirePermission\('obrigacoes\.municipios\.editar'\)/);
  assert.match(source, /requirePermission\('obrigacoes\.municipios\.excluir'\)/);
  assert.match(source, /requirePermission\('obrigacoes\.planilha\.editar'\)/);
  assert.match(source, /version = version \+ 1/g);
  assert.match(source, /alterad[oa] por outra pessoa/i);
});

test('responsibility removal migration archives legacy data before dropping the column', async () => {
  const source = await readFile('server/db/migrations/048_obligations_remove_fixed_responsibility.ts', 'utf8');
  assert.match(source, /obligation_legacy_responsibility_archive/);
  assert.match(source, /INSERT IGNORE INTO obligation_legacy_responsibility_archive/);
  assert.match(source, /DROP COLUMN responsible_config/);
  assert.match(source, /obligation_municipality_history/);
});
