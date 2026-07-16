import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

let dbInitialized = false;

const SQLITE_PRAGMAS = [
  `PRAGMA journal_mode=WAL`,
  `PRAGMA busy_timeout=10000`,
  `PRAGMA synchronous=NORMAL`,
  `PRAGMA cache_size=-20000`,
  `PRAGMA temp_store=MEMORY`,
  `PRAGMA mmap_size=268435456`,
  `PRAGMA foreign_keys=ON`,
];

async function initSqlite() {
  if (dbInitialized) return;
  dbInitialized = true;
  for (const pragma of SQLITE_PRAGMAS) {
    try { await db.$executeRawUnsafe(pragma); } catch { /* ignore */ }
  }
}

initSqlite().catch(() => {});

export async function withRetry<T>(fn: () => Promise<T>, retries = 5, baseDelayMs = 50): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try { return await fn(); }
    catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      const isLockError = /locked|busy|sqlite_busy|could not obtain lock/i.test(msg);
      if (!isLockError || attempt === retries) throw error;
      const delay = Math.min(2000, baseDelayMs * Math.pow(2, attempt) + Math.random() * 50);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('withRetry: unreachable');
}

// In-memory cache for employee data (113K+ records)
let employeeCache: Record<string, unknown>[] | null = null;
let employeeCacheMeta = { rows: 0, cols: 0, fileName: '', loadedAt: '' };

export function getEmployeeCache() { return employeeCache; }
export function getEmployeeCacheMeta() { return employeeCacheMeta; }
export function setEmployeeCache(data: Record<string, unknown>[], meta: { rows: number; cols: number; fileName: string }) {
  employeeCache = data;
  employeeCacheMeta = { ...meta, loadedAt: new Date().toISOString() };
  if (typeof globalThis !== 'undefined') {
    (globalThis as Record<string, unknown>).__employeeCache = data;
    (globalThis as Record<string, unknown>).__employeeCacheMeta = employeeCacheMeta;
  }
}
export function clearEmployeeCache() {
  employeeCache = null;
  employeeCacheMeta = { rows: 0, cols: 0, fileName: '', loadedAt: '' };
}

// Recover from globalThis on HMR
if (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).__employeeCache) {
  employeeCache = (globalThis as Record<string, unknown>).__employeeCache as Record<string, unknown>[];
  employeeCacheMeta = (globalThis as Record<string, unknown>).__employeeCacheMeta as typeof employeeCacheMeta;
}