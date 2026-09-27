import { NextResponse, type NextRequest } from "next/server";
import { sql, ensureSchema } from "@/lib/db";

export const runtime = "nodejs";

const STATUSES = new Set(["new", "applied", "skip"]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let status = "";
  try {
    status = (await req.json()).status;
  } catch {}
  if (!STATUSES.has(status)) return NextResponse.json({ error: "status must be new, applied or skip" }, { status: 400 });
  await ensureSchema();
  const rows = await sql.query(`UPDATE jobs SET status = $1, status_at = now() WHERE id = $2 RETURNING id`, [status, id]);
  if (!rows.length) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
