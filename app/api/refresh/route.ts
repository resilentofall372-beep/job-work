import { NextResponse } from "next/server";
import { runIngest } from "@/lib/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// "Refresh now" button. Protected by the login middleware.
export async function POST() {
  const info = await runIngest();
  return NextResponse.json(info, { status: info.error ? 500 : 200 });
}
