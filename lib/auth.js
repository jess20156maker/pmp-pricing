import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE = "pmp_session";
const MAX_AGE = 60 * 60 * 24 * 30;      // session lasts 30 days
const CODE_WINDOW_MS = 10 * 60 * 1000;  // a sign-in code is valid ~10-20 minutes

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

const hmac = (v) => crypto.createHmac("sha256", secret()).update(v).digest("hex");

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export const normalizeEmail = (e) => String(e ?? "").trim().toLowerCase();

// --- email ------------------------------------------------------------------
// The email is not a credential. It is checked for shape only, and exists so each
// price change can be attributed in the Pricing Change Log. ACCESS_PASSWORD is what
// actually gates access.

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

// --- shared access password --------------------------------------------------
// One password the whole team shares, set as ACCESS_PASSWORD in Vercel. The email
// is not verified — it identifies who made a change in the Pricing Change Log,
// while the password is what actually gates access. Change ACCESS_PASSWORD to cut
// off anyone who has left; that signs everyone out on their next sign-in.

export function passwordIsValid(input) {
  const expected = process.env.ACCESS_PASSWORD;
  // Fail closed: with no password configured, nobody gets in.
  if (!expected) return false;
  const given = String(input ?? "");
  if (!given) return false;
  // HMAC both sides first so the comparison is fixed-length and constant-time,
  // and never leaks the real password's length.
  return safeEqual(hmac(`pw:${given}`), hmac(`pw:${expected}`));
}

// --- session -----------------------------------------------------------------

export function makeSession(email) {
  const payload = Buffer.from(
    JSON.stringify({ email: normalizeEmail(email), issued: Date.now() })
  ).toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

export function readSession(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, mac] = token.split(".");
  if (!safeEqual(mac, hmac(payload))) return null;
  try {
    const { email, issued } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (Date.now() - issued > MAX_AGE * 1000) return null;
    if (!isValidEmail(email)) return null;
    return { email };
  } catch {
    return null;
  }
}

export function currentUser() {
  return readSession(cookies().get(COOKIE)?.value);
}

export const COOKIE_NAME = COOKIE;
export const COOKIE_MAX_AGE = MAX_AGE;
