import { PoolConnection } from 'mysql2/promise';

const BIMONTHLY = ['1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre', '5º Bimestre', '6º Bimestre'];
const DEFAULT_OBLIGATION_DEFINITIONS = [
  { code: 'MSC', name: 'Matriz de Saldos Contábeis', frequency: 'monthly', color: 'blue', competences: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro', 'Encerramento'] },
  { code: 'RREO', name: 'Relatório Resumido de Execução Orçamentária', frequency: 'bimonthly', color: 'cyan', competences: BIMONTHLY },
  { code: 'RGF', name: 'Relatório de Gestão Fiscal', frequency: 'quadrimonthly', color: 'violet', competences: ['1º Quadrimestre', '2º Quadrimestre', '3º Quadrimestre'] },
  { code: 'DCA', name: 'Declaração de Contas Anuais', frequency: 'annual', color: 'amber', competences: ['Anual'] },
  { code: 'SIOPE', name: 'Educação', frequency: 'bimonthly', color: 'rose', competences: BIMONTHLY },
  { code: 'SIOPS', name: 'Saúde', frequency: 'bimonthly', color: 'emerald', competences: BIMONTHLY },
];

export async function up(connection: PoolConnection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS obligation_definitions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(20) NOT NULL,
      name VARCHAR(255) NOT NULL,
      frequency VARCHAR(30) NOT NULL,
      color VARCHAR(30) NOT NULL DEFAULT 'blue',
      competences_json JSON NOT NULL,
      system TINYINT(1) NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 100,
      created_by INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_obligation_definitions_code (code),
      INDEX idx_obligation_definitions_active_order (active, sort_order),
      CONSTRAINT fk_obligation_definitions_created_by
        FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  for (const [index, definition] of DEFAULT_OBLIGATION_DEFINITIONS.entries()) {
    await connection.query(
      `INSERT INTO obligation_definitions
        (code, name, frequency, color, competences_json, system, sort_order)
       VALUES (?, ?, ?, ?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), frequency = VALUES(frequency),
         color = VALUES(color), competences_json = VALUES(competences_json), system = 1`,
      [definition.code, definition.name, definition.frequency, definition.color,
       JSON.stringify(definition.competences), (index + 1) * 10],
    );
  }
}
