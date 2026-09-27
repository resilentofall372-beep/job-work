import type { Level, Role } from "@/lib/types";

export type Candidate = {
  title: string;
  company: string;
  location: string;
  pay: string;
  exp: string;        // raw experience text, e.g. "0 years of exp", "0-2 Yrs"
  jobType: string;    // raw type text, e.g. "Internship", "Full-time"
  link: string;
  extId: string;      // platform's own id when known
};

const ML = /\b(ml|machine learning|ai|a\.i\.|artificial intelligence|data scien\w*|deep learning|nlp|computer vision|llm|gen ?ai|generative|mlops|applied scientist)\b/i;
const DA = /\b(data analyst|business analyst|analytics|data analysis|bi (developer|analyst)|business intelligence|power bi|reporting analyst|analyst)\b/i;
const SWE = /\b(software|sde|swe|developer|engineer|engineering|full[ -]?stack|back[ -]?end|front[ -]?end|programmer|web)\b/i;
const NOT_OURS = /\b(sales|marketing|hr|human resources|recruit\w*|accountant|finance|legal|nurse|pharma\w*|mechanical|civil|electrical|teacher|tutor|content writer|customer support|voice process|bpo|graphic designer|cyber ?security|soc)\b/i;

export function classifyRole(title: string): Role | null {
  if (NOT_OURS.test(title)) return null;
  if (ML.test(title)) return "ML / AI";
  if (DA.test(title)) return "Data Analyst";
  if (SWE.test(title)) return "Software Engineer";
  return null;
}

const SENIOR = /\b(senior|sr\.?|lead|principal|staff|manager|head|director|architect|vp|chief|ii|iii|iv|sde[- ]?[23]|l[4-9])\b/i;
const INTERN = /\b(intern|internship|interns)\b/i;
const FRESHER = /\b(fresher|freshers|entry[- ]level|graduate|new grad|trainee|apprentice|campus|20(26|27|28) (batch|pass ?out|graduates?)|batch 20(26|27)|0 ?(-|–|to) ?\d+ ?(yrs?|years?))\b/i;

/** Smallest number of years the posting asks for, if it says. */
export function minYears(text: string): number | null {
  const t = text.toLowerCase();
  if (/\b(fresher|0 years?|0 yrs?|no experience)\b/.test(t)) return 0;
  const m = t.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:(?:-|–|to)\s*\d+(?:\.\d+)?\s*)?(?:years?|yrs?)\b/);
  return m ? parseFloat(m[1]) : null;
}

/** null = drop the job (too senior). */
export function classifyLevel(c: Pick<Candidate, "title" | "exp" | "jobType">): Level | null {
  const all = `${c.title} ${c.exp} ${c.jobType}`;
  if (INTERN.test(c.title) || /internship/i.test(c.jobType)) return "internship";
  if (SENIOR.test(c.title)) return null;
  const yrs = minYears(c.exp) ?? minYears(c.title);
  if (yrs !== null) {
    if (yrs >= 3) return null;
    if (yrs >= 1) return "junior";
    return "fresher";
  }
  if (FRESHER.test(all)) return "fresher";
  return "unknown";
}

const ABROAD = /\b(singapore|malaysia|united states|usa|u\.s\.|uk|united kingdom|london|dubai|uae|germany|canada|australia|europe|philippines|japan)\b/i;
export function inIndiaOrRemote(location: string): boolean {
  if (!location) return true;
  if (/india/i.test(location)) return true;
  return !ABROAD.test(location);
}
