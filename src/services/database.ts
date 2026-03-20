import mysql, { Pool, PoolOptions, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getConfig } from "../config.js";

const pools: Map<string, Pool> = new Map();

export type DbName = "auth" | "characters" | "world";

function getDbNameFromConfig(db: DbName): string {
  const config = getConfig();
  switch (db) {
    case "auth":
      return config.database.auth;
    case "characters":
      return config.database.characters;
    case "world":
      return config.database.world;
  }
}

function createPool(db: DbName): Pool {
  const config = getConfig();
  const dbName = getDbNameFromConfig(db);

  const opts: PoolOptions = {
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: dbName,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    multipleStatements: false,
  };

  return mysql.createPool(opts);
}

export function getPool(db: DbName): Pool {
  let pool = pools.get(db);
  if (!pool) {
    pool = createPool(db);
    pools.set(db, pool);
  }
  return pool;
}

/** Reset all pools (e.g., after config change) */
export async function resetPools(): Promise<void> {
  for (const [, pool] of pools) {
    await pool.end();
  }
  pools.clear();
}

/** Execute a SELECT query and return rows */
export async function query(
  db: DbName,
  sql: string,
  params?: unknown[]
): Promise<RowDataPacket[]> {
  const pool = getPool(db);
  const [rows] = await pool.execute<RowDataPacket[]>(sql, (params || []) as any[]);
  return rows;
}

/** Execute an INSERT/UPDATE/DELETE and return result info */
export async function execute(
  db: DbName,
  sql: string,
  params?: unknown[]
): Promise<{ affectedRows: number; insertId: number; info: string }> {
  const pool = getPool(db);
  const [result] = await pool.execute<ResultSetHeader>(sql, (params || []) as any[]);
  return {
    affectedRows: result.affectedRows,
    insertId: result.insertId,
    info: result.info,
  };
}

/** Execute raw SQL (for DDL, complex queries, etc.) — returns raw result */
export async function executeRaw(
  db: DbName,
  sql: string,
  params?: unknown[]
): Promise<unknown> {
  const pool = getPool(db);
  const [result] = await pool.query(sql, params || []);
  return result;
}

/** Test connection to a specific database */
export async function testConnection(db: DbName): Promise<boolean> {
  try {
    const pool = getPool(db);
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    return true;
  } catch {
    return false;
  }
}
