import mysql from 'mysql2/promise';
import dns from 'node:dns';
import net from 'node:net';
import { env } from '../config/env.js';
// O host da Hostinger publica IPv4 e IPv6, mas o ambiente local nao possui
// rota IPv6. Prefere IPv4 e evita a tentativa paralela ENETUNREACH.
dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);
const pool = mysql.createPool({
    host: env.DB.HOST,
    user: env.DB.USER,
    password: env.DB.PASSWORD,
    database: env.DB.NAME,
    port: env.DB.PORT,
    waitForConnections: true,
    connectionLimit: env.DB.CONNECTION_LIMIT,
    queueLimit: env.DB.QUEUE_LIMIT,
    connectTimeout: env.DB.CONNECT_TIMEOUT_MS,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});
export default pool;
