// Run: npm test
import assert from "node:assert/strict";
import { parseEmail, type Email } from "../lib/parse";
import { toJob } from "../lib/ingest";
import { classifyLevel } from "../lib/classify";

const base = { id: "x", date: "2026-09-22T20:52:36Z", gmailLink: "https://mail.google.com/mail/u/0/#all/x" };
let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log("ok -", name); };

// Real Wellfound alert body (trimmed), as received on 22 Sep 2026.
const wellfound: Email = { ...base, from: "team@hi.wellfound.com", subject: "New jobs: Software Engineer (Product)  at Avoca AI and  12 more jobs", text: `<https://angel.co>

Hi Utkarsh! I've found 13 new jobs that might interest you!

 Ready to Interview Open to offers Closed to Offers

Software Engineer (Product)

Avoca AI / 51-200 Employees

 | Bengaluru | years of exp | Full-time

Actively Hiring Recently funded

Learn More
<https://wellfound.com/jobs?job_listing_slug=4718964-software-engineer-product>

Software Development Engineer - II (Integrator)

Botsync / 51-200 Employees

 | Bengaluru | years of exp | Full-time

Actively Hiring Responds within three weeks Early Stage Growing fast

Learn More
<https://wellfound.com/jobs?job_listing_slug=4735141-software-development-engineer-ii-integrator>

Associate AI Engineer

Emplay / 51-200 Employees

 ₹8L–₹10L | Remote only, India | 1 years of exp | Full-time

Actively Hiring B2B Growth Stage Growing fast

Learn More
<https://wellfound.com/jobs?job_listing_slug=4750179-associate-ai-engineer>

SDE Intern - Frontend

CloudSEK / 51-200 Employees

 | Bengaluru | years of exp | Internship

Actively Hiring Growth Stage

Learn More
<https://wellfound.com/jobs?job_listing_slug=4748630-sde-intern-frontend>

UiPath Developer / RPA Developer

Aventior / 51-200 Employees

 | Remote only, Noida, Karnataka, Maharashtra, Rajasthan, Madhya Pradesh,
Delhi | 5 years of exp | Full-time

Learn More
<https://wellfound.com/jobs?job_listing_slug=4750177-uipath-developer-rpa-developer>

AI Engineering Intern

InnovNation.ai / 1-10 Employees

 | Onsite or remote, Singapore, Remote (Singapore), Remote (Malaysia) | 0
years of exp | Internship

Learn More
<https://wellfound.com/jobs?job_listing_slug=4688284-ai-engineering-intern>

 Not finding what you had in mind? Try updating your preferences
<https://wellfound.com/profile/edit/preferences>` };

test("Wellfound: reads every job block", () => {
  const r = parseEmail(wellfound);
  assert.equal(r.platform, "Wellfound");
  assert.equal(r.jobs.length, 6);
  const emplay = r.jobs.find((j) => j.company === "Emplay")!;
  assert.equal(emplay.title, "Associate AI Engineer");
  assert.equal(emplay.pay, "₹8L–₹10L");
  assert.equal(emplay.location, "Remote, India");
  assert.equal(emplay.exp, "1 years of exp");
  assert.equal(emplay.link, "https://wellfound.com/jobs?job_listing_slug=4750179-associate-ai-engineer");
});

test("Wellfound: keeps fits, labels levels, drops senior and abroad", () => {
  const r = parseEmail(wellfound);
  const kept = r.jobs.map((c) => toJob(c, "Wellfound", wellfound)).filter(Boolean);
  const byTitle = Object.fromEntries(kept.map((j) => [j!.title, j!]));
  assert.equal(byTitle["Software Engineer (Product)"].level, "unknown");
  assert.equal(byTitle["Associate AI Engineer"].level, "junior");
  assert.equal(byTitle["Associate AI Engineer"].role, "ML / AI");
  assert.equal(byTitle["SDE Intern - Frontend"].level, "internship");
  assert.ok(!byTitle["Software Development Engineer - II (Integrator)"], "SDE-II dropped");
  assert.ok(!byTitle["AI Engineering Intern"], "Singapore-only internship dropped");
  assert.equal(kept.length, 3 + (byTitle["UiPath Developer / RPA Developer"] ? 1 : 0));
  assert.ok(!byTitle["UiPath Developer / RPA Developer"], "5 years dropped");
});

