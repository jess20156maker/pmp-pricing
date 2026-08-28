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

// --- who can do what ---------------------------------------------------------
// Sign-in is the email address alone. The role follows from it:
//
//   anything else                        -> customer  (read only)
//   @postmarketpublishing.com            -> sales     (can request changes)
//   ...and listed in APPROVER_EMAILS     -> approver  (can approve, can edit)
//
// The address is not verified, so a role is a claim rather than proof. Approvals
// record what was typed. To make them provable, reinstate the emailed sign-in
// code — nothing here would need to change but makeSession's caller.

export const ROLES = { CUSTOMER: "customer", SALES: "sales", APPROVER: "approver" };

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

// Values pasted into a dashboard often arrive wrapped in quotes, or with
// stray spaces and newlines. Strip all of that before comparing, or a correct
// looking setting silently fails to match.
function envList(name) {
  return String(process.env[name] || "")
    .replace(/^\s*["']|["']\s*$/g, "")
    .split(/[,\n;]/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

function staffDomains() {
  const list = envList("STAFF_EMAIL_DOMAINS");
  const domains = list.length ? list : ["postmarketpublishing.com"];
  return domains.map((d) => d.replace(/^@/, ""));
}

export function isStaffEmail(email) {
  const e = normalizeEmail(email);
  return staffDomains().some((d) => e.endsWith("@" + d));
}

export function approverEmails() {
  return envList("APPROVER_EMAILS");
}

export function isApproverEmail(email) {
  const e = normalizeEmail(email);
  // Must still be on a staff domain, so a stray entry can't grant approval to an outsider.
  return approverEmails().includes(e) && isStaffEmail(e);
}

// The single place roles are decided. Derived fresh on every request from the
// current env, so editing APPROVER_EMAILS takes effect at once rather than when
// someone's 30-day cookie expires.
export function roleFor(email) {
  if (!isStaffEmail(email)) return ROLES.CUSTOMER;
  return isApproverEmail(email) ? ROLES.APPROVER : ROLES.SALES;
}

export const canRequest = (role) => role === ROLES.SALES || role === ROLES.APPROVER;
export const canApprove = (role) => role === ROLES.APPROVER;

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
    return { email, role: roleFor(email) };
  } catch {
    return null;
  }
}

export function currentUser() {
  return readSession(cookies().get(COOKIE)?.value);
}

export const COOKIE_NAME = COOKIE;
export const COOKIE_MAX_AGE = MAX_AGE;
