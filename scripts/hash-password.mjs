// Usage: npm run hash-password -- "your password"
// Prints APP_PASSWORD_HASH_B64 to paste into Vercel (use it instead of APP_PASSWORD).
import bcrypt from "bcryptjs";
const pw = process.argv[2];
if (!pw || pw.length < 10) {
  console.error('Give a password of at least 10 characters:  npm run hash-password -- "your password"');
  process.exit(1);
}
const hash = await bcrypt.hash(pw, 12);
console.log("APP_PASSWORD_HASH_B64=" + Buffer.from(hash).toString("base64"));
