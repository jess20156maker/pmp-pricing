import { NextResponse } from "next/server";
import { isAllowedEmail, makeCode, normalizeEmail } from "@/lib/auth";
import { sendCode } from "@/lib/mailer";

// Setup mode returns the code straight to the browser so you can test the whole
// flow before wiring up email. It only works when NO email provider is
// configured, and the sign-in screen shows a loud warning while it is on.
// Anyone on the allowlist can sign in as anyone else on it, so turn it off.
const setupMode = () => process.env.SETUP_MODE === "true" && !process.env.RESEND_API_KEY;

export const runtime = "nodejs";

export async function POST(req) {
  const { email } = await req.json().catch(() => ({}));
  const clean = normalizeEmail(email);

  // Always answer the same way, so this can't be used to discover who has access.
  const generic = NextResponse.json({ ok: true });

  if (!isAllowedEmail(clean)) {
    await new Promise((r) => setTimeout(r, 500));
    return generic;
  }

  const code = makeCode(clean);

  if (setupMode()) {
    console.warn("SETUP_MODE is on — sign-in codes are being shown in the browser.");
    return NextResponse.json({ ok: true, setupCode: code });
  }

  try {
    await sendCode(clean, code);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
  return generic;
}
