export type Role = "ML / AI" | "Data Analyst" | "Software Engineer";
/** Who can apply: internship, fresher (0 yrs / new grad), junior (asks 1–2 yrs), unknown (not stated). */
export type Level = "internship" | "fresher" | "junior" | "unknown";
export type Status = "new" | "applied" | "skip";

export type Job = {
  id: string;
  title: string;
  company: string;
  platform: string;
  role: Role;
  level: Level;
  location: string;
  pay: string;
  exp: string;
  posted: string | null; // YYYY-MM-DD
  link: string;
  status?: Status;
};

export type SyncInfo = {
  lastSync: string;
  emailsScanned: number;
  added: number;
  unread: { subject: string; from: string; link: string }[];
  error?: string;
};
