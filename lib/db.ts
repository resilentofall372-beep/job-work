import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import seedJobs from "@/data/seed-jobs.json";
import type { Job } from "@/lib/types";

let _sql: NeonQueryFunction<false, false> | null = null;
function client() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Connect a Neon database to this Vercel project.");
    _sql = neon(url);
  }
  return _sql;
}

/** Parameterised query helper: sql.query("... $1", [value]) */
export const sql = {
  query: (text: string, params: unknown[] = []) => client().query(text, params) as Promise<Record<string, any>[]>,
};

let ready: Promise<void> | null = null;
export function ensureSchema() {
  if (!ready) ready = init().catch((e) => { ready = null; throw e; });
  return ready;
}

async function init() {
  await sql.query(`CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    dedupe_key TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    company TEXT NOT NULL DEFAULT '',
    platform TEXT NOT NULL,
    role TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'unknown',
    location TEXT NOT NULL DEFAULT '',
    pay TEXT NOT NULL DEFAULT '',
    exp TEXT NOT NULL DEFAULT '',
    posted DATE,
    link TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'new',
    status_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await sql.query(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value JSONB NOT NULL)`);
  await sql.query(`CREATE TABLE IF NOT EXISTS processed_emails (id TEXT PRIMARY KEY, seen_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await sql.query(`CREATE TABLE IF NOT EXISTS login_attempts (ip TEXT PRIMARY KEY, fails INT NOT NULL DEFAULT 0, locked_until TIMESTAMPTZ)`);

  const seeded = await sql.query(`SELECT 1 FROM meta WHERE key = 'seeded'`);
  if (!seeded.length) {
    for (const j of seedJobs as Job[]) await insertJob(j);
    await sql.query(`INSERT INTO meta (key, value) VALUES ('seeded', 'true'::jsonb) ON CONFLICT DO NOTHING`);
  }
}

/** Inserts a job unless one with the same id or company+title already exists. Returns true if added. */
export async function insertJob(j: Job): Promise<boolean> {
  const rows = await sql.query(
    `INSERT INTO jobs (id, dedupe_key, title, company, platform, role, level, location, pay, exp, posted, link, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'new')
     ON CONFLICT DO NOTHING RETURNING id`,
    [j.id, dedupeKey(j.company, j.title), j.title, j.company, j.platform, j.role, j.level,
     j.location, j.pay, j.exp, j.posted || null, j.link],
  );
  return rows.length > 0;
}

export function dedupeKey(company: string, title: string) {
  const n = (s: string) => s.toLowerCase().replace(/\((remote|hybrid|onsite)\)/g, "").replace(/[^a-z0-9]+/g, "");
  return `${n(company)}|${n(title)}`;
}

export async function listJobs(): Promise<Job[]> {
  const rows = await sql.query(
    `SELECT id, title, company, platform, role, level, location, pay, exp,
            to_char(posted, 'YYYY-MM-DD') AS posted, link, status
     FROM jobs ORDER BY posted DESC NULLS LAST, created_at DESC LIMIT 2000`,
  );
  return rows as Job[];
}

export async function getMeta<T>(key: string): Promise<T | null> {
  const rows = await sql.query(`SELECT value FROM meta WHERE key = $1`, [key]);
  return rows.length ? (rows[0].value as T) : null;
}

export async function setMeta(key: string, value: unknown) {
  await sql.query(
    `INSERT INTO meta (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, JSON.stringify(value)],
  );
}
