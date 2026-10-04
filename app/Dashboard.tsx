"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Job, Level, Status, SyncInfo } from "@/lib/types";

const LEVELS: { key: Level; name: string; desc: string }[] = [
  { key: "internship", name: "Internship", desc: "Open to students now" },
  { key: "fresher", name: "Fresher (0 yrs)", desc: "New grad, 2027 batch, entry level" },
  { key: "junior", name: "Needs 1–2 yrs", desc: "Worth a try if the fit is strong" },
  { key: "unknown", name: "Not stated", desc: "Check the posting" },
];
const PLATFORM_COLOR: Record<string, string> = {
  LinkedIn: "--p-linkedin", Naukri: "--p-naukri", Indeed: "--p-indeed", Wellfound: "--p-wellfound",
  Internshala: "--p-internshala", "Career page": "--p-career",
};
const pc = (p: string) => `var(${PLATFORM_COLOR[p] || "--p-other"})`;
const lc = (l: Level) => `var(--l-${l})`;
const ROLES = ["All roles", "ML / AI", "Data Analyst", "Software Engineer"];
const STATUS_FILTERS: [string, string][] = [["open", "To review"], ["applied", "Applied"], ["skip", "Skipped"], ["all", "All"]];

const daysAgo = (d: string | null) => (d ? Math.floor((Date.now() - Date.parse(d)) / 864e5) : 999);
const fmtDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";

