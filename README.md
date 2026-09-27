# Job Radar

Your private job dashboard. It reads your job alert emails (LinkedIn, Naukri, Indeed, Wellfound, Internshala) every morning, keeps the roles that fit (ML / AI, Data Analyst, Software Engineer), and sorts them by who can apply:

- **Internship**: open to students now
- **Fresher (0 yrs)**: new grad, 2027 batch, entry level
- **Needs 1–2 yrs**: a stretch, but worth trying if the fit is strong
- **Not stated**: the posting doesn't say, so check it

Roles asking for 3+ years, senior or lead roles, and jobs outside India (unless remote) are left out. Only you can open the dashboard: every page and API is behind your password.

It starts with the 28 openings already found in your inbox.

---

## Setup (about 30 minutes, all in the browser)

You need free accounts on **GitHub**, **Vercel** and **Google Cloud**. The emails on these accounts don't have to match.

### 1. Put the code on GitHub
1. Unzip `job-radar.zip`.
2. On GitHub, click **New repository**. Name it `job-radar`, set it to **Private**, and create it.
3. On the empty repo page, click **uploading an existing file**. Drag in **everything inside** the unzipped `job-radar` folder (the `app`, `lib`, `data`, `scripts` and `tests` folders plus the files next to them). Commit.

### 2. Create the Vercel project
1. On vercel.com, click **Add New… → Project** and import the `job-radar` repo.
2. Open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `APP_PASSWORD` | The password you'll log in with. Use 12+ characters. |
   | `AUTH_SECRET` | Any random string of 40+ characters. A password generator works. |
   | `CRON_SECRET` | Another random string of 40+ characters. |

3. Click **Deploy**. The first deploy will say "Setup needed" until step 3 is done.

### 3. Add the database
1. In your Vercel project, go to **Storage → Create Database → Neon (Postgres)**. Accept the defaults, pick the **Mumbai (ap-south-1)** region if it's offered, and connect it to this project.
2. This adds `DATABASE_URL` for you. Go to **Deployments**, open the ⋯ menu on the latest one, and choose **Redeploy**.

### 4. Log in
Open your `https://<project>.vercel.app` link and sign in with `APP_PASSWORD`. You'll see your 28 starting openings.

### 5. Connect Gmail (read-only)
This lets the app read your job alert emails. It can't send, delete or change anything.

1. Go to **console.cloud.google.com**, create a project (e.g. "Job Radar"), then **APIs & Services → Library**, search **Gmail API**, and click **Enable**.
2. **APIs & Services → OAuth consent screen**: choose **External**, fill in the app name and your email, and add `utkarshjain1217@gmail.com` as a **test user**. Then click **Publish app → In production**. (In "Testing" mode Google expires the connection every 7 days.)
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URI: `https://developers.google.com/oauthplayground`
   - Copy the **Client ID** and **Client secret**.
4. Open **developers.google.com/oauthplayground**:
   - Click the ⚙️ gear (top right), tick **Use your own OAuth credentials**, and paste the Client ID and secret.
   - In the box under the scope list on the left, type `https://www.googleapis.com/auth/gmail.readonly` and click **Authorize APIs**.
   - Sign in with **utkarshjain1217@gmail.com**. Google will warn that the app isn't verified. It's your own app, so click **Advanced → Go to Job Radar** and allow access.
   - Click **Exchange authorization code for tokens** and copy the **Refresh token**.
5. In Vercel, add these environment variables, then **Redeploy**:

   | Name | Value |
   |---|---|
   | `GMAIL_CLIENT_ID` | from step 3 |
   | `GMAIL_CLIENT_SECRET` | from step 3 |
   | `GMAIL_REFRESH_TOKEN` | from step 4 |
   | `GMAIL_ADDRESS` | `utkarshjain1217@gmail.com` (makes "open email" links pick the right inbox) |

6. On the dashboard, press **Refresh now**. The first refresh looks back 30 days.

### 6. Turn on job alerts
The dashboard can only show what arrives in your inbox. Create alerts for **ML Engineer**, **Data Analyst** and **Software Engineer**, set to **Entry level / Internship** in **Bengaluru** and **Delhi NCR**, with daily emails, on:
- LinkedIn (search the role, add filters, then **Set alert**)
- Naukri (**Create Job Alert**)
- Indeed, Wellfound, Internshala (save the search as an alert)

---

## Everyday use
- The dashboard refreshes itself every morning around **7:45 AM IST** (Vercel Cron, in `vercel.json`). On Vercel's free plan it can run any time within that hour.
- Mark each job **Applied** or **Skip**. **To review** shows only the ones you haven't marked yet.
- If a job alert email couldn't be read automatically, the dashboard lists it with a link to the email.
- If Gmail access expires, the dashboard says so. Repeat step 5.4 and update `GMAIL_REFRESH_TOKEN`.

## Security
- Login is one password checked on the server. It sets a signed, HttpOnly session cookie that lasts 30 days. After 5 wrong tries from the same network, login locks for 15 minutes.
- Every page and API redirects or returns 401 without a valid session. The daily refresh endpoint only runs when called with `CRON_SECRET`.
- Search engines are told not to index the site.
- **Change your password:** update `APP_PASSWORD` in Vercel and redeploy.
- **Log out every device:** change `AUTH_SECRET` and redeploy.
- **Optional, stronger:** store a hash instead of the plain password. On a computer with Node.js, run `npm install`, then `npm run hash-password -- "your password"`. Put the printed `APP_PASSWORD_HASH_B64` in Vercel and delete `APP_PASSWORD`.

## For developers
- `npm install`, create `.env.local` from `.env.example`, then `npm run dev`
- `npm test` runs the email parser tests (built from real Wellfound and Indeed alert emails)
- Parsers live in `lib/parse.ts`, and the fit and level rules in `lib/classify.ts`. The LinkedIn and Naukri parsers follow their usual alert layout. If they miss jobs, the dashboard lists those emails under "couldn't be read", and the parser can be adjusted from a real sample.
