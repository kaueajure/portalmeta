import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
});

console.log('\n== AGORA (hora do servidor DB) ==');
const [[now]] = await conn.query('SELECT NOW() AS agora');
console.log(now.agora);

console.log('\n== CANAL 12 ==');
const [c] = await conn.query(
  `SELECT id, inbound_address, email_publico, status, last_received_at, verified_at FROM empresa_email_canais WHERE id = 12`
);
console.table(c);

console.log('\n== processed_emails total ==');
const [[pc]] = await conn.query('SELECT COUNT(*) AS total FROM processed_emails');
console.log(pc.total);

console.log('\n== ULTIMOS 25 LOGS (qualquer acao) ==');
const [logs] = await conn.query(
  `SELECT id, acao, descricao, created_at FROM logs_sistema ORDER BY id DESC LIMIT 25`
);
for (const l of logs) {
  console.log(`#${l.id} [${l.created_at.toISOString?.() || l.created_at}] ${l.acao} :: ${String(l.descricao).slice(0, 180)}`);
}

console.log('\n== LOGS QUE MENCIONAM 9126e6dc ==');
const [m9] = await conn.query(
  `SELECT id, acao, descricao, created_at FROM logs_sistema WHERE descricao LIKE '%9126e6dc%' ORDER BY id DESC LIMIT 10`
);
console.log('encontrados:', m9.length);
for (const l of m9) console.log(`#${l.id} ${l.acao} :: ${String(l.descricao).slice(0,180)}`);

console.log('\n== LOGS QUE MENCIONAM b357c281 ==');
const [mb] = await conn.query(
  `SELECT id, created_at FROM logs_sistema WHERE descricao LIKE '%b357c281%' ORDER BY id DESC LIMIT 10`
);
console.log('encontrados:', mb.length, '- mais recente:', mb[0]?.created_at);

await conn.end();
console.log('\nDIAG OK');
