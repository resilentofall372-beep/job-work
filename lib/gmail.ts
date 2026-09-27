import type { Email } from "@/lib/parse";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

async function accessToken(): Promise<string> {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    throw new Error("Gmail is not connected yet. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN.");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: GMAIL_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(
      body.error === "invalid_grant"
        ? "Gmail access expired or was revoked. Create a new GMAIL_REFRESH_TOKEN (see README, step 5)."
        : `Gmail sign-in failed: ${body.error_description || body.error || res.status}`,
    );
  }
  return body.access_token as string;
}

async function gget(token: string, path: string) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export const ALERT_QUERY =
  "(from:linkedin.com OR from:naukri.com OR from:indeed.com OR from:wellfound.com OR from:internshala.com OR from:instahyre.com OR from:unstop.com)";

/** Returns alert emails from the last `days` days, skipping ids in `skip`. */
export async function fetchAlertEmails(days: number, skip: Set<string>, max = 150): Promise<Email[]> {
  const token = await accessToken();
  const ids: { id: string; threadId: string }[] = [];
  let pageToken = "";
  do {
    const q = encodeURIComponent(`${ALERT_QUERY} newer_than:${days}d`);
    const page = await gget(token, `/messages?q=${q}&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ""}`);
    for (const m of page.messages || []) if (!skip.has(m.id)) ids.push(m);
    pageToken = page.nextPageToken || "";
  } while (pageToken && ids.length < max);

  const addr = process.env.GMAIL_ADDRESS;
  const out: Email[] = [];
  // Fetch in small parallel batches to stay well inside Gmail's rate limits.
  for (let i = 0; i < Math.min(ids.length, max); i += 10) {
    const batch = ids.slice(i, i + 10);
    const msgs = await Promise.all(batch.map((m) => gget(token, `/messages/${m.id}?format=full`)));
    for (const msg of msgs) {
      const headers: { name: string; value: string }[] = msg.payload?.headers || [];
      const h = (n: string) => headers.find((x) => x.name.toLowerCase() === n)?.value || "";
      out.push({
        id: msg.id,
        from: h("from"),
        subject: h("subject"),
        date: new Date(Number(msg.internalDate)).toISOString(),
        text: bodyText(msg.payload),
        gmailLink: addr
          ? `https://mail.google.com/mail/?authuser=${encodeURIComponent(addr)}#all/${msg.threadId}`
          : `https://mail.google.com/mail/u/0/#all/${msg.threadId}`,
      });
    }
  }
  return out;
}

type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };

function decode(data: string) {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function findPart(p: Part, type: string): string | null {
  if (p.mimeType === type && p.body?.data) return decode(p.body.data);
  for (const c of p.parts || []) {
    const r = findPart(c, type);
    if (r) return r;
  }
  return null;
}

export function bodyText(payload: Part): string {
  const plain = findPart(payload, "text/plain");
  if (plain && plain.includes("http")) return plain;
  const html = findPart(payload, "text/html");
  return html ? htmlToText(html) : plain || "";
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => `${inner}\n<${href.replace(/&amp;/g, "&")}>\n`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|td|th|li|h[1-6]|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#8377;/g, "₹")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n");
}
