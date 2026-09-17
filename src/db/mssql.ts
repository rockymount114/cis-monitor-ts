import sql from 'mssql';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) return pool;
  logger.info(`Connecting to MSSQL ${config.db.server}/${config.db.database}`);
  pool = new sql.ConnectionPool(config.db as any);
  pool.on('error', err => logger.error(`MSSQL pool error: ${err.message}`));
  await pool.connect();
  return pool;
}

export async function closePool() {
  if (pool) { await pool.close(); pool = null; }
}