// Real Indeed single-job match email (subject + opening line).
const indeed: Email = { ...base, from: "Indeed <donotreply@match.indeed.com>", subject: "SOFTWARE DEVELOPER- Fresher @ Soranova Technologies Private Limited",
  text: "₹3,00,000 - ₹4,50,000 a year. Hi UTKARSH, It looks like your background could be a match for this SOFTWARE DEVELOPER- Fresher role.\nApply now\n<https://in.indeed.com/rc/clk/dl?jk=ab12cd34ef56&from=ja>" };

test("Indeed: single-job email", () => {
  const r = parseEmail(indeed);
  assert.equal(r.jobs.length, 1);
  const j = toJob(r.jobs[0], "Indeed", indeed)!;
  assert.equal(j.company, "Soranova Technologies Private Limited");
  assert.equal(j.level, "fresher");
  assert.equal(j.role, "Software Engineer");
  assert.equal(j.pay, "₹3,00,000 - ₹4,50,000 a year");
  assert.ok(j.link.includes("jk=ab12cd34ef56"));
});

test("Indeed: company with handle in brackets, falls back to Gmail link", () => {
  const e = { ...indeed, subject: "Specialist - Artificial Intelligence ( AI ) @ fingertipstech - (Fingertips Solutions Private Limited)", text: "From ₹6,00,000 a year. Hi UTKARSH" };
  const j = toJob(parseEmail(e).jobs[0], "Indeed", e)!;
  assert.equal(j.company, "fingertipstech");
  assert.equal(j.role, "ML / AI");
  assert.equal(j.link, base.gmailLink);
});

// LinkedIn job alert (typical plain-text layout).
const linkedin: Email = { ...base, from: "LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>", subject: "“machine learning engineer”: Acme AI and more", text: `Your job alert for machine learning engineer in Bengaluru
New jobs match your preferences.

Machine Learning Engineer
Acme AI
Bengaluru, Karnataka, India
Actively recruiting
View job: https://www.linkedin.com/comm/jobs/view/4012345678/?trackingId=abc

Senior Data Scientist
BigCo
Bengaluru, Karnataka, India
View job: https://www.linkedin.com/comm/jobs/view/4012345679/?trackingId=def

Graduate Software Engineer 2027
Globex
Gurugram, Haryana, India
View job: https://www.linkedin.com/comm/jobs/view/4012345680/

See all jobs on LinkedIn: https://www.linkedin.com/comm/jobs/search/?keywords=ml` };

test("LinkedIn: alert layout", () => {
  const r = parseEmail(linkedin);
  assert.equal(r.jobs.length, 3);
  assert.deepEqual([r.jobs[0].title, r.jobs[0].company, r.jobs[0].location], ["Machine Learning Engineer", "Acme AI", "Bengaluru, Karnataka, India"]);
  const kept = r.jobs.map((c) => toJob(c, "LinkedIn", linkedin)).filter(Boolean);
  assert.equal(kept.length, 2, "senior dropped");
  assert.equal(kept[1]!.level, "fresher");
  assert.equal(kept[1]!.id, "linkedin-4012345680");
});

test("Non-alert emails are ignored", () => {
  const r = parseEmail({ ...base, from: "resumenc@naukri.com", subject: "Utkarsh, you are missing job shortlists", text: "Your resume is 50+ days old." });
  assert.equal(r.jobs.length, 0);
  assert.equal(r.isJobAlert, false);
});

test("Levels", () => {
  assert.equal(classifyLevel({ title: "Graduate Engineer Trainee", exp: "", jobType: "" }), "fresher");
  assert.equal(classifyLevel({ title: "Data Analyst", exp: "0-2 Yrs", jobType: "" }), "fresher");
  assert.equal(classifyLevel({ title: "Data Analyst", exp: "3-5 Yrs", jobType: "" }), null);
  assert.equal(classifyLevel({ title: "ML Engineer", exp: "", jobType: "" }), "unknown");
});

console.log(`\n${passed} tests passed`);
