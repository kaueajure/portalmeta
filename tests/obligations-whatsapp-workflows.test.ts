import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('obligation parameters are persisted and generated from selectable frequencies', async () => {
  const [migration, routes, definitions] = await Promise.all([
    readFile('server/db/migrations/049_obligation_definitions.ts', 'utf8'),
    readFile('server/routes/obligations.routes.ts', 'utf8'),
    readFile('server/services/obligation-definitions.service.ts', 'utf8'),
  ]);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS obligation_definitions/);
  assert.match(routes, /router\.post\(\s*'\/definitions'/);
  assert.match(definitions, /quarterly.*quadrimonthly.*semiannual.*annual/s);
  assert.match(definitions, /code: 'SIOPE'.*color: 'rose'/);
  assert.match(definitions, /code: 'SIOPS'.*color: 'emerald'/);
});

test('WhatsApp attendance supports transfer, configurable start, finish and ticket registration', async () => {
  const [routes, service, migration] = await Promise.all([
    readFile('server/routes/whatsapp.routes.ts', 'utf8'),
    readFile('server/services/whatsapp.service.ts', 'utf8'),
    readFile('server/db/migrations/050_whatsapp_attendance_completion.ts', 'utf8'),
  ]);
  assert.match(routes, /\/conversations\/:phone\/transfer/);
  assert.match(routes, /\/conversations\/:phone\/finish/);
  assert.match(routes, /\/conversations\/:phone\/ticket/);
  assert.match(service, /settings\.startMessage/);
  assert.match(service, /registerConversationAsTicket/);
  assert.match(service, /origem: 'whatsapp'/);
  assert.match(migration, /registered_ticket_id/);
});

test('WhatsApp tickets and assignment history are isolated by attendance cycle', async () => {
  const [migration, service] = await Promise.all([
    readFile('server/db/migrations/051_whatsapp_attendance_cycles.ts', 'utf8'),
    readFile('server/services/whatsapp.service.ts', 'utf8'),
  ]);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS whatsapp_attendance_cycles/);
  assert.match(migration, /ADD COLUMN attendance_cycle_id BIGINT NULL AFTER id/);
  assert.match(service, /ensurePendingAttendanceCycle/);
  assert.match(service, /listAttendanceCycleMessages/);
  assert.match(service, /attendanceCycleId: activeCycleId/);
  assert.match(service, /WHERE attendance_cycle_id = \?/);
  assert.match(service, /h\.attendance_cycle_id = s\.attendance_cycle_id/);
  assert.match(service, /UPDATE whatsapp_attendance_cycles SET registered_ticket_id/);
});

test('only the current assignee can transfer tickets and WhatsApp attendances', async () => {
  const [ticketRoutes, ticketService, whatsappService] = await Promise.all([
    readFile('server/routes/tickets.routes.ts', 'utf8'),
    readFile('server/services/tickets.service.ts', 'utf8'),
    readFile('server/services/whatsapp.service.ts', 'utf8'),
  ]);
  assert.match(ticketRoutes, /Somente o responsável atual pode transferir ou remover/);
  assert.match(ticketService, /Number\(currentResponsavelId\) !== Number\(currentUser\.id\)/);
  assert.match(whatsappService, /Number\(session\.assigned_user_id\) !== Number\(actor\.id\)/);
  assert.match(whatsappService, /Somente o responsável atual pode transferir este atendimento/);
});
