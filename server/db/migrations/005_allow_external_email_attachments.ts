import { PoolConnection } from 'mysql2/promise';

export async function up(connection: PoolConnection) {
  // Alteramos usuario_id para NULL para suportar anexos de e-mails externos (sem usuário logado)
  await connection.query(`
    ALTER TABLE ticket_anexos 
    MODIFY COLUMN usuario_id INT NULL;
  `);

  // Se houver FK que impeça o delete ou force restrições, garantimos que ela permita NULL
  // No nosso esquema atual, a FK já costuma estar definida. 
  // Caso queira garantir que o delete do usuário não apague o anexo (opcional):
  // ALTER TABLE ticket_anexos DROP FOREIGN KEY fk_anexos_usuario;
  // ALTER TABLE ticket_anexos ADD CONSTRAINT fk_anexos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;
}

export async function down(connection: PoolConnection) {
  // Para fins de rollback, não voltamos para NOT NULL se houver dados nulos
  // await connection.query(`ALTER TABLE ticket_anexos MODIFY COLUMN usuario_id INT NOT NULL;`);
}
