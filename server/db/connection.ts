import mysql from 'mysql2/promise';
import  { env } from  '../config/env.js';

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
