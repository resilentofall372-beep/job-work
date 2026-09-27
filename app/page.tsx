import Dashboard from "./Dashboard";
import { ensureSchema, listJobs, getMeta } from "@/lib/db";
import type { Job, SyncInfo } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  let jobs: Job[] = [];
  let sync: SyncInfo | null = null;
  let setupError = "";
  try {
    await ensureSchema();
    [jobs, sync] = await Promise.all([listJobs(), getMeta<SyncInfo>("sync")]);
  } catch (e) {
    setupError = e instanceof Error ? e.message : String(e);
  }
  return <Dashboard initialJobs={jobs} initialSync={sync} setupError={setupError} />;
}
