import { NextResponse } from "next/server";
import {
  isValidEmail, passwordIsValid, makeSession, normalizeEmail,
  COOKIE_NAME, COOKIE_MAX_AGE,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req) {
  const { email, password } = await req.json().catch(() => ({}));
  const clean = normalizeEmail(email);

  if (!isValidEmail(clean)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  if (!passwordIsValid(password)) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
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
