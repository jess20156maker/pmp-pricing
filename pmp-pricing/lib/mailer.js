// Sends the six-digit sign-in code. Uses Resend if configured; otherwise prints
// the code to the server log so you can test before wiring up email.

export async function sendCode(email, code) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (!key || !from) {
    console.log(`[sign-in code] ${email} → ${code}   (no RESEND_API_KEY/MAIL_FROM set)`);
    return { delivered: false, reason: "email not configured" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `${code} — your PMP pricing sign-in code`,
      text:
        `Your sign-in code is ${code}\n\n` +
        `It works for about ten minutes. If you didn't ask for it, ignore this email.\n`,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Resend failed:", res.status, body.slice(0, 300));
    throw new Error("Could not send the sign-in email");
  }
  return { delivered: true };
}
