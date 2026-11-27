import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { seedDemo } from './demo';

/**
 * قاعدة التطوير: Postgres حقيقي في الذاكرة (PGlite) بنفس مخطط `mahra/supabase`.
 * اللوحة تستدعي دوال القاعدة نفسها (staff_set_commission_paid…) فتُفرض القواعد المالية والصلاحيات
 * كما ستُفرض في الإنتاج. عند اعتماد الاستضافة تُستبدل هذه الطبقة بعميل Postgres/Supabase.
 */
const SUPABASE_DIR = path.resolve(process.cwd(), '../../supabase');

/** موظف تطوير ثابت بدور owner. لا يوجد دخول حقيقي بعد (انظر README). */
export const DEV_STAFF_ID = '00000000-0000-4000-8000-000000000001';

type G = typeof globalThis & { __mohraDb?: Promise<PGlite>; __mohraLock?: Promise<unknown> };
const g = globalThis as G;

async function init(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readFileSync(path.join(SUPABASE_DIR, 'tests/stub.sql'), 'utf8'));
  for (const f of readdirSync(path.join(SUPABASE_DIR, 'migrations')).sort()) {
    await db.exec(readFileSync(path.join(SUPABASE_DIR, 'migrations', f), 'utf8'));
  }
  await db.exec(readFileSync(path.join(SUPABASE_DIR, 'seed.sql'), 'utf8'));
  await db.exec('grant all on all tables in schema public to service_role; grant all on all sequences in schema public to service_role;');
  await seedDemo(db);
  return db;
}

export function getDb(): Promise<PGlite> {
  return (g.__mohraDb ??= init());
}

/**
 * ينفذ كموظف (RLS مفعّلة). التنفيذ متسلسل لأن PGlite اتصال واحد، وتبديل الدور بين طلبين متزامنين يفسد الهوية.
 */
export async function asStaff<T>(fn: (db: PGlite) => Promise<T>): Promise<T> {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_INSECURE_DEV_AUTH !== '1') {
    throw new Error('لوحة المدير بلا دخول حقيقي بعد؛ لا تُشغَّل في الإنتاج.');
  }
  const run = async () => {
    const db = await getDb();
    await db.exec(`select set_config('request.jwt.claim.sub', '${DEV_STAFF_ID}', false); set role authenticated;`);
    try {
      return await fn(db);
    } finally {
      await db.exec('reset role;');
    }
  };
  const next = (g.__mohraLock ?? Promise.resolve()).then(run, run);
  g.__mohraLock = next.catch(() => undefined);
  return next;
}

export async function rows<T>(db: PGlite, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}
