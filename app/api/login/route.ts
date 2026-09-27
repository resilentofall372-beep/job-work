import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { timingSafeEqual, createHash } from "node:crypto";
import { createSession, cookieOptions, SESSION_COOKIE } from "@/lib/session";
import { sql, ensureSchema } from "@/lib/db";

export const runtime = "nodejs";

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

function clientIp(req: NextRequest) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
}

async function passwordMatches(input: string): Promise<boolean> {
  const b64 = process.env.APP_PASSWORD_HASH_B64;
  if (b64) {
    const hash = Buffer.from(b64, "base64").toString("utf8");
    return bcrypt.compare(input, hash);
  }
  const plain = process.env.APP_PASSWORD;
  if (!plain) throw new Error("Set APP_PASSWORD or APP_PASSWORD_HASH_B64");
  // Compare fixed-length digests so timing doesn't leak the password length.
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(plain).digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const ip = clientIp(req);

  const rows = (await sql.query(
    "SELECT fails, locked_until FROM login_attempts WHERE ip = $1",
    [ip],
  )) as { fails: number; locked_until: string | null }[];
  const rec = rows[0];
  if (rec?.locked_until && new Date(rec.locked_until) > new Date()) {
    const mins = Math.ceil((new Date(rec.locked_until).getTime() - Date.now()) / 60000);
    return NextResponse.json({ error: `Too many wrong tries. Try again in ${mins} min.` }, { status: 429 });
  }

  let password = "";
  try {
    const body = await req.json();
    password = typeof body.password === "string" ? body.password : "";
  } catch {}

  if (!password || !(await passwordMatches(password))) {
    const fails = (rec?.fails ?? 0) + 1;
    const lock = fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null;
    await sql.query(
      `INSERT INTO login_attempts (ip, fails, locked_until) VALUES ($1, $2, $3)
       ON CONFLICT (ip) DO UPDATE SET fails = $2, locked_until = $3`,
      [ip, lock ? 0 : fails, lock],
    );
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json(
      { error: lock ? `Too many wrong tries. Locked for ${LOCK_MINUTES} min.` : "Wrong password." },
      { status: lock ? 429 : 401 },
    );
  }

  await sql.query("DELETE FROM login_attempts WHERE ip = $1", [ip]);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSession(), cookieOptions);
  return res;
}
