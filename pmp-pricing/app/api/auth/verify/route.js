import { NextResponse } from "next/server";
import {
  isAllowedEmail, codeIsValid, makeSession, normalizeEmail,
  COOKIE_NAME, COOKIE_MAX_AGE,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req) {
  const { email, code } = await req.json().catch(() => ({}));
  const clean = normalizeEmail(email);

  if (!isAllowedEmail(clean) || !codeIsValid(clean, code)) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "That code isn't right, or it's expired" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, email: clean });
  res.cookies.set(COOKIE_NAME, makeSession(clean), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}
