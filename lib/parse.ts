import type { Candidate } from "@/lib/classify";

export type Email = {
  id: string;
  from: string;
  subject: string;
  text: string;       // plain text, links kept as "<url>" or bare urls
  date: string;       // ISO
  gmailLink: string;
};

export type ParseResult = { platform: string | null; isJobAlert: boolean; jobs: Candidate[] };

const blank = (): Candidate => ({ title: "", company: "", location: "", pay: "", exp: "", jobType: "", link: "", extId: "" });
const clean = (s: string) => s.replace(/‌|͏| /g, " ").replace(/\s+/g, " ").trim();

export function platformOf(from: string): string | null {
  const f = from.toLowerCase();
  if (f.includes("linkedin.com")) return "LinkedIn";
  if (f.includes("naukri.com")) return "Naukri";
  if (f.includes("indeed.com")) return "Indeed";
  if (f.includes("wellfound.com") || f.includes("angel.co")) return "Wellfound";
  if (f.includes("internshala.com")) return "Internshala";
  if (f.includes("instahyre.com")) return "Instahyre";
  if (f.includes("unstop.com")) return "Unstop";
  return null;
}

export function parseEmail(e: Email): ParseResult {
  const platform = platformOf(e.from);
  if (!platform) return { platform, isJobAlert: false, jobs: [] };
  switch (platform) {
    case "Wellfound": return { platform, ...parseWellfound(e) };
    case "Indeed": return { platform, ...parseIndeed(e) };
    case "LinkedIn": return { platform, ...parseByLinks(e, /https?:\/\/(?:[a-z]+\.)?linkedin\.com\/(?:comm\/)?jobs\/view\/(\d+)[^\s>)"]*/gi, isLinkedInAlert(e)) };
    case "Naukri": return { platform, ...parseByLinks(e, /https?:\/\/(?:www\.)?naukri\.com\/job-listings-[a-z0-9-]*?-(\d{9,})[^\s>)"]*/gi, /job alert|new jobs?|jobs? (for you|matching|based on)|recommended jobs|jobs? you may|openings? (for|at|in)|is hiring|are hiring/i.test(e.subject) && !/shortlist|resume|contest|blog|event|app\b|study|english|webinar/i.test(e.subject)) };
    case "Internshala": return { platform, ...parseByLinks(e, /https?:\/\/(?:www\.)?internshala\.com\/(?:job|internship)\/detail\/([a-z0-9-]+)[^\s>)"]*/gi, /job|internship/i.test(e.subject)) };
    default: return { platform, ...parseByLinks(e, /https?:\/\/(?:www\.)?(?:instahyre|unstop)\.com\/(?:job|jobs|opportunit\w*)\/([a-z0-9-]+)[^\s>)"]*/gi, /job|opening|hiring/i.test(e.subject)) };
  }
}

function isLinkedInAlert(e: Email) {
  return /jobalerts|jobs-listings|jobs-noreply/i.test(e.from) || /job alert|new jobs|jobs? (for|in|matching)|is hiring|similar to/i.test(e.subject);
}

/* ---------- Wellfound: blocks ending in "Learn More <https://wellfound.com/jobs?job_listing_slug=ID-...>" ---------- */
function parseWellfound(e: Email) {
  const isJobAlert = /new jobs?/i.test(e.subject) || e.text.includes("job_listing_slug=");
  const jobs: Candidate[] = [];
  const re = /job_listing_slug=(\d+)-[a-z0-9-]*/gi;
  const text = e.text;
  let last = 0;
  let m: RegExpExecArray | null;
  const markers: { idx: number; id: string; url: string }[] = [];
  while ((m = re.exec(text))) markers.push({ idx: m.index, id: m[1], url: `https://wellfound.com/jobs?${m[0]}` });
  for (const mk of markers) {
    // Block = text between previous marker and this one.
    const block = text.slice(last, mk.idx);
    last = mk.idx + 1;
    const lines = block.split("\n").map(clean).filter((l) => l && !/^<?https?:/.test(l) && !/^learn more/i.test(l) && !/^>/.test(l));
    const iCo = lines.findIndex((l) => /\/\s*[\d,+-]+\s*employees/i.test(l));
    if (iCo < 1) continue;
    const c = blank();
    c.title = lines[iCo - 1];
    c.company = lines[iCo].split("/")[0].trim();
    // The detail line can wrap onto the next line in plain-text emails; join until the badges start.
    const detail = lines.slice(iCo + 1).join(" ").split(/\b(?:Actively Hiring|Responds within|Top \d+%|Recently funded|Early Stage|Growth Stage|Scale Stage|B2B)\b/)[0];
    const parts = detail.split("|").map((p) => p.trim());
    // "₹8L–₹10L | Remote only, India | 2 years of exp | Full-time"
    c.pay = parts[0] || "";
    c.location = (parts[1] || "")
      .replace(/^remote only,?\s*/i, "Remote, ")
      .replace(/^(in office|onsite or remote),?\s*/i, "")
      .replace(/,\s*$/, "");
    c.exp = /\d/.test(parts[2] || "") ? parts[2] : "";
    c.jobType = parts[3] || "";
    c.link = mk.url;
    c.extId = mk.id;
    jobs.push(c);
  }
  return { isJobAlert, jobs };
}

/* ---------- Indeed: single-job "Title @ Company" emails, or multi-job alert digests ---------- */
function parseIndeed(e: Email) {
  const single = e.subject.match(/^(.+?)\s+@\s+(.+)$/);
  if (single) {
    const c = blank();
    c.title = clean(single[1]);
    c.company = clean(single[2].replace(/\s*-\s*\(.*\)$/, ""));
    const pay = e.text.match(/(?:from\s+)?₹[\d,]+(?:\s*-\s*₹[\d,]+)?\s+an?\s+(?:year|month|hour)/i);
    c.pay = pay ? pay[0] : "";
    const loc = c.title.match(/\((remote|hybrid)\)/i);
    if (loc) c.location = loc[1][0].toUpperCase() + loc[1].slice(1);
    const link = e.text.match(/https?:\/\/[^\s>)"]*indeed\.com\/[^\s>)"]*(?:viewjob|jk=|rc\/clk|pagead|applystart)[^\s>)"]*/i);
    c.link = link ? link[0] : e.gmailLink;
    c.exp = /fresher/i.test(e.subject + " " + e.text.slice(0, 400)) ? "Fresher" : "";
    c.extId = (link && link[0].match(/jk=([a-z0-9]+)/i)?.[1]) || "";
    return { isJobAlert: true, jobs: [c] };
  }
  return parseByLinks(e, /https?:\/\/[^\s>)"]*indeed\.com\/[^\s>)"]*jk=([a-z0-9]+)[^\s>)"]*/gi, /job|alert/i.test(e.subject));
}

/* ---------- Generic: every job link, with title/company/location taken from the lines just above it ---------- */
const NOISE = /^(view job|apply( now)?|easy apply|promoted|actively recruiting|be an early applicant|\d+ (applicants?|connections?|school alumni).*|see all jobs|see more jobs|new|save|learn more|view details|view & apply|apply with.*|.*ago)$/i;

function parseByLinks(e: Email, linkRe: RegExp, isJobAlert: boolean) {
  const jobs: Candidate[] = [];
  const seen = new Set<string>();
  const lines = e.text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    linkRe.lastIndex = 0;
    const m = linkRe.exec(lines[i]);
    if (!m) continue;
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    const before: string[] = [];
    const sameLine = clean(lines[i].slice(0, m.index).replace(/<$/, "").replace(/view job:?/i, ""));
    if (sameLine && !NOISE.test(sameLine)) before.unshift(sameLine);
    for (let k = i - 1; k >= 0 && before.length < 4 && k >= i - 10; k--) {
      const l = clean(lines[k]);
      if (/https?:\/\//.test(l)) break; // reached the previous job's link
      if (!l || NOISE.test(l)) continue;
      before.unshift(l);
    }
    const c = blank();
    const [a, b, d] = before.slice(-3);
    c.title = a || titleFromSlug(m[0]);
    c.company = b || "";
    c.location = d || "";
    const expM = before.join(" ").match(/\d+\s*(?:-|–|to)\s*\d+\s*(?:yrs?|years?)|fresher/i);
    c.exp = expM ? expM[0] : "";
    c.link = m[0].replace(/[.,]$/, "");
    c.extId = id;
    if (c.title) jobs.push(c);
  }
  return { isJobAlert: isJobAlert || jobs.length > 0, jobs };
}

function titleFromSlug(url: string) {
  const slug = url.match(/(?:job-listings-|detail\/)([a-z0-9-]+)/i)?.[1] || "";
  return slug.replace(/-\d{6,}$/, "").split("-").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
}
