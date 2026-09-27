import { fetchAlertEmails } from "@/lib/gmail";
import { parseEmail, type Email } from "@/lib/parse";
import { classifyLevel, classifyRole, inIndiaOrRemote, type Candidate } from "@/lib/classify";
import { ensureSchema, insertJob, getMeta, setMeta, sql } from "@/lib/db";
import type { Job, SyncInfo } from "@/lib/types";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

/** Turns one parsed candidate into a Job, or null if it isn't a fit. */
export function toJob(c: Candidate, platform: string, email: Pick<Email, "date">): Job | null {
  if (!c.title) return null;
  const role = classifyRole(c.title);
  if (!role) return null;
  const level = classifyLevel(c);
  if (!level) return null;
  if (!inIndiaOrRemote(c.location)) return null;
  const id = `${slug(platform)}-${c.extId ? slug(c.extId) : slug(`${c.company}-${c.title}`)}`;
  return {
    id,
    title: c.title,
    company: c.company,
    platform,
    role,
    level,
    location: c.location,
    pay: c.pay,
    exp: c.exp,
    posted: email.date.slice(0, 10),
    link: c.link,
  };
}

export async function runIngest(): Promise<SyncInfo> {
  await ensureSchema();
  const prev = await getMeta<SyncInfo>("sync");
  // First run looks back 30 days; later runs look back 3 days (overlap is harmless, emails are only read once).
  const days = prev ? 3 : 30;
  const seenRows = await sql.query(`SELECT id FROM processed_emails WHERE seen_at > now() - interval '40 days'`);
  const skip = new Set(seenRows.map((r) => r.id as string));

  const info: SyncInfo = { lastSync: new Date().toISOString(), emailsScanned: 0, added: 0, unread: prev?.unread?.slice(0, 10) ?? [] };
  try {
    const emails = await fetchAlertEmails(days, skip);
    info.emailsScanned = emails.length;
    for (const e of emails) {
      const r = parseEmail(e);
      if (r.isJobAlert && r.platform && r.jobs.length === 0) {
        info.unread.unshift({ subject: e.subject, from: r.platform, link: e.gmailLink });
      }
      for (const c of r.jobs) {
        const job = r.platform ? toJob(c, r.platform, e) : null;
        if (job && (await insertJob(job))) info.added++;
      }
      await sql.query(`INSERT INTO processed_emails (id) VALUES ($1) ON CONFLICT DO NOTHING`, [e.id]);
    }
    info.unread = info.unread.slice(0, 10);
    await sql.query(`DELETE FROM processed_emails WHERE seen_at < now() - interval '60 days'`);
  } catch (err) {
    info.error = err instanceof Error ? err.message : String(err);
  }
  await setMeta("sync", info);
  return info;
}
