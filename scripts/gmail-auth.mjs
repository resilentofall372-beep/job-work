// Gets a Gmail refresh token (read-only) on your own computer.
// Usage: GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... npm run gmail-auth
// Needs a Google Cloud OAuth client of type "Desktop app". See README, step 5.
import http from "node:http";
const { GMAIL_CLIENT_ID: id, GMAIL_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) {
  console.error("Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET first.");
  process.exit(1);
}
const PORT = 53682;
const redirect = `http://127.0.0.1:${PORT}/callback`;
const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
  client_id: id, redirect_uri: redirect, response_type: "code", access_type: "offline", prompt: "consent",
  scope: "https://www.googleapis.com/auth/gmail.readonly",
});
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, redirect);
  if (u.pathname !== "/callback") { res.end(); return; }
  const code = u.searchParams.get("code");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: "authorization_code" }),
  });
  const body = await r.json();
  res.end(body.refresh_token ? "Done. Go back to the terminal." : "Something went wrong. Check the terminal.");
  if (body.refresh_token) console.log("\nGMAIL_REFRESH_TOKEN=" + body.refresh_token + "\n");
  else console.error(body);
  server.close();
});
server.listen(PORT, "127.0.0.1", () => console.log("Open this link, sign in with the Gmail that gets your job alerts, and allow access:\n\n" + url + "\n"));
