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

// --- who is allowed in -------------------------------------------------------
// ALLOWED_EMAIL_DOMAINS lets you add a salesperson without redeploying:
// anyone on the domain can sign in. ALLOWED_EMAILS is for one-offs.

export function isAllowedEmail(email) {
  const e = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;

  const domains = (process.env.ALLOWED_EMAIL_DOMAINS || "")
    .split(",").map((d) => d.trim().toLowerCase().replace(/^@/, "")).filter(Boolean);
  if (domains.some((d) => e.endsWith("@" + d))) return true;

  const list = (process.env.ALLOWED_EMAILS || "")
    .split(",").map((x) => normalizeEmail(x)).filter(Boolean);
  return list.includes(e);
}

// --- sign-in codes -----------------------------------------------------------
// Derived from the email, not stored. Nothing to persist, so this works fine on
// serverless where each request may hit a different instance.

function codeFor(email, window) {
  const digest = hmac(`code:${normalizeEmail(email)}:${window}`);
  return String(parseInt(digest.slice(0, 8), 16) % 1000000).padStart(6, "0");
}

export function makeCode(email) {
  return codeFor(email, Math.floor(Date.now() / CODE_WINDOW_MS));
}

export function codeIsValid(email, input) {
  const clean = String(input ?? "").replace(/\D/g, "");
  if (clean.length !== 6) return false;
  const now = Math.floor(Date.now() / CODE_WINDOW_MS);
  // Accept the current and previous window so a code issued at 9:59 still works.
  return safeEqual(clean, codeFor(email, now)) || safeEqual(clean, codeFor(email, now - 1));
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
    // Someone removed from the allowlist loses access at their next request,
    // without waiting for the cookie to expire.
    if (!isAllowedEmail(email)) return null;
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
