import { PoolConnection } from 'mysql2/promise';

async function columnExists(connection: PoolConnection, table: string, column: string): Promise<boolean> {
  const [rows]: any = await connection.query(`
    SELECT COUNT(*) as count
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = ?
    AND COLUMN_NAME = ?
  `, [table, column]);
  return Number(rows[0]?.count || 0) > 0;
}

function buildInitials(value: string): string {
  const words = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);

  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 6).toUpperCase();

  return words.map(word => word[0]).join('').slice(0, 6).toUpperCase();
}

function splitNameAndSigla(rawName: string): { nome: string; sigla: string } {
  const nome = String(rawName || '').trim();
  const suffixMatch = nome.match(/^(.*?)\s*-\s*([A-Za-z0-9]{1,6})$/);
  const parenthesisMatch = nome.match(/^(.*?)\s*\(([A-Za-z0-9]{1,6})\)$/);
  const match = suffixMatch || parenthesisMatch;

  if (match) {
    return {
      nome: match[1].trim() || nome,
      sigla: match[2].trim().toUpperCase(),
    };
  }

  return {
    nome,
    sigla: buildInitials(nome),
  };
}

export async function up(connection: PoolConnection) {
  if (!await columnExists(connection, 'empresa_ticket_categorias', 'sigla')) {
    await connection.query('ALTER TABLE empresa_ticket_categorias ADD COLUMN sigla VARCHAR(6) NULL AFTER nome');
  }

  const [rows]: any = await connection.query('SELECT id, nome, sigla FROM empresa_ticket_categorias');

  for (const row of rows) {
    if (row.sigla) continue;

    const parsed = splitNameAndSigla(row.nome);
    if (!parsed.sigla) continue;

    await connection.query(
      'UPDATE empresa_ticket_categorias SET nome = ?, sigla = ? WHERE id = ?',
      [parsed.nome, parsed.sigla, row.id],
    );
  }
}