export default function Dashboard({
  initialJobs, initialSync, setupError,
}: { initialJobs: Job[]; initialSync: SyncInfo | null; setupError: string }) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [sync, setSync] = useState(initialSync);
  const [levels, setLevels] = useState<Set<Level>>(new Set(["internship", "fresher"]));
  const [platform, setPlatform] = useState<string | null>(null);
  const [role, setRole] = useState("All roles");
  const [status, setStatus] = useState("open");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const platforms = useMemo(() => {
    const m = new Map<string, number>();
    for (const j of jobs) m.set(j.platform, (m.get(j.platform) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [jobs]);

  const statusOk = (j: Job) => {
    const s = j.status || "new";
    return status === "all" || (status === "open" ? s === "new" : s === status);
  };
  const levelCounts = useMemo(() => {
    const c: Record<Level, number> = { internship: 0, fresher: 0, junior: 0, unknown: 0 };
    for (const j of jobs) if ((j.status || "new") === "new") c[j.level]++;
    return c;
  }, [jobs]);

  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    return jobs.filter((j) =>
      levels.has(j.level) &&
      (!platform || j.platform === platform) &&
      (role === "All roles" || j.role === role) &&
      statusOk(j) &&
      (!t || `${j.title} ${j.company} ${j.location}`.toLowerCase().includes(t)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, levels, platform, role, status, q]);

  function toggleLevel(l: Level) {
    const n = new Set(levels);
    if (n.has(l)) n.delete(l); else n.add(l);
    setLevels(n);
  }

  async function mark(id: string, s: Status) {
    const before = jobs;
    setJobs(jobs.map((j) => (j.id === id ? { ...j, status: s } : j)));
    const res = await fetch(`/api/jobs/${encodeURIComponent(id)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: s }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setJobs(before);
      if (res?.status === 401) router.replace("/login");
      else setMsg("Couldn't save that mark. Try again.");
    }
  }

  async function refresh() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/refresh", { method: "POST" }).catch(() => null);
    const body: SyncInfo | null = res ? await res.json().catch(() => null) : null;
    if (res?.status === 401) { router.replace("/login"); return; }
    if (body) setSync(body);
    setMsg(body?.error ? "" : body ? `Checked ${body.emailsScanned} emails, added ${body.added} new ${body.added === 1 ? "job" : "jobs"}.` : "Refresh failed. Try again.");
    const list = await fetch("/api/jobs", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (Array.isArray(list)) setJobs(list);
    setBusy(false);
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const last = sync?.lastSync
    ? new Date(sync.lastSync).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    : "never";

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <h1>Job Radar</h1>
          <p className="sub">Openings from your LinkedIn, Naukri, Indeed and Wellfound alerts. ML / AI · Data Analyst · Software Engineer.</p>
        </div>
        <div className="side">
          <div className="sync"><b>{jobs.length}</b> openings · last refresh {last}</div>
          <div className="actions">
            <button className="btn primary" onClick={refresh} disabled={busy}>{busy ? "Checking Gmail…" : "Refresh now"}</button>
            <button className="btn" onClick={logout}>Log out</button>
          </div>
        </div>
      </header>

      {setupError && <div className="alert" role="alert">Setup needed: {setupError}</div>}
      {sync?.error && <div className="alert" role="alert">Last refresh failed: {sync.error}</div>}
      {msg && <div className="hint" role="status">{msg}</div>}
      {!!sync?.unread?.length && (
        <div className="hint">
          {sync.unread.length} job alert {sync.unread.length === 1 ? "email" : "emails"} couldn&apos;t be read automatically:{" "}
          {sync.unread.slice(0, 3).map((u, i) => (
            <span key={i}>{i > 0 && ", "}<a href={u.link} target="_blank" rel="noopener noreferrer">{u.from}: {u.subject}</a></span>
          ))}
        </div>
      )}

      <section className="levels" aria-label="Who can apply">
        {LEVELS.map((l) => (
          <button key={l.key} className="level" style={{ ["--lc" as string]: lc(l.key) }} aria-pressed={levels.has(l.key)} onClick={() => toggleLevel(l.key)}>
            <span className="nm">{l.name}</span>
            <span className="ct">{levelCounts[l.key]}</span>
            <span className="ds">{l.desc}</span>
          </button>
        ))}
      </section>

      <section className="controls">
        <div className="seg" role="group" aria-label="Platform">
          <button className="chip" aria-pressed={!platform} onClick={() => setPlatform(null)}>All platforms</button>
          {platforms.map(([p, n]) => (
            <button key={p} className="chip" style={{ ["--pc" as string]: pc(p) }} aria-pressed={platform === p} onClick={() => setPlatform(platform === p ? null : p)}>
              <span className="dot" />{p}<span className="n">{n}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="controls">
        <div className="seg" role="group" aria-label="Role">
          {ROLES.map((r) => <button key={r} className="chip" aria-pressed={role === r} onClick={() => setRole(r)}>{r}</button>)}
        </div>
        <div className="seg" role="group" aria-label="Status">
          {STATUS_FILTERS.map(([k, l]) => <button key={k} className="chip" aria-pressed={status === k} onClick={() => setStatus(k)}>{l}</button>)}
        </div>
        <input id="search" className="search" type="search" placeholder="Search company, title, city" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      </section>

      <section className="list" aria-live="polite">
        {!visible.length && <div className="empty">{jobs.length ? "Nothing matches these filters." : "No openings yet. Press Refresh now to read your alert emails."}</div>}
        {visible.map((j) => {
          const s = j.status || "new";
          const lv = LEVELS.find((l) => l.key === j.level)!;
          return (
            <article key={j.id} className={`row${s === "skip" ? " skip" : ""}`} style={{ ["--pc" as string]: pc(j.platform) }}>
              <span className="bar" />
              <div className="main">
                <div className="t">
                  <a href={j.link} target="_blank" rel="noopener noreferrer" onClick={() => s === "new" && mark(j.id, "applied")}>{j.title}</a>
                  <span className="co">{j.company}</span>
                  <span className="badge" style={{ ["--lc" as string]: lc(j.level) }}>{lv.name}</span>
                  {daysAgo(j.posted) <= 2 && <span className="fresh">New</span>}
                </div>
                <div className="meta">
                  <span className="pf">{j.platform}</span>
                  <span>{j.role}</span>
                  {j.location && <span>{j.location}</span>}
                  {j.pay && <span>{j.pay}</span>}
                  {j.exp && <span>{j.exp}</span>}
                  <span className="dt">{fmtDate(j.posted)}</span>
                </div>
              </div>
              <div className="st" role="group" aria-label="Mark">
                {(["new", "applied", "skip"] as Status[]).map((k) => (
                  <button key={k} data-s={k} aria-pressed={s === k} onClick={() => s !== k && mark(j.id, k)}>
                    {k === "new" ? "New" : k === "applied" ? "Applied" : "Skip"}
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <p className="foot">Refreshes every morning at 7:45 AM IST from your Gmail job alerts. Jobs asking for 3+ years and senior roles are left out. Indeed alerts open the original email, which holds the apply link.</p>
    </div>
  );
}
