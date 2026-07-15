import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDateTimeForMySQL, addMinutesForMySQL } from '../server/utils/date-time.ts';
import { normalizeOutboxProcessLimit, validateTicketEmailOutboxParams } from '../server/services/email-outbox.service.ts';
import { normalizeMessagePagination } from '../server/utils/pagination.ts';

test('formatDateTimeForMySQL formats local time without UTC ISO conversion', () => {
  const date = new Date(2026, 6, 4, 9, 8, 7);
  assert.equal(formatDateTimeForMySQL(date), '2026-07-04 09:08:07');
  assert.match(formatDateTimeForMySQL(date), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});

test('addMinutesForMySQL adds minutes using local Date semantics', () => {
  const date = new Date(2026, 6, 4, 23, 50, 0);
  assert.equal(addMinutesForMySQL(20, date), '2026-07-05 00:10:00');
});

test('outbox validation rejects invalid recipient and missing dedupe key', () => {
  const base = {
    empresaId: 1,
    ticketId: 10,
    to: 'cliente@example.com',
    type: 'agent_reply' as const,
    title: 'Chamado',
  };

  assert.deepEqual(validateTicketEmailOutboxParams({ ...base, to: 'invalido', dedupeKey: 'k1' }), {
    ok: false,
    error: 'Destinatario de e-mail invalido.',
  });

  assert.deepEqual(validateTicketEmailOutboxParams(base), {
    ok: false,
    error: 'Chave de deduplicacao ausente para e-mail de chamado.',
  });

  assert.deepEqual(validateTicketEmailOutboxParams({ ...base, dedupeKey: 'ticket:10:reply:1' }), {
    ok: true,
    dedupeKey: 'ticket:10:reply:1',
  });
});

test('outbox validation rejects missing core ticket fields', () => {
  const valid = {
    empresaId: 1,
    ticketId: 10,
    to: 'cliente@example.com',
    type: 'agent_reply' as const,
    title: 'Chamado',
    dedupeKey: 'ticket:10:reply:1',
  };

  assert.equal(validateTicketEmailOutboxParams({ ...valid, empresaId: 0 }).ok, false);
  assert.equal(validateTicketEmailOutboxParams({ ...valid, ticketId: 0 }).ok, false);
  assert.equal(validateTicketEmailOutboxParams({ ...valid, type: '' as any }).ok, false);
  assert.equal(validateTicketEmailOutboxParams({ ...valid, title: '' }).ok, false);
  assert.deepEqual(validateTicketEmailOutboxParams(valid), {
    ok: true,
    dedupeKey: 'ticket:10:reply:1',
  });
});

test('normalizeOutboxProcessLimit clamps unsafe limits', () => {
  assert.equal(normalizeOutboxProcessLimit(undefined), 20);
  assert.equal(normalizeOutboxProcessLimit(-1), 20);
  assert.equal(normalizeOutboxProcessLimit(500), 50);
  assert.equal(normalizeOutboxProcessLimit(7), 7);
});

test('normalizeMessagePagination defaults and clamps safely', () => {
  assert.deepEqual(normalizeMessagePagination({}), { limit: 50, beforeId: undefined, page: 1, offset: 0 });
  assert.deepEqual(normalizeMessagePagination({ limit: '500', page: '2' }), { limit: 100, beforeId: undefined, page: 2, offset: 100 });
  assert.deepEqual(normalizeMessagePagination({ limit: '25', before_id: '99' }), { limit: 25, beforeId: 99, page: 1, offset: 0 });
});
