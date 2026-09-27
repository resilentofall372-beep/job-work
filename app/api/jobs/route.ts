import { NextResponse } from "next/server";
import { ensureSchema, listJobs } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSchema();
  return NextResponse.json(await listJobs());
}
